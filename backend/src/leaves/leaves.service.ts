import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  // 学生提交请假
  async apply(studentId: number, data: { type: string; startDate: string; endDate?: string; reason: string }) {
    return this.prisma.leave.create({
      data: {
        studentId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        reason: data.reason,
        status: 'pending',
      },
    });
  }

  // 老师审批（仅 pending 状态可审批，防止重复审批）
  async approve(id: number, approved: boolean, reviewerId: number, comment?: string) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('请假记录不存在');
    const result = await this.prisma.leave.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: approved ? 'approved' : 'rejected',
        reviewerId,
        reviewComment: comment,
        reviewedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new BadRequestException('该请假已被审批，无法重复操作');
    }
    return this.prisma.leave.findUnique({ where: { id } });
  }

  // 待审批列表（分页）
  async pending(schoolId: number, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.leave.findMany({
        where: { status: 'pending', student: { class: { grade: { schoolId } } } },
        include: { student: { include: { class: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.leave.count({ where: { status: 'pending', student: { class: { grade: { schoolId } } } } }),
    ]);
    return { list, total, page, pageSize };
  }

  // 学生请假记录
  byStudent(studentId: number) {
    return this.prisma.leave.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 查询某学生当前是否在请假期间（AI 上课不提问请假学生）
  async isOnLeave(studentId: number, date = new Date()) {
    const leave = await this.prisma.leave.findFirst({
      where: {
        studentId,
        status: 'approved',
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
    });
    return !!leave;
  }
}