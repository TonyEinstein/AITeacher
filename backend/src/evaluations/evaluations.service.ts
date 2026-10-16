import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WrongQuestionsService } from '../wrong-questions/wrong-questions.service';
import { computeLessonScores, inferEmotion, HOMEWORK_SAMPLE_SIZE } from './lesson-scoring';

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private prisma: PrismaService,
    private wrongQuestions: WrongQuestionsService,
  ) {}

  // 课后自动打分
  async scoreAfterLesson(lessonRecordId: number) {
    const record = await this.prisma.lessonRecord.findUnique({
      where: { id: lessonRecordId },
      include: {
        attendance: true,
        behaviorEvents: true,
        warnings: true,
        lessonPlan: true,
        class: { include: { students: true } },
      },
    });
    if (!record) return [];

    const studentIds = record.class.students.map((s) => s.id);
    const subjectId = record.lessonPlan?.subjectId ?? null;

    // 该班学生同科最近已批改作业得分，按学生分组（时间倒序），避免逐生查询
    const submissions = studentIds.length
      ? await this.prisma.submission.findMany({
          where: {
            studentId: { in: studentIds },
            score: { not: null },
            status: { in: ['graded', 'reviewed'] },
            ...(subjectId ? { assignment: { lessonPlan: { subjectId } } } : {}),
          },
          select: { studentId: true, score: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const homeworkByStudent = new Map<number, number[]>();
    for (const sub of submissions) {
      if (sub.score == null) continue;
      const arr = homeworkByStudent.get(sub.studentId) || [];
      if (arr.length < HOMEWORK_SAMPLE_SIZE) arr.push(sub.score);
      homeworkByStudent.set(sub.studentId, arr);
    }

    const results = [];
    for (const student of record.class.students) {
      const attendance = record.attendance.find((a) => a.studentId === student.id);
      const events = record.behaviorEvents.filter((e) => e.studentId === student.id);
      const warnings = record.warnings.filter((w) => w.studentId === student.id);

      // 仅违纪类事件参与纪律扣分；正常行为（focus/hand_raise/…）不扣分
      const violationEventCount = events.filter((e) => e.category === 'violation').length;
      const handRaiseCount = events.filter((e) => e.type === 'hand_raise').length;
      const warningDeduction = warnings.reduce((s, w) => s + (w.scoreDeduction || 0), 0);

      const { overall, dimensions } = computeLessonScores({
        attendanceStatus: attendance?.status ?? null,
        violationEventCount,
        warningDeduction,
        handRaiseCount,
        behaviorEventCount: events.length,
        homeworkScores: homeworkByStudent.get(student.id) || [],
      });

      // 避免重复打分：若该学生本节课已有 evaluation 则更新，否则新建
      const comment = this.generateComment(dimensions, events);
      const emotion = inferEmotion({
        violationEventCount,
        warningDeduction,
        discipline: dimensions.discipline,
        participation: dimensions.participation,
      });

      const existing = await this.prisma.evaluation.findFirst({
        where: { lessonRecordId, studentId: student.id },
      });
      // Prisma 的 Json 字段不接受具名接口类型，在边界处显式转换
      const dimensionsJson = dimensions as unknown as Prisma.InputJsonValue;
      const evaluation = existing
        ? await this.prisma.evaluation.update({
            where: { id: existing.id },
            data: { score: overall, dimensions: dimensionsJson, comment, emotion },
          })
        : await this.prisma.evaluation.create({
            data: {
              lessonRecordId,
              studentId: student.id,
              score: overall,
              dimensions: dimensionsJson,
              comment,
              emotion,
            },
          });
      results.push(evaluation);
    }

    // 刷新学生画像总分，使班级/年级/跨校排名在打分后立即可用
    await this.refreshProfiles(record.class.students.map((s) => s.id));

    this.logger.log(`课后打分完成: ${results.length} 名学生`);
    return results;
  }

  /**
   * 用该生全部 Evaluation 的平均分刷新 StudentProfile.overallScore。
   * 排名（classRanking/crossSchoolRanking）读的是 StudentProfile，
   * 若不在打分后刷新，上完课排名仍为 0。
   * rank / trend 由 studentReport 维护，这里只更新总分。
   */
  private async refreshProfiles(studentIds: number[]) {
    if (!studentIds.length) return;

    const evals = await this.prisma.evaluation.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, score: true },
    });

    const agg = new Map<number, { sum: number; count: number }>();
    for (const e of evals) {
      const a = agg.get(e.studentId) || { sum: 0, count: 0 };
      a.sum += e.score;
      a.count += 1;
      agg.set(e.studentId, a);
    }

    for (const studentId of studentIds) {
      const a = agg.get(studentId);
      if (!a || !a.count) continue;
      const overallScore = Math.round((a.sum / a.count) * 10) / 10;

      const existing = await this.prisma.studentProfile.findFirst({ where: { studentId } });
      if (existing) {
        await this.prisma.studentProfile.update({
          where: { id: existing.id },
          data: { overallScore },
        });
      } else {
        await this.prisma.studentProfile.create({ data: { studentId, overallScore } });
      }
    }
  }

  private generateComment(dims: any, events: any[]): string {
    const parts: string[] = [];
    if (dims.attendance >= 100) parts.push('出勤正常');
    if (dims.discipline >= 90) parts.push('课堂纪律良好');
    else if (dims.discipline < 70) parts.push('需注意课堂纪律');
    if (dims.participation >= 90) parts.push('积极参与课堂互动');
    if (dims.homework >= 90) parts.push('作业完成优秀');
    return parts.join('，') || '表现正常';
  }

  // 学生综合评估报告
  async studentReport(studentId: number, startDate?: string, endDate?: string) {
    const where: any = { studentId };
    if (startDate && endDate) {
      where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const evaluations = await this.prisma.evaluation.findMany({
      where,
      include: { lessonRecord: { include: { schedule: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const scores = evaluations.map((e) => e.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // 维度均分
    const dims = { attendance: 0, discipline: 0, participation: 0, homework: 0 };
    evaluations.forEach((e) => {
      const d = e.dimensions as any;
      dims.attendance += d.attendance || 0;
      dims.discipline += d.discipline || 0;
      dims.participation += d.participation || 0;
      dims.homework += d.homework || 0;
    });
    Object.keys(dims).forEach((k) => {
      dims[k as keyof typeof dims] = evaluations.length
        ? Math.round((dims[k as keyof typeof dims] / evaluations.length) * 10) / 10
        : 0;
    });

    // 情绪分布（PRD §3.28）
    const emotionDistribution = { positive: 0, neutral: 0, negative: 0 };
    evaluations.forEach((e) => {
      const emo = e.emotion as keyof typeof emotionDistribution;
      if (emo && emotionDistribution[emo] !== undefined) emotionDistribution[emo] += 1;
    });

    // 考试成绩
    const examScores = await this.prisma.score.findMany({
      where: { studentId },
      include: { exam: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 班级排名：一次性查出全班所有学生的 evaluation，避免 N+1
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { include: { students: true } } },
    });

    let classRank = null;
    if (student?.class?.students?.length) {
      const classStudentIds = student.class.students.map((s) => s.id);
      const allEvals = await this.prisma.evaluation.findMany({
        where: { studentId: { in: classStudentIds } },
        select: { studentId: true, score: true },
      });
      // 内存聚合每个学生的平均分
      const sumMap = new Map<number, { sum: number; count: number }>();
      for (const e of allEvals) {
        const agg = sumMap.get(e.studentId) || { sum: 0, count: 0 };
        agg.sum += e.score;
        agg.count += 1;
        sumMap.set(e.studentId, agg);
      }
      const allAvg = classStudentIds.map((sid) => {
        const agg = sumMap.get(sid);
        return { id: sid, avg: agg && agg.count ? agg.sum / agg.count : 0 };
      });
      allAvg.sort((a, b) => b.avg - a.avg);
      classRank = allAvg.findIndex((a) => a.id === studentId) + 1;
    }

    // 更新学生画像
    const profileData = {
      overallScore: Math.round(avg * 10) / 10,
      rank: classRank,
      trend: { scores: scores.slice(-20) },
    };
    const existingProfile = await this.prisma.studentProfile.findFirst({ where: { studentId } });
    if (existingProfile) {
      await this.prisma.studentProfile.update({ where: { id: existingProfile.id }, data: profileData });
    } else {
      await this.prisma.studentProfile.create({ data: { studentId, ...profileData } });
    }

    // 同步刷新薄弱画像（按知识点聚合错题），写入 StudentProfile.weaknesses
    let weaknesses: Awaited<ReturnType<WrongQuestionsService['refreshProfileWeaknesses']>> | null = null;
    try {
      weaknesses = await this.wrongQuestions.refreshProfileWeaknesses(studentId);
    } catch (e: any) {
      this.logger.warn(`薄弱画像刷新失败: ${e?.message || e}`);
    }

    return {
      studentId,
      totalLessons: evaluations.length,
      averageScore: Math.round(avg * 10) / 10,
      dimensions: dims,
      emotions: {
        distribution: emotionDistribution,
        latest: evaluations.length ? evaluations[evaluations.length - 1].emotion : null,
      },
      classRank,
      classSize: student?.class?.students?.length || 0,
      weaknesses,
      trend: scores.slice(-20),
      recentExams: examScores,
      evaluations: evaluations.slice(-10),
    };
  }

  // 学生预警（分页）
  async warnings(schoolId: number, page = 1, pageSize = 20) {
    const students = await this.prisma.student.findMany({
      where: { class: { grade: { schoolId } } },
      include: { class: true, evaluations: { take: 10, orderBy: { createdAt: 'desc' } } },
    });

    const warningList = [];
    for (const s of students) {
      const alerts: string[] = [];
      const scores = s.evaluations.map((e) => e.score);

      if (scores.length >= 3) {
        const recent = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const earlier = scores.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, scores.length - 3);
        if (earlier > 0 && recent < earlier - 15) alerts.push('成绩明显下滑');
      }

      const lowDiscipline = s.evaluations.filter((e) => {
        const d = e.dimensions as any;
        return d.discipline < 60;
      }).length;
      if (lowDiscipline >= 3) alerts.push('纪律问题频发');

      if (alerts.length) {
        warningList.push({
          studentId: s.id,
          studentName: s.name,
          className: s.class?.name,
          alerts,
          latestScore: scores[0],
        });
      }
    }

    const total = warningList.length;
    const start = (page - 1) * pageSize;
    return { list: warningList.slice(start, start + pageSize), total, page, pageSize };
  }
}
