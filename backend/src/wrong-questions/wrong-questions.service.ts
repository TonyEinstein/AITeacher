import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeWeaknesses, WeaknessResult } from './weakness';

/** 参与薄弱画像统计的错题上限，避免单学生错题过多时拖慢查询 */
const MAX_SAMPLE = 2000;

@Injectable()
export class WrongQuestionsService {
  constructor(private prisma: PrismaService) {}

  findByStudent(studentId: number, subjectId?: number) {
    return this.prisma.wrongQuestion.findMany({
      // 注意：subjectId 之前被忽略（传了也不生效），此处修正
      where: { studentId, ...(subjectId ? { subjectId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // 标记已掌握（移出错题本）
  markMastered(id: number) {
    return this.prisma.wrongQuestion.delete({ where: { id } });
  }

  // 错题统计
  async stats(studentId: number, subjectId?: number) {
    const where = { studentId, ...(subjectId ? { subjectId } : {}) };
    const [total, recent] = await Promise.all([
      this.prisma.wrongQuestion.count({ where }),
      this.prisma.wrongQuestion.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    return { total, recent };
  }

  /**
   * 学科薄弱画像（PRD §3.25）：按知识点聚合错题，返回排序后的薄弱点。
   * 可选按学科过滤；口径见 `weakness.ts` 顶部说明（基于错题数，非错误率）。
   */
  async weaknesses(
    studentId: number,
    subjectId?: number,
    topN = 10,
  ): Promise<WeaknessResult & { studentId: number; subjectId: number | null }> {
    const rows = await this.prisma.wrongQuestion.findMany({
      where: { studentId, ...(subjectId ? { subjectId } : {}) },
      select: { knowledgePoint: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAMPLE,
    });
    const result = computeWeaknesses(rows, topN);
    return { ...result, studentId, subjectId: subjectId ?? null };
  }

  /**
   * 刷新学生画像里的薄弱摘要（写入 `StudentProfile.weaknesses`），并返回完整画像。
   * 摘要形如「光合作用(错3题)、细胞呼吸(错2题)」，无数据时置空。
   * 供学情报告与定时任务调用。
   */
  async refreshProfileWeaknesses(studentId: number): Promise<WeaknessResult> {
    const rows = await this.prisma.wrongQuestion.findMany({
      where: { studentId },
      select: { knowledgePoint: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAMPLE,
    });
    const result = computeWeaknesses(rows, 5);

    const existing = await this.prisma.studentProfile.findFirst({ where: { studentId } });
    if (existing) {
      await this.prisma.studentProfile.update({
        where: { id: existing.id },
        data: { weaknesses: result.summary || null },
      });
    } else {
      await this.prisma.studentProfile.create({
        data: { studentId, weaknesses: result.summary || null },
      });
    }
    return result;
  }

  /**
   * 全班薄弱分布（PRD §3.25 教师视角）
   *
   * 把全班每个学生的薄弱画像（前 N 知识点）聚合成班级视图：
   * 每个知识点统计「多少学生在错」，供老师定位共性问题。
   * 口径与单生画像一致：基于错题数，非错误率（见 weakness.ts）。
   */
  async classDistribution(classId: number, topN = 5) {
    const students = await this.prisma.student.findMany({
      where: { classId, deletedAt: null },
      select: { id: true, name: true },
    });

    // 逐生取薄弱画像前 5（复用 computeWeaknesses 口径，不重复实现聚合）
    const perStudent = await Promise.all(
      students.map(async (s) => {
        const rows = await this.prisma.wrongQuestion.findMany({
          where: { studentId: s.id },
          select: { knowledgePoint: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_SAMPLE,
        });
        const w = computeWeaknesses(rows, topN);
        return { studentId: s.id, name: s.name, topItems: w.items };
      }),
    );

    // 跨学生聚合知识点：错的学生数 + 累计错题数
    const kpAgg = new Map<string, { studentCount: number; wrongCount: number; students: string[] }>();
    for (const stu of perStudent) {
      for (const item of stu.topItems) {
        const cur = kpAgg.get(item.knowledgePoint) ?? { studentCount: 0, wrongCount: 0, students: [] };
        cur.studentCount += 1;
        cur.wrongCount += item.wrongCount;
        cur.students.push(stu.name);
        kpAgg.set(item.knowledgePoint, cur);
      }
    }

    const distribution = [...kpAgg.entries()]
      .map(([knowledgePoint, v]) => ({
        knowledgePoint,
        studentCount: v.studentCount,
        wrongCount: v.wrongCount,
        // 全班学生中错该知识点的比例
        percentOfClass: students.length
          ? Math.round((v.studentCount / students.length) * 1000) / 10
          : 0,
        students: v.students.slice(0, 20), // 防超长返回
      }))
      .sort((a, b) => b.studentCount - a.studentCount || b.wrongCount - a.wrongCount);

    return {
      classId,
      studentCount: students.length,
      distribution,
      perStudent: perStudent.map(({ studentId, name, topItems }) => ({
        studentId,
        name,
        topKnowledgePoints: topItems.map((i) => i.knowledgePoint),
      })),
    };
  }
}
