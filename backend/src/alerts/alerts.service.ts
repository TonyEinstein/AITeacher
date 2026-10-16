import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** 单条预警发现（未落库前） */
interface Finding {
  type: 'score_drop' | 'absence' | 'discipline' | 'attendance';
  level: 'info' | 'warning' | 'critical';
  title: string;
  content: string;
  metrics: Record<string, any>;
}

/**
 * 学生预警引擎（PRD §3.10）
 *
 * 四条规则：
 *  1. score_drop  成绩下滑   —— 最近 N 节均分较此前 N 节下降 ≥ 阈值
 *  2. absence     连续缺课   —— 最近考勤中连续 absent ≥ 阈值
 *  3. discipline  纪律频发   —— 窗口期内 Warning 扣分累计 ≥ 阈值
 *  4. attendance  出勤异常   —— 最近考勤中非正常出勤占比 ≥ 阈值
 *
 * 命中后落库 StudentAlert 并向家长/老师推送 Notification。
 * 同一学生同一类型在去重窗口内只保留一条 open 预警，避免刷屏。
 */
@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
  private timer?: NodeJS.Timeout;

  /** 规则阈值，均可通过环境变量覆盖 */
  private readonly cfg = {
    scoreDropThreshold: Number(process.env.ALERT_SCORE_DROP_THRESHOLD ?? 15),
    minLessons: Number(process.env.ALERT_MIN_LESSONS ?? 6),
    absenceStreak: Number(process.env.ALERT_ABSENCE_STREAK ?? 3),
    disciplineDeduction: Number(process.env.ALERT_DISCIPLINE_DEDUCTION ?? 10),
    disciplineWindowDays: Number(process.env.ALERT_DISCIPLINE_WINDOW_DAYS ?? 30),
    attendanceRate: Number(process.env.ALERT_ATTENDANCE_RATE ?? 40),
    dedupDays: Number(process.env.ALERT_DEDUP_DAYS ?? 7),
    scanIntervalHours: Number(process.env.ALERT_SCAN_INTERVAL_HOURS ?? 6),
  };

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.ALERT_SCAN_ENABLED === 'false') {
      this.logger.log('学生预警定时扫描已禁用（ALERT_SCAN_ENABLED=false）');
      return;
    }
    const intervalMs = this.cfg.scanIntervalHours * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.scan().catch((e) => this.logger.error(`预警定时扫描失败: ${e?.message || e}`));
    }, intervalMs);
    this.timer.unref?.();
    this.logger.log(`学生预警定时扫描已启动，每 ${this.cfg.scanIntervalHours} 小时执行一次`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ============ 扫描 ============

  /** 执行一次全量（或指定学校）扫描，返回扫描统计 */
  async scan(schoolId?: number) {
    const schools = await this.prisma.school.findMany({
      where: schoolId ? { id: schoolId } : undefined,
      select: { id: true },
    });

    let scannedStudents = 0;
    let createdAlerts = 0;

    for (const school of schools) {
      const students = await this.prisma.student.findMany({
        where: { class: { grade: { schoolId: school.id } } },
        include: {
          evaluations: { orderBy: { createdAt: 'desc' }, take: 12 },
          attendance: { orderBy: { recordedAt: 'desc' }, take: 10 },
          warnings: { orderBy: { createdAt: 'desc' }, take: 100 },
        },
      });

      for (const student of students) {
        scannedStudents += 1;
        const findings = this.evaluateStudent(student);

        for (const finding of findings) {
          // 去重：同学生同类型在窗口内已有 open 预警则跳过
          const duplicated = await this.prisma.studentAlert.findFirst({
            where: {
              studentId: student.id,
              type: finding.type,
              status: 'open',
              createdAt: { gte: this.daysAgo(this.cfg.dedupDays) },
            },
            select: { id: true },
          });
          if (duplicated) continue;

          await this.prisma.studentAlert.create({
            data: {
              studentId: student.id,
              schoolId: school.id,
              type: finding.type,
              level: finding.level,
              title: finding.title,
              content: finding.content,
              metrics: finding.metrics,
            },
          });
          // 推送给家长 / 老师（Notification 按 studentId 关联）
          await this.notifications.create({
            studentId: student.id,
            type: 'warning',
            title: finding.title,
            content: finding.content,
          });
          createdAlerts += 1;
        }
      }
    }

    if (createdAlerts) {
      this.logger.log(`预警扫描完成：新增 ${createdAlerts} 条，覆盖 ${scannedStudents} 名学生`);
    }
    return {
      scannedSchools: schools.length,
      scannedStudents,
      createdAlerts,
      scannedAt: new Date().toISOString(),
    };
  }

  /** 对单个学生的数据跑四条规则 */
  private evaluateStudent(student: any): Finding[] {
    const findings: Finding[] = [];
    const name: string = student.name;

    // 1. 成绩下滑
    const scores: number[] = student.evaluations.map((e: any) => e.score);
    if (scores.length >= this.cfg.minLessons) {
      const half = Math.floor(scores.length / 2);
      const recent = this.avg(scores.slice(0, half));
      const earlier = this.avg(scores.slice(half, half * 2));
      const delta = Math.round((earlier - recent) * 10) / 10;
      if (earlier > 0 && delta >= this.cfg.scoreDropThreshold) {
        findings.push({
          type: 'score_drop',
          level: delta >= this.cfg.scoreDropThreshold * 2 ? 'critical' : 'warning',
          title: `成绩下滑预警：${name}`,
          content: `最近 ${half} 节课平均 ${Math.round(recent)} 分，较此前 ${Math.round(earlier)} 分下降 ${delta} 分，建议及时关注。`,
          metrics: { recentAvg: Math.round(recent), earlierAvg: Math.round(earlier), delta, lessons: half },
        });
      }
    }

    // 2. 连续缺课
    const attendance: any[] = student.attendance;
    let absenceStreak = 0;
    for (const a of attendance) {
      if (a.status === 'absent') absenceStreak += 1;
      else break;
    }
    if (absenceStreak >= this.cfg.absenceStreak) {
      findings.push({
        type: 'absence',
        level: 'critical',
        title: `连续缺课预警：${name}`,
        content: `已连续 ${absenceStreak} 节课缺勤，请尽快联系家长核实情况。`,
        metrics: { streak: absenceStreak },
      });
    }

    // 3. 纪律频发
    const since = this.daysAgo(this.cfg.disciplineWindowDays);
    const recentWarnings = student.warnings.filter((w: any) => new Date(w.createdAt) >= since);
    const deduction = recentWarnings.reduce((sum: number, w: any) => sum + (w.scoreDeduction || 0), 0);
    if (deduction >= this.cfg.disciplineDeduction) {
      findings.push({
        type: 'discipline',
        level: deduction >= this.cfg.disciplineDeduction * 2 ? 'critical' : 'warning',
        title: `课堂纪律预警：${name}`,
        content: `近 ${this.cfg.disciplineWindowDays} 天累计纪律扣分 ${deduction} 分（${recentWarnings.length} 次），需加强课堂引导。`,
        metrics: { deduction, count: recentWarnings.length, windowDays: this.cfg.disciplineWindowDays },
      });
    }

    // 4. 出勤异常
    if (attendance.length >= 5) {
      const abnormal = attendance.filter((a: any) => a.status !== 'present').length;
      const rate = Math.round((abnormal / attendance.length) * 100);
      if (rate >= this.cfg.attendanceRate) {
        findings.push({
          type: 'attendance',
          level: 'warning',
          title: `出勤异常预警：${name}`,
          content: `最近 ${attendance.length} 节课中 ${abnormal} 节非正常出勤（迟到/早退/缺勤），占比 ${rate}%。`,
          metrics: { abnormal, total: attendance.length, rate },
        });
      }
    }

    return findings;
  }

  // ============ 查询与处理 ============

  async list(params: {
    schoolId?: number;
    status?: string;
    level?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;

    const where: any = {
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.level ? { level: params.level } : {}),
      ...(params.type ? { type: params.type } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.studentAlert.findMany({
        where,
        include: { student: { include: { class: { include: { grade: true } } } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.studentAlert.count({ where }),
    ]);

    return {
      list: rows.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: a.student?.name,
        studentNo: a.student?.studentNo,
        className: a.student?.class?.name,
        gradeName: a.student?.class?.grade?.name,
        type: a.type,
        level: a.level,
        title: a.title,
        content: a.content,
        metrics: a.metrics,
        status: a.status,
        handledAt: a.handledAt,
        createdAt: a.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 某学生的预警历史（供学情报告页使用） */
  async byStudent(studentId: number, limit = 20) {
    return this.prisma.studentAlert.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async stats(schoolId?: number) {
    const where: any = schoolId ? { schoolId } : {};
    const [total, open, handled, ignored] = await Promise.all([
      this.prisma.studentAlert.count({ where }),
      this.prisma.studentAlert.count({ where: { ...where, status: 'open' } }),
      this.prisma.studentAlert.count({ where: { ...where, status: 'handled' } }),
      this.prisma.studentAlert.count({ where: { ...where, status: 'ignored' } }),
    ]);

    const [byTypeRaw, byLevelRaw] = await Promise.all([
      this.prisma.studentAlert.groupBy({ by: ['type'], where, _count: { _all: true } }),
      this.prisma.studentAlert.groupBy({ by: ['level'], where, _count: { _all: true } }),
    ]);

    return {
      total,
      open,
      handled,
      ignored,
      byType: byTypeRaw.map((r) => ({ type: r.type, count: r._count._all })),
      byLevel: byLevelRaw.map((r) => ({ level: r.level, count: r._count._all })),
    };
  }

  async handle(id: number, status: 'handled' | 'ignored', handledBy?: number) {
    const alert = await this.prisma.studentAlert.findUnique({ where: { id }, select: { id: true } });
    if (!alert) throw new NotFoundException('预警记录不存在');
    return this.prisma.studentAlert.update({
      where: { id },
      data: { status, handledBy: handledBy ?? null, handledAt: new Date() },
    });
  }

  // ============ 工具 ============

  private avg(nums: number[]): number {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }
}
