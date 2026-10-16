import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 学科专项练习（PRD §3.19）：朗读打卡 / 默写 / 口语跟读 / 单词听写
 *
 * 复用 PracticeRecord 表（sessionId 关联辅导会话），
 * 用 practiceType 区分专项类型；tutoring 自由问答不带 practiceType。
 *
 * 口径：每条记录一次练习；正确率 = isCorrect 为 true 的占比（null 不计入分母）。
 */

/** 合法的专项练习类型 */
export const PRACTICE_TYPES = ['reading', 'dictation', 'oral', 'spelling'] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

@Injectable()
export class PracticeService {
  constructor(private prisma: PrismaService) {}

  /** 提交一次专项练习记录 */
  async record(input: {
    sessionId: number;
    practiceType: PracticeType;
    subject?: string;
    question: string;
    userAnswer: string;
    correctAnswer?: string;
    isCorrect?: boolean | null;
  }) {
    if (!PRACTICE_TYPES.includes(input.practiceType)) {
      throw new BadRequestException(
        `practiceType 必须是 ${PRACTICE_TYPES.join('/')} 之一`,
      );
    }
    const session = await this.prisma.tutoringSession.findUnique({
      where: { id: input.sessionId },
    });
    if (!session) throw new NotFoundException('辅导会话不存在');

    return this.prisma.practiceRecord.create({
      data: {
        sessionId: input.sessionId,
        subject: input.subject || 'general',
        practiceType: input.practiceType,
        question: input.question.slice(0, 500),
        userAnswer: (input.userAnswer || '').slice(0, 500),
        correctAnswer: (input.correctAnswer || '').slice(0, 500),
        isCorrect: input.isCorrect ?? null,
      },
    });
  }

  /** 学生专项练习历史（可按类型过滤） */
  async history(studentId: number, practiceType?: PracticeType, limit = 100) {
    return this.prisma.practiceRecord.findMany({
      where: {
        session: { studentId },
        ...(practiceType ? { practiceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** 学生分类型统计：各类型的练习次数与正确率 */
  async studentStats(studentId: number) {
    const records = await this.prisma.practiceRecord.findMany({
      where: { session: { studentId }, practiceType: { not: null } },
      select: { practiceType: true, isCorrect: true, createdAt: true },
    });

    const byType = new Map<string, { total: number; correct: number; judged: number; lastAt: Date | null }>();
    for (const r of records) {
      const key = r.practiceType as string;
      const cur = byType.get(key) ?? { total: 0, correct: 0, judged: 0, lastAt: null };
      cur.total += 1;
      if (r.isCorrect !== null) {
        cur.judged += 1;
        if (r.isCorrect) cur.correct += 1;
      }
      if (!cur.lastAt || r.createdAt > cur.lastAt) cur.lastAt = r.createdAt;
      byType.set(key, cur);
    }

    const types = [...byType.entries()].map(([type, v]) => ({
      type,
      total: v.total,
      correctRate: v.judged ? Math.round((v.correct / v.judged) * 100) : null,
      lastAt: v.lastAt?.toISOString() ?? null,
    }));

    // 朗读打卡连续天数（reading 类型按天去重后算尾部连续）
    const readingDays = new Set(
      records
        .filter((r) => r.practiceType === 'reading')
        .map((r) => r.createdAt.toISOString().slice(0, 10)),
    );
    let streak = 0;
    const day = new Date();
    // 从今天往回数；今天没练不打断（今天还没结束）
    if (!readingDays.has(day.toISOString().slice(0, 10))) day.setDate(day.getDate() - 1);
    while (readingDays.has(day.toISOString().slice(0, 10))) {
      streak += 1;
      day.setDate(day.getDate() - 1);
    }

    return { types, readingStreakDays: streak };
  }
}
