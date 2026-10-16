import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SharesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成学生成绩分享快照（永久不变）
   */
  async createStudentSnapshot(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: { include: { grade: true } },
        evaluations: { orderBy: { createdAt: 'desc' }, take: 20 },
        scores: { include: { exam: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        studentProfiles: true,
        tutoringSubscription: true,
      },
    });
    if (!student) throw new NotFoundException('学生不存在');

    // 计算综合评分
    const evals = student.evaluations || [];
    const avg = evals.length
      ? Math.round(evals.reduce((s, e) => s + (e.score || 0), 0) / evals.length)
      : 0;

    // 维度均分
    const dims = { attendance: 0, discipline: 0, participation: 0, homework: 0 };
    if (evals.length) {
      const sums = { attendance: 0, discipline: 0, participation: 0, homework: 0 };
      evals.forEach((e) => {
        const d = (e.dimensions as any) || {};
        sums.attendance += d.attendance || 0;
        sums.discipline += d.discipline || 0;
        sums.participation += d.participation || 0;
        sums.homework += d.homework || 0;
      });
      dims.attendance = Math.round(sums.attendance / evals.length);
      dims.discipline = Math.round(sums.discipline / evals.length);
      dims.participation = Math.round(sums.participation / evals.length);
      dims.homework = Math.round(sums.homework / evals.length);
    }

    // 班级排名
    const classMates = await this.prisma.studentProfile.findMany({
      where: { student: { classId: student.classId } },
      orderBy: { overallScore: 'desc' },
    });
    const myProfile = classMates.find((p) => p.studentId === studentId);
    const classRank = myProfile ? classMates.indexOf(myProfile) + 1 : 0;

    // 查询学校名称
    let schoolName = '';
    if (student.class.grade.schoolId) {
      const school = await this.prisma.school.findUnique({
        where: { id: student.class.grade.schoolId },
        select: { name: true },
      });
      schoolName = school?.name || '';
    }

    const content = {
      kind: 'student',
      student: {
        name: student.name,
        className: `${student.class.grade.name}${student.class.name}`,
        schoolName,
      },
      averageScore: avg,
      classRank,
      classSize: classMates.length,
      dimensions: dims,
      recentExams: (student.scores || []).map((s) => ({
        name: s.exam?.name || '',
        score: s.score,
        level: s.level,
      })),
      tutoring: student.tutoringSubscription
        ? {
            active: student.tutoringSubscription.status === 'active',
            plan: student.tutoringSubscription.plan,
          }
        : null,
      generatedAt: new Date().toISOString(),
      brand: 'AI Teacher 智能教学',
    };

    return this.prisma.shareSnapshot.create({
      data: { type: 'student', targetId: studentId, content: content as any },
    });
  }

  /**
   * 生成班级/年级/学校分享快照
   */
  async createGroupSnapshot(type: 'class' | 'grade' | 'school', targetId: number) {
    // 班级快照
    if (type === 'class') {
      const cls = await this.prisma.class.findUnique({
        where: { id: targetId },
        include: { grade: { include: { school: true } }, students: { include: { studentProfiles: true } } },
      });
      if (!cls) throw new NotFoundException('班级不存在');

      const profiles = cls.students
        .map((s) => s.studentProfiles?.[0])
        .filter(Boolean)
        .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

      const avg = profiles.length
        ? Math.round(profiles.reduce((s, p) => s + (p.overallScore || 0), 0) / profiles.length)
        : 0;

      const content = {
        kind: 'class',
        name: `${cls.grade.name}${cls.name}`,
        schoolName: cls.grade.school?.name || '',
        studentCount: cls.students.length,
        averageScore: avg,
        topStudents: profiles.slice(0, 5).map((p, i) => {
          const stu = cls.students.find((s) => s.id === p.studentId);
          return {
            rank: i + 1,
            name: stu?.name || '学生' + p.studentId,
            score: p.overallScore,
          };
        }),
        generatedAt: new Date().toISOString(),
        brand: 'AI Teacher 智能教学',
      };

      return this.prisma.shareSnapshot.create({
        data: { type, targetId, content: content as any },
      });
    }

    // 年级/学校快照（简化）
    const content = {
      kind: type,
      targetId,
      generatedAt: new Date().toISOString(),
      brand: 'AI Teacher 智能教学',
    };
    return this.prisma.shareSnapshot.create({
      data: { type, targetId, content: content as any },
    });
  }

  /**
   * 免登录查看快照（公开接口）
   */
  async viewSnapshot(id: number) {
    const snapshot = await this.prisma.shareSnapshot.findUnique({ where: { id } });
    if (!snapshot) throw new NotFoundException('分享不存在或已失效');

    // 浏览量 +1
    await this.prisma.shareSnapshot.update({
      where: { id },
      data: { visitorCount: { increment: 1 } },
    });

    return snapshot;
  }

  /**
   * 留资提交（公开接口）
   */
  async submitLead(snapshotId: number, data: { name?: string; phone: string; company?: string; message?: string }) {
    return this.prisma.lead.create({
      data: {
        shareSnapshotId: snapshotId,
        name: data.name,
        phone: data.phone,
        company: data.company,
        message: data.message,
      },
    });
  }

  /**
   * 查看所有留资（管理员）
   */
  async listLeads() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * 分享传播数据看板（PRD §3.29）：按学校聚合
   *
   * 学校归属判定：ShareSnapshot.content.kind 为 student 时 targetId 是学生，
   * 经 Student → Class → Grade → schoolId 追溯；class/grade/school 快照
   * targetId 直接是对应实体 id，同样可追溯 schoolId。无法归属的归「未知」桶。
   */
  async schoolDashboard(schoolId: number, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await this.prisma.shareSnapshot.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true, type: true, targetId: true, visitorCount: true, createdAt: true,
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 学校归属映射
    const studentIds = snapshots.filter((s) => s.type === 'student').map((s) => s.targetId);
    const classIds = snapshots.filter((s) => s.type === 'class').map((s) => s.targetId);
    const gradeIds = snapshots.filter((s) => s.type === 'grade').map((s) => s.targetId);

    const [students, classes, grades] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, class: { select: { grade: { select: { id: true, schoolId: true } } } } },
          })
        : Promise.resolve([] as any[]),
      classIds.length
        ? this.prisma.class.findMany({
            where: { id: { in: classIds } },
            select: { id: true, grade: { select: { id: true, schoolId: true } } },
          })
        : Promise.resolve([] as any[]),
      gradeIds.length
        ? this.prisma.grade.findMany({
            where: { id: { in: gradeIds } },
            select: { id: true, schoolId: true },
          })
        : Promise.resolve([] as any[]),
    ]);

    const schoolOfSnapshot = new Map<number, number | null>();
    const gradeSchool = new Map<number, number | null>(grades.map((g) => [g.id, g.schoolId]));
    const classSchool = new Map<number, number | null>(classes.map((c) => [c.id, c.grade.schoolId]));
    for (const s of snapshots) {
      if (s.type === 'student') {
        const stu = students.find((x) => x.id === s.targetId);
        schoolOfSnapshot.set(s.id, stu ? stu.class.grade.schoolId : null);
      } else if (s.type === 'class') {
        schoolOfSnapshot.set(s.id, classSchool.get(s.targetId) ?? null);
      } else if (s.type === 'grade') {
        schoolOfSnapshot.set(s.id, gradeSchool.get(s.targetId) ?? null);
      } else if (s.type === 'school') {
        schoolOfSnapshot.set(s.id, s.targetId);
      } else {
        schoolOfSnapshot.set(s.id, null);
      }
    }

    const mine = snapshots.filter((s) => schoolOfSnapshot.get(s.id) === schoolId);
    const totalVisits = mine.reduce((sum, s) => sum + s.visitorCount, 0);
    const totalLeads = mine.reduce((sum, s) => sum + s._count.leads, 0);

    // 按天趋势（浏览量）
    const byDay = new Map<string, number>();
    for (const s of mine) {
      const key = s.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + s.visitorCount);
    }
    const trend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, visits]) => ({ date, visits }));

    // 按类型分布
    const byType: Record<string, { count: number; visits: number }> = {};
    for (const s of mine) {
      byType[s.type] = byType[s.type] ?? { count: 0, visits: 0 };
      byType[s.type].count += 1;
      byType[s.type].visits += s.visitorCount;
    }

    // 转化率：留资数 / 浏览量
    return {
      schoolId,
      windowDays: days,
      snapshotCount: mine.length,
      totalVisits,
      totalLeads,
      conversionRate: totalVisits ? Math.round((totalLeads / totalVisits) * 1000) / 10 : null,
      byType,
      trend,
    };
  }
}
