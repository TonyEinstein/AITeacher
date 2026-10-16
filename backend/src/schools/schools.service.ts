import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  // 前端表单会带入 id / createdAt / remark / subscriptionEnd 等字段，
  // Prisma 不接受未知字段，这里做白名单清洗并做字段名映射。
  private normalizeSchoolData(data: any) {
    const out: any = {};
    if (data.name !== undefined) out.name = data.name;
    if (data.code !== undefined) out.code = data.code;
    if (data.province !== undefined) out.province = data.province || null;
    if (data.city !== undefined) out.city = data.city || null;
    if (data.status !== undefined) out.status = data.status;
    if (data.contactName !== undefined) out.contactName = data.contactName || null;
    if (data.contactPhone !== undefined) out.contactPhone = data.contactPhone || null;
    // 前端字段 subscriptionEnd(YYYY-MM-DD) -> schema 字段 expiresAt(DateTime)
    const rawEnd = data.subscriptionEnd ?? data.expiresAt;
    if (rawEnd) {
      out.expiresAt = new Date(rawEnd);
    } else if (data.subscriptionEnd === '' || data.expiresAt === '') {
      out.expiresAt = null;
    }
    return out;
  }

  create(data: any) {
    return this.prisma.school.create({ data: this.normalizeSchoolData(data) });
  }

  async findAll(page = 1, pageSize = 20, keyword?: string, status?: string) {
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    if (status) where.status = status;

    const [list, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
        include: {
          _count: { select: { grades: true } },
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { endDate: true, plan: true, status: true } },
        },
      }),
      this.prisma.school.count({ where }),
    ]);
    return {
      list: list.map((s: any) => ({
        ...s,
        gradeCount: s._count.grades,
        subscriptionEnd: s.subscriptions[0]?.endDate || null,
        subscriptionPlan: s.subscriptions[0]?.plan || null,
      })),
      total,
      page,
      pageSize,
    };
  }

  findOne(id: number) {
    return this.prisma.school.findUnique({ where: { id } });
  }

  update(id: number, data: any) {
    return this.prisma.school.update({ where: { id }, data: this.normalizeSchoolData(data) });
  }

  remove(id: number) {
    return this.prisma.school.delete({ where: { id } });
  }

  count() {
    return this.prisma.school.count();
  }
}