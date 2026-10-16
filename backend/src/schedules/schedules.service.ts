import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPostponePlan } from './schedule-time';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.schedule.create({ data });
  }

  // 自动排课
  async autoSchedule(schoolId: number, classId: number, lessonPlanIds: number[]) {
    const results = [];
    let dayOffset = 0;
    let period = 0;

    for (const lessonPlanId of lessonPlanIds) {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + dayOffset);
      startTime.setHours(8 + period * 2, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 45);

      const schedule = await this.prisma.schedule.create({
        data: {
          schoolId,
          classId,
          lessonPlanId,
          startTime,
          endTime,
          status: 'scheduled',
        },
      });
      results.push(schedule);

      period++;
      if (period >= 4) {
        period = 0;
        dayOffset++;
      }
    }
    return results;
  }

  findByClass(classId?: number, schoolId?: number, startDate?: string, endDate?: string) {
    const where: any = {};
    if (classId) where.classId = Number(classId);
    if (!classId && schoolId) where.schoolId = Number(schoolId);
    if (startDate && endDate) {
      where.startTime = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    return this.prisma.schedule.findMany({
      where,
      include: { lessonPlan: true, agent: true, room: true, class: true },
      orderBy: { startTime: 'asc' },
    });
  }

  findTodayByBox(boxId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.schedule.findMany({
      where: {
        room: { boxes: { some: { id: boxId } } },
        startTime: { gte: today, lt: tomorrow },
      },
      include: { lessonPlan: true, class: true, agent: true },
      orderBy: { startTime: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.schedule.findUnique({
      where: { id },
      include: { lessonPlan: true, class: true, agent: true, room: true },
    });
  }

  update(id: number, data: any) {
    return this.prisma.schedule.update({ where: { id }, data });
  }

  // ============ 调课：整体顺延 / 临时停课 / 单节改时间 ============

  /**
   * 调课整体顺延（PRD §3.15）
   *
   * 把某班 / 某年级 / 某校 `fromDate` 之后**尚未开始**的课整体后移 N 天。
   * 已取消、已完成、已开始的课不动（见 `buildPostponePlan` 的规则）。
   * 事务执行，避免只挪一半。
   */
  async postpone(params: {
    scope: 'class' | 'grade' | 'school';
    targetId: number;
    fromDate: string;
    days: number;
  }) {
    const { scope, targetId, fromDate, days } = params;
    if (!Number.isFinite(days) || days <= 0) {
      throw new BadRequestException('顺延天数必须为正整数');
    }
    if (!fromDate || Number.isNaN(new Date(fromDate).getTime())) {
      throw new BadRequestException('fromDate 不是合法时间');
    }

    const where: any = { startTime: { gte: new Date(fromDate) } };
    if (scope === 'class') where.classId = targetId;
    else if (scope === 'grade') where.class = { gradeId: targetId };
    else if (scope === 'school') where.schoolId = targetId;
    else throw new BadRequestException(`不支持的顺延范围：${scope}`);

    const candidates = await this.prisma.schedule.findMany({
      where,
      select: { id: true, startTime: true, endTime: true, status: true },
      orderBy: { startTime: 'asc' },
    });

    const plan = buildPostponePlan(candidates, fromDate, days);

    if (plan.items.length) {
      await this.prisma.$transaction(
        plan.items.map((it) =>
          this.prisma.schedule.update({
            where: { id: it.id },
            data: { startTime: new Date(it.newStartTime), endTime: new Date(it.newEndTime) },
          }),
        ),
      );
    }

    return {
      scope,
      targetId,
      fromDate,
      days,
      candidateCount: candidates.length,
      shifted: plan.items.length,
      skipped: plan.skipped.length,
      items: plan.items,
      skippedDetail: plan.skipped,
    };
  }

  /**
   * 临时停课（PRD §3.23）
   *
   * 把单节课置为 `cancelled` 并记录原因；
   * 可同时安排补课，补课记录用 `originalScheduleId` 溯源到被停的原课。
   */
  async cancelLesson(
    id: number,
    input: { reason?: string; makeupStartTime?: string; makeupEndTime?: string } = {},
  ) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('课次不存在');
    if (schedule.status === 'completed') throw new ConflictException('已完成的课不能停课');
    if (schedule.status === 'cancelled') throw new ConflictException('该课次已停课');

    let makeupStart: Date | null = null;
    let makeupEnd: Date | null = null;
    if (input.makeupStartTime && input.makeupEndTime) {
      makeupStart = new Date(input.makeupStartTime);
      makeupEnd = new Date(input.makeupEndTime);
      if (Number.isNaN(makeupStart.getTime()) || Number.isNaN(makeupEnd.getTime())) {
        throw new BadRequestException('补课时间格式不合法');
      }
      if (makeupEnd <= makeupStart) throw new BadRequestException('补课结束时间必须晚于开始时间');
      const conflict = await this.findConflict(schedule.classId, makeupStart, makeupEnd);
      if (conflict) {
        throw new ConflictException(
          `该班级在 ${conflict.startTime.toISOString()} 已有排课，补课时间冲突`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.schedule.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelReason: input.reason ?? null,
          cancelledAt: new Date(),
        },
      });

      const makeup =
        makeupStart && makeupEnd
          ? await tx.schedule.create({
              data: {
                schoolId: schedule.schoolId,
                classId: schedule.classId,
                agentId: schedule.agentId,
                lessonPlanId: schedule.lessonPlanId,
                roomId: schedule.roomId,
                startTime: makeupStart,
                endTime: makeupEnd,
                status: 'scheduled',
                originalScheduleId: schedule.id,
              },
            })
          : null;

      return { cancelled, makeup };
    });

    return { ...result, reason: input.reason ?? null };
  }

  /** 单节课改时间（调课），带同班冲突检测 */
  async reschedule(id: number, startTime: string, endTime: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('课次不存在');
    if (schedule.status !== 'scheduled') {
      throw new ConflictException(`当前状态（${schedule.status}）不允许改时间`);
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('时间格式不合法');
    }
    if (end <= start) throw new BadRequestException('结束时间必须晚于开始时间');

    const conflict = await this.findConflict(schedule.classId, start, end, id);
    if (conflict) {
      throw new ConflictException(
        `该班级在 ${conflict.startTime.toISOString()} 已有排课，时间冲突`,
      );
    }

    return this.prisma.schedule.update({
      where: { id },
      data: { startTime: start, endTime: end },
    });
  }

  /** 某节课的补课记录 */
  findMakeups(id: number) {
    return this.prisma.schedule.findMany({
      where: { originalScheduleId: id },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * 查同班同学时段是否已有排课。
   * 用半开区间判断（`start < end AND end > start`），与 `isOverlapping` 语义一致：
   * 背靠背排课（前一节结束 == 后一节开始）不算冲突。
   */
  private findConflict(
    classId: number,
    start: Date,
    end: Date,
    excludeId?: number,
    client: any = this.prisma,
  ) {
    return client.schedule.findFirst({
      where: {
        classId,
        status: { not: 'cancelled' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true, startTime: true, endTime: true },
    });
  }

  async remove(id: number) {
    // 删除前检查是否被教案记录 / 作业引用
    const [recordCount, schedule] = await Promise.all([
      this.prisma.lessonRecord.count({ where: { scheduleId: id } }),
      this.prisma.schedule.findUnique({ where: { id }, select: { lessonPlanId: true } }),
    ]);

    let assignmentCount = 0;
    if (schedule?.lessonPlanId) {
      assignmentCount = await this.prisma.assignment.count({
        where: { lessonPlanId: schedule.lessonPlanId },
      });
    }

    if (recordCount > 0 || assignmentCount > 0) {
      throw new ConflictException('该课表已被教案记录/作业引用，无法删除');
    }

    return this.prisma.schedule.delete({ where: { id } });
  }
}