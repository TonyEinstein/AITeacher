import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // 发送通知（AI批评后自动通知家长等场景）
  async create(data: { studentId?: number; userId?: number; type: string; title: string; content: string }) {
    return this.prisma.notification.create({ data });
  }

  // 学生/用户的通知列表
  async list(studentId?: number, userId?: number, unread?: boolean) {
    return this.prisma.notification.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(userId ? { userId } : {}),
        ...(unread ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: number) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async unreadCount(studentId?: number, userId?: number) {
    return this.prisma.notification.count({
      where: { read: false, ...(studentId ? { studentId } : {}), ...(userId ? { userId } : {}) },
    });
  }
}