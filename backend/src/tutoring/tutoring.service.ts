import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class TutoringService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  // ==================== 辅导服务订阅 ====================

  /** 为学生开通辅导服务 */
  async subscribe(studentId: number, data: { plan?: string; months: number; glassesDeviceId?: number; watchDeviceId?: number }) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('学生不存在');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + data.months);

    // 多步写操作用事务包裹：创建订阅 + 绑定设备，任一失败回滚
    return this.prisma.$transaction(async (tx) => {
      if (data.glassesDeviceId) {
        await tx.device.update({
          where: { id: data.glassesDeviceId },
          data: { studentId, type: 'glasses', status: 'bound' },
        });
      }
      if (data.watchDeviceId) {
        await tx.device.update({
          where: { id: data.watchDeviceId },
          data: { studentId, type: 'watch', status: 'bound' },
        });
      }

      return tx.tutoringSubscription.upsert({
        where: { studentId },
        create: {
          studentId,
          plan: data.plan || 'standard',
          startDate,
          endDate,
          glassesDeviceId: data.glassesDeviceId,
          watchDeviceId: data.watchDeviceId,
        },
        update: {
          plan: data.plan || 'standard',
          status: 'active',
          endDate,
          glassesDeviceId: data.glassesDeviceId,
          watchDeviceId: data.watchDeviceId,
        },
      });
    });
  }

  /** 查询学生辅导服务状态 */
  async getSubscription(studentId: number) {
    const sub = await this.prisma.tutoringSubscription.findUnique({
      where: { studentId },
      include: { student: { include: { class: true } } },
    });

    // 检查是否过期
    if (sub && sub.status === 'active' && new Date() > sub.endDate) {
      await this.prisma.tutoringSubscription.update({
        where: { studentId },
        data: { status: 'expired' },
      });
      sub.status = 'expired';
    }
    return sub;
  }

  /** 学校所有辅导订阅 */
  async listSubscriptions(schoolId: number) {
    return this.prisma.tutoringSubscription.findMany({
      where: { student: { class: { grade: { schoolId } } } },
      include: { student: { include: { class: { include: { grade: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 停用辅导服务 */
  async cancelSubscription(studentId: number) {
    const sub = await this.prisma.tutoringSubscription.findUnique({ where: { studentId } });
    if (!sub) throw new BadRequestException('该学生暂无辅导订阅记录');
    return this.prisma.tutoringSubscription.update({
      where: { studentId },
      data: { status: 'cancelled' },
    });
  }

  // ==================== 穿戴设备管理 ====================

  /** 注册穿戴设备 */
  async registerDevice(data: { schoolId: number; type: string; serialNumber: string; model?: string }) {
    return this.prisma.device.create({
      data: {
        schoolId: data.schoolId,
        type: data.type,
        serialNumber: data.serialNumber,
        model: data.model,
        status: 'offline',
      },
    });
  }

  /** 设备列表（可按类型筛选） */
  async listDevices(schoolId: number, type?: string) {
    // 穿戴设备仅 glasses/watch；若指定 type 则在该集合内进一步过滤
    const where: any = {
      schoolId,
      type: type ? type : { in: ['glasses', 'watch'] },
    };
    return this.prisma.device.findMany({
      where,
      include: { student: true },
    });
  }

  /** 设备心跳/上线 */
  async deviceHeartbeat(serialNumber: string) {
    const device = await this.prisma.device.findUnique({ where: { serialNumber } });
    if (!device) throw new NotFoundException('设备未注册');
    return this.prisma.device.update({
      where: { serialNumber },
      data: { status: 'online' },
    });
  }

  // ==================== 辅导会话 ====================

  /** 开始辅导会话 */
  async startSession(studentId: number) {
    // 校验订阅
    const sub = await this.getSubscription(studentId);
    if (!sub || sub.status !== 'active') {
      throw new BadRequestException('辅导服务未开通或已过期');
    }

    // 先把该学生所有未关闭的 active 会话标记为 ended，避免残留多个 active 会话
    await this.prisma.tutoringSession.updateMany({
      where: { studentId, status: 'active' },
      data: { status: 'ended', endedAt: new Date() },
    });

    const session = await this.prisma.tutoringSession.create({
      data: { studentId, status: 'active' },
    });

    // 近视提醒：若开启偏好且上一段辅导连续超过 40 分钟，提示眼睛休息
    await this.maybeRecordMyopiaReminder(studentId);

    return session;
  }

  // 连续辅导过久 → 近视/用眼休息提醒
  private async maybeRecordMyopiaReminder(studentId: number) {
    const pref = await this.prisma.studentPreference.findFirst({ where: { studentId } });
    if (pref && pref.myopiaReminder === false) return; // 显式关闭则不提醒

    // 上一段已结束的辅导会话，若时长超过 40 分钟则提醒
    const lastSession = await this.prisma.tutoringSession.findFirst({
      where: { studentId, status: 'ended', endedAt: { not: null } },
      orderBy: { endedAt: 'desc' },
    });
    if (!lastSession || !lastSession.endedAt) return;

    const minutes = (lastSession.endedAt.getTime() - lastSession.startedAt.getTime()) / 60000;
    if (minutes > 40) {
      await this.prisma.myopiaReminder.create({
        data: {
          studentId,
          lessonRecordId: null,
          type: 'eye_rest',
        },
      });
    }
  }

  /**
   * 记录「是否按提醒休息」反馈（PRD §24.7）
   * 眼镜/手表端在提醒展示后调用：学生休息了 → rested=true；忽略提醒继续用眼 → rested=false
   */
  async reportMyopiaRested(studentId: number, reminderId: number, rested: boolean) {
    const reminder = await this.prisma.myopiaReminder.findUnique({ where: { id: reminderId } });
    if (!reminder) throw new NotFoundException('提醒记录不存在');
    if (reminder.studentId !== studentId) throw new BadRequestException('提醒不属于该学生');

    return this.prisma.myopiaReminder.update({
      where: { id: reminderId },
      data: { rested, restedAt: new Date() },
    });
  }

  /** 近视提醒依从性统计：按提醒休息的比例（家长端/管理端展示用） */
  async myopiaComplianceStats(studentId: number) {
    const [total, rested] = await Promise.all([
      this.prisma.myopiaReminder.count({ where: { studentId, rested: { not: null } } }),
      this.prisma.myopiaReminder.count({ where: { studentId, rested: true } }),
    ]);
    return {
      totalReminders: total,
      restedCount: rested,
      complianceRate: total ? Math.round((rested / total) * 100) : null,
    };
  }

  /**
   * 辅导对话：学生提问 → LLM → 回答
   * 实际链路：眼镜/手表采集音频 → ASR 转文字 → 本接口 → LLM → TTS 播放
   */
  async chat(sessionId: number, message: string) {
    const session = await this.prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: {
        tutoringMessages: { orderBy: { createdAt: 'asc' }, take: 10 },
        student: { include: { class: { include: { grade: { select: { schoolId: true } } } } } },
      },
    });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.status !== 'active') throw new BadRequestException('会话已结束');

    // 保存学生消息
    await this.prisma.tutoringMessage.create({
      data: { sessionId, role: 'student', content: message },
    });

    // 构造上下文
    const history = session.tutoringMessages.map((m) => ({
      role: m.role as 'student' | 'assistant',
      content: m.content,
    }));
    history.push({ role: 'student', content: message });

    // 调用 LLM（辅导场景：耐心讲解、引导思考、不直接给答案）
    const systemPrompt = `你是一名耐心的一对一辅导老师。学生正在通过智能眼镜/手表向你提问。
要求：
1. 先理解学生的问题，判断知识点薄弱环节
2. 用启发式方法引导学生思考，而不是直接给答案
3. 讲解简洁明了，适合语音播报（每段不超过100字）
4. 如果学生连续答错，换一种方式讲解
5. 鼓励学生，语气温和`;

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role === 'student' ? 'user' : 'assistant', content: m.content })),
    ];
    const schoolId = session.student?.class?.grade?.schoolId ?? null;
    const reply = await this.llm.chat(llmMessages, { schoolId });

    // 保存 AI 回复
    const saved = await this.prisma.tutoringMessage.create({
      data: { sessionId, role: 'assistant', content: reply },
    });

    // 记录学科练习：每次学生提问都留痕，能判断对错则标记，否则留空待后续完善
    await this.recordPractice(sessionId, message, reply);

    return {
      messageId: saved.id,
      reply,
      // TTS 由客户端（眼镜/手表）拿到 reply 后调用语音合成播放
      ttsText: reply,
    };
  }

  // 练习记录：尝试从回复中判断对错，无法判断则 isCorrect 留空
  private async recordPractice(sessionId: number, studentMessage: string, reply: string) {
    let isCorrect: boolean | null = null;
    if (/正确|答对了|回答正确|没错|对的/.test(reply)) isCorrect = true;
    else if (/错误|不对|答错了|不正确|再想想/.test(reply)) isCorrect = false;

    await this.prisma.practiceRecord.create({
      data: {
        sessionId,
        subject: 'general',
        question: studentMessage.slice(0, 100),
        userAnswer: studentMessage.slice(0, 500),
        correctAnswer: reply.slice(0, 500),
        isCorrect,
      },
    });
  }

  /** 结束辅导会话 */
  async endSession(sessionId: number) {
    return this.prisma.tutoringSession.update({
      where: { id: sessionId },
      data: { status: 'ended', endedAt: new Date() },
    });
  }

  /** 学生辅导历史 */
  async sessionHistory(studentId: number, limit = 20) {
    return this.prisma.tutoringSession.findMany({
      where: { studentId },
      include: { tutoringMessages: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /** 学生学科练习记录（PracticeRecord） */
  async practiceHistory(studentId: number, limit = 100) {
    return this.prisma.practiceRecord.findMany({
      where: { session: { studentId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** 辅导统计（用于展示和分享） */
  async tutoringStats(studentId: number) {
    const sessions = await this.prisma.tutoringSession.findMany({
      where: { studentId, status: 'ended', endedAt: { not: null } },
    });
    const totalMinutes = sessions.reduce((sum, s) => {
      if (s.endedAt) {
        return sum + Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60000);
      }
      return sum;
    }, 0);
    const questionCount = await this.prisma.tutoringMessage.count({
      where: { session: { studentId }, role: 'student' },
    });

    return {
      totalSessions: sessions.length,
      totalMinutes,
      totalQuestions: questionCount,
      avgMinutesPerSession: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
    };
  }
}
