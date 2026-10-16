import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 教师工作量聚合（PRD §3.14）
 *
 * 当前系统的「教师工作」落在两类记录上：
 * 1. 作业复核：Submission（AI 批改 graded → 老师复核 reviewed）
 * 2. 请假审批：Leave（reviewerId + reviewedAt 可算时效）
 *
 * 口径说明：
 * - 复核量按 Submission.reviewerId 聚合（2026-10-10 起新复核记录带 reviewerId，老数据为 null）
 * - 审批时效 = reviewedAt - createdAt（小时），只算已审批记录
 */
@Injectable()
export class WorkloadService {
  constructor(private prisma: PrismaService) {}

  /** 单校工作量总览 */
  async schoolOverview(schoolId: number, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [reviewed, pendingReview, leavesReviewed, leavesPending] = await Promise.all([
      this.prisma.submission.count({
        where: { status: 'reviewed', assignment: { schoolId }, reviewedAt: { gte: since } },
      }),
      this.prisma.submission.count({
        where: { status: 'graded', assignment: { schoolId } },
      }),
      this.prisma.leave.findMany({
        where: {
          status: { in: ['approved', 'rejected'] },
          reviewedAt: { gte: since },
          student: { class: { grade: { schoolId } } },
        },
        select: { createdAt: true, reviewedAt: true },
      }),
      this.prisma.leave.count({
        where: {
          status: 'pending',
          student: { class: { grade: { schoolId } } },
        },
      }),
    ]);

    // 审批时效（小时）：reviewedAt - createdAt 的平均
    const durationsH = leavesReviewed
      .filter((l) => l.reviewedAt)
      .map((l) => (l.reviewedAt!.getTime() - l.createdAt.getTime()) / 3600000);
    const avgApprovalHours = durationsH.length
      ? Math.round((durationsH.reduce((s, d) => s + d, 0) / durationsH.length) * 10) / 10
      : null;

    // 作业复核时效：reviewedAt - submittedAt（老数据 submittedAt 可能为 null，跳过）
    const reviewedSubs = await this.prisma.submission.findMany({
      where: { status: 'reviewed', assignment: { schoolId }, reviewedAt: { gte: since }, submittedAt: { not: null } },
      select: { submittedAt: true, reviewedAt: true },
    });
    const subDurationsH = reviewedSubs
      .filter((s) => s.reviewedAt && s.submittedAt)
      .map((s) => (s.reviewedAt!.getTime() - s.submittedAt!.getTime()) / 3600000);
    const avgReviewHours = subDurationsH.length
      ? Math.round((subDurationsH.reduce((s, d) => s + d, 0) / subDurationsH.length) * 10) / 10
      : null;

    return {
      schoolId,
      windowDays: days,
      homework: {
        reviewedCount: reviewed,
        pendingReviewCount: pendingReview,
        avgReviewHours,
      },
      leave: {
        reviewedCount: leavesReviewed.length,
        pendingCount: leavesPending,
        avgApprovalHours,
      },
    };
  }

  /** 教师个人工作量：请假审批明细（reviewerId 可查） */
  async personalWorkload(userId: number, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const leaves = await this.prisma.leave.findMany({
      where: { reviewerId: userId, reviewedAt: { gte: since } },
      select: { id: true, createdAt: true, reviewedAt: true, status: true },
      orderBy: { reviewedAt: 'desc' },
    });
    const durationsH = leaves
      .filter((l) => l.reviewedAt)
      .map((l) => (l.reviewedAt!.getTime() - l.createdAt.getTime()) / 3600000);

    return {
      userId,
      windowDays: days,
      leaveReviewedCount: leaves.length,
      avgApprovalHours: durationsH.length
        ? Math.round((durationsH.reduce((s, d) => s + d, 0) / durationsH.length) * 10) / 10
        : null,
    };
  }
}
