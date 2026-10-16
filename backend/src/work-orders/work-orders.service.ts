import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkOrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20, filter: { status?: string; type?: string; schoolId?: number; keyword?: string } = {}, user: any = null) {
    const where: any = {};
    // school_admin 只能看本校工单，忽略前端传入的 schoolId
    if (user && user.role !== 'super_admin' && user.schoolId) {
      where.schoolId = Number(user.schoolId);
    } else if (filter.schoolId) {
      where.schoolId = Number(filter.schoolId);
    }
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.keyword) {
      where.OR = [
        { title: { contains: filter.keyword } },
        { description: { contains: filter.keyword } },
        { faultCode: { contains: filter.keyword } },
        { contactName: { contains: filter.keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { school: { select: { id: true, name: true, code: true, status: true } } },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  // 汇总统计：按状态/类型/优先级
  async stats(user: any = null) {
    // school_admin 只统计本校工单
    const where: any = {};
    if (user && user.role !== 'super_admin' && user.schoolId) {
      where.schoolId = Number(user.schoolId);
    }
    const [total, pending, processing, resolved, closed, urgent, deviceRepair] = await Promise.all([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.count({ where: { ...where, status: 'pending' } }),
      this.prisma.workOrder.count({ where: { ...where, status: 'processing' } }),
      this.prisma.workOrder.count({ where: { ...where, status: 'resolved' } }),
      this.prisma.workOrder.count({ where: { ...where, status: 'closed' } }),
      this.prisma.workOrder.count({ where: { ...where, priority: 'urgent', status: { in: ['pending', 'processing'] } } }),
      this.prisma.workOrder.count({ where: { ...where, type: 'device_repair' } }),
    ]);
    return { total, pending, processing, resolved, closed, urgent, deviceRepair };
  }

  async findOne(id: number) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { school: { select: { id: true, name: true, code: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    return wo;
  }

  create(data: any) {
    return this.prisma.workOrder.create({
      data: {
        schoolId: Number(data.schoolId),
        title: data.title,
        type: data.type || 'device_repair',
        priority: data.priority || 'medium',
        status: data.status || 'pending',
        description: data.description || '',
        contactName: data.contactName || null,
        contactPhone: data.contactPhone || null,
        assignee: data.assignee || null,
        faultCode: data.faultCode || null,
      },
      include: { school: { select: { id: true, name: true, code: true } } },
    });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        title: data.title,
        type: data.type,
        priority: data.priority,
        description: data.description,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        assignee: data.assignee,
        faultCode: data.faultCode,
      },
      include: { school: { select: { id: true, name: true, code: true } } },
    });
  }

  // 状态流转：pending -> processing -> resolved -> closed
  async transition(id: number, body: { status: string; resolution?: string; assignee?: string }) {
    const wo = await this.findOne(id);
    const data: any = { status: body.status };
    if (body.resolution !== undefined) data.resolution = body.resolution;
    if (body.assignee !== undefined) data.assignee = body.assignee;
    if (body.status === 'resolved' || body.status === 'closed') {
      data.resolvedAt = new Date();
    } else {
      data.resolvedAt = null;
    }
    if (body.status === 'resolved' && wo.status === 'pending') {
      // 处理中标记为已解决时，保留处理人
    }
    return this.prisma.workOrder.update({
      where: { id },
      data,
      include: { school: { select: { id: true, name: true, code: true } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.workOrder.delete({ where: { id } });
  }
}
