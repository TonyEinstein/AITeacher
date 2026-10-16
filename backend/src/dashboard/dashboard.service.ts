import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // 校级驾驶舱总览
  async schoolOverview(schoolId: number) {
    const [studentCount, classCount, gradeCount, teacherCount, boxCount, onlineBoxes, ongoingLessons] =
      await Promise.all([
        this.prisma.student.count({ where: { class: { grade: { schoolId } } } }),
        this.prisma.class.count({ where: { grade: { schoolId } } }),
        this.prisma.grade.count({ where: { schoolId } }),
        this.prisma.user.count({ where: { schoolId } }),
        this.prisma.box.count({ where: { schoolId } }),
        this.prisma.box.count({ where: { schoolId, status: 'online' } }),
        this.prisma.lessonRecord.count({ where: { status: 'ongoing', class: { grade: { schoolId } } } }),
      ]);

    // 今日课程数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLessons = await this.prisma.schedule.count({
      where: {
        schoolId,
        startTime: { gte: today, lt: tomorrow },
      },
    });

    // 待复核作业
    const pendingReview = await this.prisma.submission.count({
      where: { status: 'graded', assignment: { schoolId } },
    });

    // 各年级学生分布
    const grades = await this.prisma.grade.findMany({
      where: { schoolId },
      include: {
        classes: { include: { _count: { select: { students: true } } } },
      },
    });
    const gradeDistribution = grades.map((g) => ({
      name: g.name,
      classCount: g.classes.length,
      studentCount: g.classes.reduce((sum, c) => sum + c._count.students, 0),
    }));

    return {
      students: studentCount,
      classes: classCount,
      grades: gradeCount,
      teachers: teacherCount,
      devices: { total: boxCount, online: onlineBoxes },
      todayLessons,
      ongoingLessons,
      pendingReview,
      gradeDistribution,
    };
  }

  // 年级维度数据
  async gradeOverview(gradeId: number) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        classes: {
          include: {
            _count: { select: { students: true } },
          },
        },
      },
    });
    return grade;
  }

  // 班级表现
  async classOverview(classId: number) {
    const students = await this.prisma.student.findMany({
      where: { classId },
      include: {
        evaluations: { take: 20, orderBy: { createdAt: 'desc' } },
      },
    });

    const studentStats = students.map((s) => {
      const scores = s.evaluations.map((e) => e.score);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        id: s.id,
        name: s.name,
        studentNo: s.studentNo,
        averageScore: Math.round(avg * 10) / 10,
        latestScore: scores[0] || null,
      };
    });

    studentStats.sort((a, b) => b.averageScore - a.averageScore);

    return {
      classId,
      studentCount: students.length,
      ranking: studentStats,
    };
  }

  // 全局驾驶舱（超级管理员）——所有学校汇总；
  // 传入 schoolId 时收窄到单个集团（PRD §3.32：集团管理员只能看本集团）
  async globalOverview(schoolId?: number) {
    const schoolWhere = schoolId ? { id: schoolId } : {};
    const studentWhere = schoolId ? { class: { grade: { schoolId } } } : {};
    const classWhere = schoolId ? { grade: { schoolId } } : {};
    const gradeWhere = schoolId ? { schoolId } : {};
    const boxWhere = schoolId ? { schoolId } : {};
    const subWhere = schoolId ? { schoolId } : {};

    const [schoolCount, activeSchools, trialSchools, studentCount, classCount, gradeCount, boxCount, onlineBoxes, leadCount, activeSubscriptions] =
      await Promise.all([
        this.prisma.school.count({ where: schoolWhere }),
        this.prisma.school.count({ where: { ...schoolWhere, status: 'active' } }),
        this.prisma.school.count({ where: { ...schoolWhere, status: 'trial' } }),
        this.prisma.student.count({ where: studentWhere }),
        this.prisma.class.count({ where: classWhere }),
        this.prisma.grade.count({ where: gradeWhere }),
        this.prisma.box.count({ where: boxWhere }),
        this.prisma.box.count({ where: { ...boxWhere, status: 'online' } }),
        // 咨询留资是平台级线索，不按学校归属过滤
        this.prisma.lead.count(),
        this.prisma.subscription.count({ where: { ...subWhere, status: 'active' } }),
      ]);

    const schools = await this.prisma.school.findMany({
      where: schoolWhere,
      include: {
        grades: {
          include: {
            classes: {
              include: { _count: { select: { students: true } } },
            },
          },
        },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const schoolRanking = schools.map((s) => {
      const sc = s.grades.reduce((sum, g) => sum + g.classes.reduce((cs, c) => cs + c._count.students, 0), 0);
      return {
        id: s.id, name: s.name, code: s.code, status: s.status,
        studentCount: sc,
        classCount: s.grades.reduce((sum, g) => sum + g.classes.length, 0),
        gradeCount: s.grades.length,
        subscriptionEnd: s.subscriptions[0]?.endDate || null,
        subscriptionPlan: s.subscriptions[0]?.plan || null,
      };
    }).sort((a, b) => b.studentCount - a.studentCount);

    const now = new Date();
    const soon = new Date(now); soon.setDate(soon.getDate() + 30);
    const expiring = await this.prisma.subscription.findMany({
      where: { ...subWhere, status: 'active', endDate: { gte: now, lte: soon } },
      include: { school: { select: { name: true } } },
      orderBy: { endDate: 'asc' },
    });

    return {
      totalSchools: schoolCount, activeSchools, trialSchools,
      disabledSchools: schoolCount - activeSchools - trialSchools,
      totalStudents: studentCount, totalClasses: classCount, totalGrades: gradeCount,
      totalDevices: boxCount, onlineDevices: onlineBoxes,
      deviceOnlineRate: boxCount ? Math.round((onlineBoxes / boxCount) * 100) : 0,
      totalLeads: leadCount, activeSubscriptions,
      schoolRanking,
      expiringSubscriptions: expiring.map((s) => ({ id: s.id, schoolName: s.school?.name, endDate: s.endDate, plan: s.plan })),
    };
  }

  // 学校健康监控：超级管理员看全部学校，school_admin 只看本校
  async schoolHealth(schoolId?: number) {
    const schools = await this.prisma.school.findMany({
      where: schoolId ? { id: schoolId } : undefined,
      include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const schoolIds = schools.map((s) => s.id);

    const now = new Date();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    // 一次性批量加载所有学校的设备，避免 N+1 逐校查询
    const allBoxes = schoolIds.length
      ? await this.prisma.box.findMany({
          where: { schoolId: { in: schoolIds } },
          include: { room: true },
        })
      : [];
    const boxesBySchool = new Map<number, typeof allBoxes>();
    for (const b of allBoxes) {
      const arr = boxesBySchool.get(b.schoolId) || [];
      arr.push(b);
      boxesBySchool.set(b.schoolId, arr);
    }

    // 批量聚合工单数量（按 schoolId + status groupBy）
    const woGroups = schoolIds.length
      ? await this.prisma.workOrder.groupBy({
          by: ['schoolId', 'status'],
          where: { schoolId: { in: schoolIds } },
          _count: { _all: true },
        })
      : [];
    const woMap = new Map<string, number>();
    for (const g of woGroups) woMap.set(`${g.schoolId}:${g.status}`, g._count._all);

    const results = schools.map((s) => {
      const boxes = boxesBySchool.get(s.id) || [];
      const total = boxes.length;
      const online = boxes.filter((b) => b.status === 'online').length;
      const offline = boxes.filter((b) => b.status === 'offline').length;
      const error = boxes.filter((b) => b.status === 'error').length;
      const onlineRate = total ? Math.round((online / total) * 100) : 0;
      const faults = boxes
        .filter((b) => b.status === 'error' || b.faultCode)
        .map((b) => ({
          boxId: b.id,
          serialNumber: b.serialNumber,
          roomName: b.room?.name || null,
          faultCode: b.faultCode,
          faultMessage: b.faultMessage,
          lastErrorAt: b.lastErrorAt,
          status: b.status,
        }));

      const woPending = woMap.get(`${s.id}:pending`) || 0;
      const woProcessing = woMap.get(`${s.id}:processing`) || 0;
      const woResolved = woMap.get(`${s.id}:resolved`) || 0;

      // 健康分：满分 100，故障/离线/未处理工单扣分
      let score = 100;
      if (total === 0) score -= 20;
      score -= offline * 5;
      score -= error * 10;
      score -= (woPending + woProcessing) * 3;
      if (s.status === 'trial') score -= 5;
      if (s.status === 'disabled') score -= 40;
      const sub = s.subscriptions[0];
      if (sub?.status === 'cancelled' || sub?.status === 'expired') score -= 40;
      score = Math.max(0, Math.min(100, score));
      const healthLevel = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';

      return {
        school: { id: s.id, name: s.name, code: s.code, status: s.status, contactName: s.contactName, contactPhone: s.contactPhone },
        subscription: sub
          ? { plan: sub.plan, startDate: sub.startDate, endDate: sub.endDate, status: sub.status }
          : null,
        devices: { total, online, offline, error, onlineRate },
        faults,
        workOrders: { pending: woPending, processing: woProcessing, resolved: woResolved },
        healthScore: score,
        healthLevel,
      };
    });

    const summary = {
      totalSchools: schools.length,
      healthy: results.filter((r) => r.healthLevel === 'healthy').length,
      warning: results.filter((r) => r.healthLevel === 'warning').length,
      critical: results.filter((r) => r.healthLevel === 'critical').length,
      totalDevices: results.reduce((a, r) => a + r.devices.total, 0),
      totalFaults: results.reduce((a, r) => a + r.devices.error, 0),
      pendingWorkOrders: results.reduce((a, r) => a + r.workOrders.pending + r.workOrders.processing, 0),
    };

    return { summary, schools: results };
  }

  // LLM 用量监控：最近 30 天 UsageLog 汇总（按天、按学校）
  // 传入 schoolId 时只统计该集团（PRD §3.32：集团管理员看本集团）
  async getUsage(days = 30, schoolId?: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const baseWhere: any = { createdAt: { gte: since }, type: 'llm_api' };
    if (schoolId) baseWhere.schoolId = schoolId;

    // 用 groupBy 在数据库侧聚合，避免全量加载到内存
    const dayGroups = await this.prisma.usageLog.groupBy({
      by: ['createdAt', 'schoolId'],
      where: baseWhere,
      _sum: { amount: true },
    });
    const totalAgg = await this.prisma.usageLog.aggregate({
      where: baseWhere,
      _sum: { amount: true },
    });

    // 按天聚合（生成连续日期，缺省补 0）
    const dayMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    const bySchoolMap = new Map<number | 'none', number>();

    for (const g of dayGroups) {
      const amt = g._sum.amount || 0;
      const day = g.createdAt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + amt);
      const key = g.schoolId ?? 'none';
      bySchoolMap.set(key, (bySchoolMap.get(key) || 0) + amt);
    }
    const totalTokens = totalAgg._sum.amount || 0;

    const daily = Array.from(dayMap.entries()).map(([date, tokens]) => ({ date, tokens: Math.round(tokens) }));

    // 关联学校名称
    const schoolIds = Array.from(bySchoolMap.keys()).filter((k) => k !== 'none') as number[];
    const schools = schoolIds.length
      ? await this.prisma.school.findMany({
          where: { id: { in: schoolIds } },
          select: { id: true, name: true },
        })
      : [];
    const schoolNameMap = new Map(schools.map((s) => [s.id, s.name]));

    const bySchool = Array.from(bySchoolMap.entries())
      .map(([schoolId, tokens]) => ({
        schoolId: schoolId === 'none' ? null : schoolId,
        schoolName: schoolId === 'none' ? '未归属学校' : schoolNameMap.get(schoolId) || `学校#${schoolId}`,
        tokens: Math.round(tokens),
      }))
      .sort((a, b) => b.tokens - a.tokens);

    return {
      days,
      totalTokens: Math.round(totalTokens),
      unit: 'tokens',
      daily,
      bySchool,
    };
  }

  // 成本 ROI 报表（PRD §3.11）：AI 授课节省的人力成本 vs 订阅支出
  async roiReport(schoolId?: number) {
    // 单课时人工成本（元），可用环境变量覆盖
    const teacherCostPerLesson = Number(process.env.ROI_TEACHER_COST_PER_LESSON ?? 80);

    const schools = await this.prisma.school.findMany({
      where: schoolId ? { id: schoolId } : undefined,
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        grades: { include: { classes: { include: { _count: { select: { students: true } } } } } },
      },
    });

    // 一次性取出已完成课时，按学校在内存聚合，避免逐校查询
    const completedLessons = await this.prisma.lessonRecord.findMany({
      where: {
        status: 'completed',
        ...(schoolId ? { class: { grade: { schoolId } } } : {}),
      },
      select: { class: { select: { grade: { select: { schoolId: true } } } } },
    });
    const lessonCountBySchool = new Map<number, number>();
    for (const l of completedLessons) {
      const sid = l.class?.grade?.schoolId;
      if (sid == null) continue;
      lessonCountBySchool.set(sid, (lessonCountBySchool.get(sid) || 0) + 1);
    }

    const rows = schools.map((s) => {
      const studentCount = s.grades.reduce(
        (sum, g) => sum + g.classes.reduce((cs, c) => cs + c._count.students, 0),
        0,
      );
      const classCount = s.grades.reduce((sum, g) => sum + g.classes.length, 0);
      const lessonCount = lessonCountBySchool.get(s.id) || 0;

      const laborCostSaved = lessonCount * teacherCostPerLesson;
      const subscription = s.subscriptions[0];
      const subscriptionCost = subscription?.amount ?? 0;
      const netSaving = laborCostSaved - subscriptionCost;

      return {
        schoolId: s.id,
        schoolName: s.name,
        schoolCode: s.code,
        status: s.status,
        studentCount,
        classCount,
        lessonCount,
        laborCostSaved: Math.round(laborCostSaved),
        subscriptionCost: Math.round(subscriptionCost),
        subscriptionPlan: subscription?.plan ?? null,
        netSaving: Math.round(netSaving),
        // 投资回报率：净节省 / 订阅支出
        roiPercent: subscriptionCost > 0 ? Math.round((netSaving / subscriptionCost) * 1000) / 10 : null,
        // 生均订阅成本
        perStudentCost: studentCount ? Math.round((subscriptionCost / studentCount) * 100) / 100 : 0,
      };
    });

    rows.sort((a, b) => b.netSaving - a.netSaving);

    const totalLessons = rows.reduce((a, r) => a + r.lessonCount, 0);
    const totalLaborCostSaved = rows.reduce((a, r) => a + r.laborCostSaved, 0);
    const totalSubscriptionCost = rows.reduce((a, r) => a + r.subscriptionCost, 0);
    const totalStudents = rows.reduce((a, r) => a + r.studentCount, 0);

    return {
      summary: {
        schoolCount: rows.length,
        totalStudents,
        totalLessons,
        totalLaborCostSaved,
        totalSubscriptionCost,
        totalNetSaving: totalLaborCostSaved - totalSubscriptionCost,
        avgPerStudentCost: totalStudents
          ? Math.round((totalSubscriptionCost / totalStudents) * 100) / 100
          : 0,
        teacherCostPerLesson,
      },
      schools: rows,
    };
  }
}
