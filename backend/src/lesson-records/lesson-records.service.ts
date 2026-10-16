import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LessonAgentService } from '../lesson-agent/lesson.agent.service';

@Injectable()
export class LessonRecordsService {
  constructor(
    private prisma: PrismaService,
    private lessonAgent: LessonAgentService,
  ) {}

  // 开始上课
  async startLesson(scheduleId: number) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { class: true, lessonPlan: true },
    });
    if (!schedule) throw new BadRequestException('排课记录不存在');

    // 防双写：同一课次同一时刻只允许一节进行中的课。
    // 老流程（本方法）与课堂 Agent（lesson-agent.startLesson）共用这条约束，
    // 避免两个流程对同一 scheduleId 各写一条 LessonRecord。
    const ongoing = await this.prisma.lessonRecord.findFirst({
      where: { scheduleId, status: 'ongoing' },
      select: { id: true },
    });
    if (ongoing) {
      throw new ConflictException(`该课次已有进行中的课堂记录 #${ongoing.id}，请先结束再开课`);
    }

    return this.prisma.lessonRecord.create({
      data: {
        scheduleId,
        classId: schedule.classId,
        lessonPlanId: schedule.lessonPlanId,
        agentId: schedule.agentId,
        startedAt: new Date(),
        status: 'ongoing',
      },
    });
  }

  // 结束上课
  async endLesson(recordId: number, summary?: any) {
    return this.prisma.lessonRecord.update({
      where: { id: recordId },
      data: {
        endedAt: new Date(),
        status: 'completed',
        summary: summary || {},
      },
    });
  }

  // 记录行为事件
  async addBehaviorEvent(recordId: number, event: any) {
    const behaviorEvent = await this.prisma.behaviorEvent.create({
      data: {
        lessonRecordId: recordId,
        studentId: event.studentId ? Number(event.studentId) : null,
        type: event.type || 'other',
        // category 决定该事件是否算违纪（后端打分按 category==='violation' 扣纪律分），
        // 此前这里把 category 丢掉了，导致 HTTP 上报的违纪永远不会被扣分
        category: event.category || null,
        startTime: new Date(event.time || Date.now()),
        note: event.detail || event.note,
      },
    });

    // 纪律类行为同步生成课堂警告（Warning）
    await this.createWarningIfDiscipline(recordId, behaviorEvent.studentId, behaviorEvent.type);

    // 若该课次由课堂 Agent 驱动，把事件转发进 pendingEvents，
    // 让数字人在下一次互动中点名提醒。转发失败不影响事件落库。
    try {
      await this.lessonAgent.forwardEvent(recordId, {
        type: behaviorEvent.type,
        studentId: behaviorEvent.studentId ?? undefined,
        category: behaviorEvent.category ?? undefined,
      });
    } catch {
      /* 静默：事件已落库，转发属增强能力 */
    }

    return behaviorEvent;
  }

  // 纪律行为 → 扣分警告
  private async createWarningIfDiscipline(recordId: number, studentId: number | null, type: string) {
    if (!studentId) return; // Warning 必须关联学生，无学生则跳过
    const scoreMap: Record<string, number> = {
      talking: 1,
      walking: 1,
      sleeping: 2,
      discipline: 1,
    };
    const deduction = scoreMap[type];
    if (deduction === undefined) return;

    const labelMap: Record<string, string> = {
      talking: '课堂讲话',
      walking: '随意走动',
      sleeping: '上课睡觉',
      discipline: '违纪行为',
    };

    await this.prisma.warning.create({
      data: {
        lessonRecordId: recordId,
        studentId,
        type: 'discipline',
        content: `${labelMap[type] || '课堂纪律问题'}，扣${deduction}分`,
        scoreDeduction: deduction,
      },
    });
  }

  // 记录考勤
  async recordAttendance(recordId: number, studentId: number, status: string) {
    return this.prisma.attendance.create({
      data: {
        lessonRecordId: recordId,
        studentId,
        status,
      },
    });
  }

  findByClass(classId: number, startDate?: string, endDate?: string) {
    const where: any = { classId: Number(classId) };
    if (startDate && endDate) {
      where.startedAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    return this.prisma.lessonRecord.findMany({
      where,
      include: {
        behaviorEvents: true,
        attendance: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  findOne(id: number) {
    return this.prisma.lessonRecord.findUnique({
      where: { id },
      include: {
        behaviorEvents: true,
        attendance: true,
        warnings: true,
      },
    });
  }
}
