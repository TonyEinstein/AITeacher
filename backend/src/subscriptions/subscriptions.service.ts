import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number, pageSize: number, user: any = null) {
    const skip = (page - 1) * pageSize;
    // school_admin 只能看本校订阅
    const where: any = {};
    if (user && user.role !== 'super_admin' && user.schoolId) {
      where.schoolId = Number(user.schoolId);
    }
    const [list, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where, skip, take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { school: { select: { id: true, name: true, code: true, contactName: true, contactPhone: true, status: true } } },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async findBySchool(schoolId: number) {
    return this.prisma.subscription.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 续费：在现有到期日基础上延长
  async renew(schoolId: number, body: any) {
    const months = Number(body.months) || 12;
    const sub = await this.prisma.subscription.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
    if (!sub) throw new NotFoundException('该学校暂无订阅记录，请先配置订阅');

    const baseDate = sub.endDate > new Date() ? sub.endDate : new Date();
    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { endDate: newEndDate, status: 'active', amount: body.amount ? Number(body.amount) : sub.amount },
    });
  }

  // 配置年限：新建或更新订阅
  async configure(schoolId: number, body: any) {
    const existing = await this.prisma.subscription.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const months = Number(body.months) || 12;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    if (existing) {
      return this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: body.plan || existing.plan,
          startDate, endDate,
          status: body.status || 'active',
          amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
        },
      });
    }
    return this.prisma.subscription.create({
      data: {
        schoolId,
        plan: body.plan || 'pro',
        startDate, endDate,
        status: body.status || 'active',
        amount: body.amount ? Number(body.amount) : null,
      },
    });
  }

  async disable(schoolId: number) {
    const sub = await this.prisma.subscription.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
    if (!sub) throw new NotFoundException('该学校暂无订阅记录');
    // 多步写操作用事务：更新学校状态 + 订阅状态
    return this.prisma.$transaction(async (tx) => {
      await tx.school.update({ where: { id: schoolId }, data: { status: 'inactive' } });
      return tx.subscription.update({ where: { id: sub.id }, data: { status: 'cancelled' } });
    });
  }

  async enable(schoolId: number) {
    const sub = await this.prisma.subscription.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
    if (!sub) throw new NotFoundException('该学校暂无订阅记录');
    return this.prisma.$transaction(async (tx) => {
      await tx.school.update({ where: { id: schoolId }, data: { status: 'active' } });
      return tx.subscription.update({ where: { id: sub.id }, data: { status: 'active' } });
    });
  }
}
