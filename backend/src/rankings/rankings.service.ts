import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RankingsService {
  constructor(private prisma: PrismaService) {}

  // 班级排名
  async classRanking(classId: number) {
    const students = await this.prisma.student.findMany({
      where: { classId },
      include: { studentProfiles: true },
    });
    const ranked = students
      .map((s) => ({
        studentId: s.id,
        name: s.name,
        studentNo: s.studentNo,
        score: s.studentProfiles[0]?.overallScore || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
    return ranked;
  }

  // 年级排名
  async gradeRanking(gradeId: number) {
    const students = await this.prisma.student.findMany({
      where: { class: { gradeId } },
      include: { studentProfiles: true, class: true },
    });
    return students
      .map((s) => ({
        studentId: s.id,
        name: s.name,
        className: s.class.name,
        score: s.studentProfiles[0]?.overallScore || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // 班级整体表现
  async classPerformance(classId: number) {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { student: { classId } },
    });
    const evaluations = await this.prisma.evaluation.findMany({
      where: { student: { classId } },
    });

    const n = profiles.length || 1;
    const avgScore = Math.round(
      profiles.reduce((s, p) => s + (p.overallScore || 0), 0) / n,
    );
    const avgDiscipline = evaluations.length
      ? Math.round(evaluations.reduce((s, e) => {
          const d = e.dimensions as any;
          return s + (d?.discipline || 0);
        }, 0) / evaluations.length)
      : 0;

    // 分数段分布
    const distribution = { excellent: 0, good: 0, pass: 0, fail: 0 };
    profiles.forEach((p) => {
      const score = p.overallScore || 0;
      if (score >= 90) distribution.excellent++;
      else if (score >= 80) distribution.good++;
      else if (score >= 60) distribution.pass++;
      else distribution.fail++;
    });

    const ranking = await this.classRanking(classId);
    return {
      classId,
      studentCount: profiles.length,
      averageScore: avgScore,
      averageDiscipline: avgDiscipline,
      distribution,
      topStudents: ranking.slice(0, 10),
    };
  }

  // 年级整体表现
  async gradePerformance(gradeId: number) {
    const classes = await this.prisma.class.findMany({
      where: { gradeId },
      include: { students: { include: { studentProfiles: true } } },
    });

    const classPerfs = classes.map((c) => {
      const profiles = c.students.map((s) => s.studentProfiles[0]).filter(Boolean);
      const avg = profiles.length
        ? Math.round(profiles.reduce((s, p) => s + (p.overallScore || 0), 0) / profiles.length)
        : 0;
      return {
        classId: c.id,
        className: c.name,
        studentCount: c.students.length,
        averageScore: avg,
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    return {
      gradeId,
      classCount: classes.length,
      totalStudents: classes.reduce((s, c) => s + c.students.length, 0),
      classRankings: classPerfs.map((c, i) => ({ ...c, rank: i + 1 })),
    };
  }

  // 跨校排名（区/县 · 市 · 省 · 全国）——按学生所属学校的行政区划真实筛选
  async crossSchoolRanking(
    studentId: number,
    scope: 'county' | 'city' | 'province' | 'national' = 'city',
    page = 1,
    pageSize = 50,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { include: { grade: { include: { school: true } } } } },
    });
    const school = student?.class?.grade?.school;

    // 按 scope 构造学校筛选条件
    let schoolFilter: any = {};
    if (school && scope !== 'national') {
      if (scope === 'province') schoolFilter = { province: school.province };
      else if (scope === 'city') schoolFilter = { province: school.province, city: school.city };
      else schoolFilter = { province: school.province, city: school.city, county: school.county };
    }
    // 省市县信息缺失时降级为全国，避免筛选出空结果
    const hasAllFields = Object.keys(schoolFilter).length > 0
      && Object.values(schoolFilter).every((v) => v != null && v !== '');
    if (!hasAllFields) schoolFilter = {};
    const effectiveScope = Object.keys(schoolFilter).length ? scope : 'national';

    const profileWhere: any = Object.keys(schoolFilter).length
      ? { student: { class: { grade: { school: schoolFilter } } } }
      : {};

    // 一次性取出范围内全部成绩，内存排序（避免 DESC 下 NULL 排到最前）
    const allProfiles = await this.prisma.studentProfile.findMany({
      where: { ...profileWhere, overallScore: { not: null } },
      select: { studentId: true, overallScore: true },
      orderBy: { overallScore: 'desc' },
    });

    const total = allProfiles.length;
    const idx = allProfiles.findIndex((p) => p.studentId === studentId);
    const myScore = idx >= 0 ? allProfiles[idx].overallScore : 0;

    const skip = (page - 1) * pageSize;
    const pageItems = allProfiles.slice(skip, skip + pageSize);

    // 榜单补充学生/班级/学校名称
    const pageStudentIds = pageItems.map((p) => p.studentId);
    const pageStudents = pageStudentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: pageStudentIds } },
          select: {
            id: true,
            name: true,
            class: { select: { name: true, grade: { select: { name: true, school: { select: { name: true } } } } } },
          },
        })
      : [];
    const studentMap = new Map(pageStudents.map((s) => [s.id, s]));

    // 参与排名的学校（范围内的全部学校）
    const schools = await this.prisma.school.findMany({
      where: Object.keys(schoolFilter).length ? schoolFilter : undefined,
      select: { name: true },
    });

    return {
      scope: effectiveScope,
      requestedScope: scope,
      scopeLabel: { county: '区/县', city: '市', province: '省', national: '全国' }[effectiveScope],
      region: school
        ? { province: school.province, city: school.city, county: school.county }
        : null,
      totalParticipants: total,
      participantSchoolCount: schools.length,
      myRank: idx >= 0 ? idx + 1 : null,
      myScore,
      percentile: total && idx >= 0 ? Math.round(((total - idx) / total) * 100) : 0,
      participatingSchools: schools.map((s) => s.name),
      page,
      pageSize,
      list: pageItems.map((p, i) => {
        const st = studentMap.get(p.studentId);
        return {
          rank: skip + i + 1,
          studentId: p.studentId,
          studentName: st?.name ?? null,
          className: st?.class?.name ?? null,
          gradeName: st?.class?.grade?.name ?? null,
          schoolName: st?.class?.grade?.school?.name ?? null,
          score: p.overallScore,
        };
      }),
    };
  }
}