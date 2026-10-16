import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 从答卷 answers Json 中提取有效分值（1~5）；无则返回空数组 */
export function extractScores(answers: unknown): number[] {
  if (answers == null || typeof answers !== 'object') return [];
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (v == null || typeof v !== 'object') return;
    const obj = v as Record<string, unknown>;
    if ('score' in obj) {
      const n = Number(obj.score);
      if (Number.isFinite(n) && n >= 1 && n <= 5) out.push(n);
    }
    for (const child of Object.values(obj)) {
      if (child && typeof child === 'object') walk(child);
    }
  };
  walk(answers);
  return out;
}

@Injectable()
export class CampusesService {
  constructor(private prisma: PrismaService) {}

  listBySchool(schoolId: number) {
    return this.prisma.campus.findMany({ where: { schoolId } });
  }

  create(data: { schoolId: number; name: string; address?: string }) {
    return this.prisma.campus.create({ data });
  }

  update(id: number, data: any) {
    return this.prisma.campus.update({ where: { id }, data });
  }

  /**
   * 跨校区汇总（PRD §3.32）
   *
   * 按校区对比本集团（schoolId）下的：学生数 / 班级数 / 年级数 / 平均成绩 /
   * 课堂评估均分 / 出勤率 / 已完成课时 / 满意度。
   *
   * 满意度口径（2026-10-10 定）：SurveyResponse.answers 内含 score 字段（1~5）的
   * 答卷计入平均；无 score 或数值越界的答卷跳过。
   *
   * 归属路径：Student → Class → Grade → Campus。
   * 未分配校区的年级归入 `campusId: null` 的「未分配」桶，不丢弃。
   */
  async groupOverview(schoolId: number) {
    const [school, campuses, grades] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true, code: true, status: true },
      }),
      this.prisma.campus.findMany({ where: { schoolId }, orderBy: { id: 'asc' } }),
      this.prisma.grade.findMany({
        where: { schoolId },
        select: { id: true, name: true, campusId: true },
      }),
    ]);

    const gradeIds = grades.map((g) => g.id);
    const classes = gradeIds.length
      ? await this.prisma.class.findMany({
          where: { gradeId: { in: gradeIds } },
          select: { id: true, gradeId: true },
        })
      : [];
    const classIds = classes.map((c) => c.id);

    const students = classIds.length
      ? await this.prisma.student.findMany({
          where: { classId: { in: classIds } },
          select: { id: true, classId: true },
        })
      : [];
    const studentIds = students.map((s) => s.id);

    const [profiles, evaluations, attendance, lessons] = await Promise.all([
      studentIds.length
        ? this.prisma.studentProfile.findMany({
            where: { studentId: { in: studentIds }, overallScore: { not: null } },
            select: { studentId: true, overallScore: true },
          })
        : Promise.resolve([] as any[]),
      studentIds.length
        ? this.prisma.evaluation.findMany({
            where: { studentId: { in: studentIds } },
            select: { studentId: true, score: true },
          })
        : Promise.resolve([] as any[]),
      studentIds.length
        ? this.prisma.attendance.findMany({
            where: { studentId: { in: studentIds } },
            select: { studentId: true, status: true },
          })
        : Promise.resolve([] as any[]),
      classIds.length
        ? this.prisma.lessonRecord.findMany({
            where: { classId: { in: classIds }, status: 'completed' },
            select: { classId: true },
          })
        : Promise.resolve([] as any[]),
    ]);

    // ---- 归属映射 ----
    const campusOfGrade = new Map<number, number | null>(grades.map((g) => [g.id, g.campusId ?? null]));
    const campusOfClass = new Map<number, number | null>(
      classes.map((c) => [c.id, campusOfGrade.get(c.gradeId) ?? null]),
    );
    const campusOfStudent = new Map<number, number | null>(
      students.map((s) => [s.id, campusOfClass.get(s.classId) ?? null]),
    );

    // ---- 分桶 ----
    const buckets = new Map<number | null, {
      studentCount: number;
      classCount: number;
      gradeCount: number;
      scoreSum: number;
      scoreCount: number;
      evalSum: number;
      evalCount: number;
      present: number;
      attendanceTotal: number;
      lessonCount: number;
    }>();

    const ensure = (key: number | null) => {
      let b = buckets.get(key);
      if (!b) {
        b = {
          studentCount: 0, classCount: 0, gradeCount: 0,
          scoreSum: 0, scoreCount: 0, evalSum: 0, evalCount: 0,
          present: 0, attendanceTotal: 0, lessonCount: 0,
        };
        buckets.set(key, b);
      }
      return b;
    };

    for (const g of grades) ensure(campusOfGrade.get(g.id) ?? null).gradeCount += 1;
    for (const c of classes) ensure(campusOfClass.get(c.id) ?? null).classCount += 1;
    for (const s of students) ensure(campusOfStudent.get(s.id) ?? null).studentCount += 1;

    for (const p of profiles) {
      const b = ensure(campusOfStudent.get(p.studentId) ?? null);
      b.scoreSum += p.overallScore ?? 0;
      b.scoreCount += 1;
    }
    for (const e of evaluations) {
      const b = ensure(campusOfStudent.get(e.studentId) ?? null);
      b.evalSum += e.score;
      b.evalCount += 1;
    }
    for (const a of attendance) {
      const b = ensure(campusOfStudent.get(a.studentId) ?? null);
      b.attendanceTotal += 1;
      if (a.status === 'present') b.present += 1;
    }
    for (const l of lessons) ensure(campusOfClass.get(l.classId) ?? null).lessonCount += 1;

    // ---- 输出 ----
    const round1 = (n: number) => Math.round(n * 10) / 10;
    const rows = [
      ...campuses.map((c) => ({ campusId: c.id as number | null, campusName: c.name, address: c.address })),
      // 未分配校区的年级单独成桶，避免数据凭空消失
      ...(buckets.has(null) ? [{ campusId: null, campusName: '未分配校区', address: null }] : []),
    ].map((c) => {
      const b = buckets.get(c.campusId) ?? ensure(c.campusId);
      return {
        campusId: c.campusId,
        campusName: c.campusName,
        address: c.address,
        studentCount: b.studentCount,
        classCount: b.classCount,
        gradeCount: b.gradeCount,
        avgScore: b.scoreCount ? round1(b.scoreSum / b.scoreCount) : null,
        avgEvaluation: b.evalCount ? round1(b.evalSum / b.evalCount) : null,
        attendanceRate: b.attendanceTotal ? Math.round((b.present / b.attendanceTotal) * 100) : null,
        completedLessons: b.lessonCount,
      };
    });

    const withScore = rows.filter((r) => r.avgScore !== null);
    const best = withScore.length
      ? withScore.reduce((a, b) => ((b.avgScore ?? 0) > (a.avgScore ?? 0) ? b : a))
      : null;
    const worst = withScore.length
      ? withScore.reduce((a, b) => ((b.avgScore ?? 0) < (a.avgScore ?? 0) ? b : a))
      : null;

    // ---- 满意度（PRD §3.32）----
    // 评分口径（2026-10-10 定）：SurveyResponse.answers 内含 score 字段（1~5 分）
    // 的答卷计入平均；无 score 或非数值的答卷跳过。answers 兼容两种形态：
    // { score: 4 } 或 { 某题: { score: 4 } }（多题取平均）。
    const surveyScores = await this.collectSurveyScores();
    const satisfactionAvg = surveyScores.length
      ? Math.round((surveyScores.reduce((s, v) => s + v, 0) / surveyScores.length) * 10) / 10
      : null;

    const totalStudents = rows.reduce((s, r) => s + r.studentCount, 0);
    const totalLessons = rows.reduce((s, r) => s + r.completedLessons, 0);

    return {
      school,
      campusCount: campuses.length,
      campuses: rows,
      summary: {
        totalCampuses: campuses.length,
        totalStudents,
        totalClasses: rows.reduce((s, r) => s + r.classCount, 0),
        totalGrades: rows.reduce((s, r) => s + r.gradeCount, 0),
        totalCompletedLessons: totalLessons,
        avgScore: withScore.length
          ? round1(withScore.reduce((s, r) => s + (r.avgScore ?? 0), 0) / withScore.length)
          : null,
        bestCampus: best ? { campusId: best.campusId, campusName: best.campusName, avgScore: best.avgScore } : null,
        worstCampus: worst ? { campusId: worst.campusId, campusName: worst.campusName, avgScore: worst.avgScore } : null,
        // 满意度（1~5 分，取有 score 字段答卷的平均）；无数据时为 null
        satisfaction: satisfactionAvg,
      },
    };
  }

  /**
   * 从问卷答卷提取满意度分值。
   * 兼容形态：{ score: n }、{ q1: { score: n }, ... }（多题取平均）、{ score: '4' }（字符串数字）。
   * 无有效分值的答卷整体跳过。
   */
  private async collectSurveyScores(): Promise<number[]> {
    const responses = await this.prisma.surveyResponse.findMany({
      select: { answers: true },
    });
    const scores: number[] = [];
    for (const r of responses) {
      const vals = extractScores(r.answers);
      if (vals.length) {
        scores.push(vals.reduce((s, v) => s + v, 0) / vals.length);
      }
    }
    return scores;
  }
}