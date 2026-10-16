import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentMessagesService {
  constructor(private prisma: PrismaService) {}

  // 家长提交留言
  async create(parentId: number, content: string, studentId?: number) {
    const parent = await this.prisma.parent.findUnique({ where: { id: parentId } });
    if (!parent) throw new BadRequestException('家长账号不存在');

    return this.prisma.parentMessage.create({
      data: {
        parentId,
        content,
        status: 'pending',
      },
    });
  }

  // 查询待审核留言
  findPending(schoolId: number) {
    return this.prisma.parentMessage.findMany({
      where: {
        status: 'pending',
        parent: { student: { class: { grade: { schoolId } } } },
      },
      include: {
        parent: { include: { student: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 审核通过（安排课堂转达）
  approve(id: number, deliverAt?: Date) {
    return this.prisma.parentMessage.update({
      where: { id },
      data: { status: 'approved' },
    });
  }

  // 驳回
  reject(id: number, reason?: string) {
    return this.prisma.parentMessage.update({
      where: { id },
      data: { status: 'rejected' },
    });
  }

  // 标记已转达
  markDelivered(id: number) {
    return this.prisma.parentMessage.update({
      where: { id },
      data: { status: 'delivered' },
    });
  }

  // 家长查自己的留言
  findByParent(parentId: number) {
    return this.prisma.parentMessage.findMany({
      where: { parentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
