import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export interface VisionEventDto {
  schoolId: number;
  gradeId: number;
  classId: number;
  lessonRecordId?: number;
  edgeTrackId: string;
  studentId?: number;
  behavior: string;
  category?: 'normal' | 'violation' | 'violation_conditional';
  confidence: number;
  bbox?: [number, number, number, number];
  timestamp: string;
  durationSec?: number;
  videoUrl?: string;
  snapshotUrls?: string[];
}

export interface MinuteAggregateDto {
  schoolId: number;
  gradeId: number;
  classId: number;
  lessonRecordId: number;
  minuteStart: string;
  focusCount: number;
  handRaiseCount: number;
  writingCount: number;
  talkingCount: number;
  sleepingCount: number;
  phoneCount: number;
  eatingCount: number;
  leavingCount: number;
  totalDetected: number;
}

@Injectable()
export class VisionService implements OnModuleInit {
  private readonly logger = new Logger(VisionService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly RETENTION_DAYS = 90;

  /** 最近一次聚合快照，供本地/线上排查（不参与业务判断） */
  private redis: Redis | null = null;
  /** 最近一次上报聚合的课次，用于 getEdgeConfig 暴露快照（免去环境变量配置） */
  private lastAggLessonId: number | null = null;
  private readonly AGG_SNAPSHOT_TTL_SEC = 7 * 24 * 60 * 60;
  private readonly AGG_SNAPSHOT_KEY = (lessonRecordId: number) => `vision:agg:last:${lessonRecordId}`;

  constructor(private readonly prisma: PrismaService) {}

  /** 测试注入桩用；生产走 getRedis() 懒连接 */
  setRedisForTest(client: any) {
    this.redis = client;
  }

  private getRedis(): Redis | null {
    if (this.redis) return this.redis;
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', (e: any) => this.logger.warn(`聚合快照 Redis 不可用: ${e?.message || e}`));
    } catch (e: any) {
      this.logger.warn(`聚合快照 Redis 初始化失败: ${e?.message || e}`);
      this.redis = null;
    }
    return this.redis;
  }

  onModuleInit() {
    // 每天凌晨 3 点跑一次 90 天清理
    this.scheduleDailyCleanup();
  }

  private scheduleDailyCleanup() {
    const run = async () => {
      try {
        await this.cleanupExpiredEvidence();
      } catch (e: any) {
        this.logger.error(`清理任务失败: ${e?.message || e}`);
      }
    };
    // 启动后 10 分钟先跑一次，之后每 24 小时
    setTimeout(() => {
      run();
      this.cleanupTimer = setInterval(run, 24 * 60 * 60 * 1000);
    }, 10 * 60 * 1000);
  }

  /** 删除超过 90 天的违纪事件记录（MinIO 文件由外部生命周期规则清理） */
  async cleanupExpiredEvidence() {
    const cutoff = new Date(Date.now() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.behaviorEvent.deleteMany({
      where: {
        startTime: { lt: cutoff },
        category: 'violation',
      },
    });
    this.logger.log(`90 天清理: 删除 ${result.count} 条过期违纪记录`);
    return { deleted: result.count, cutoff };
  }

  /** 接收边缘端上报的单条行为事件 */
  async ingestEvent(dto: VisionEventDto) {
    const event = await this.prisma.behaviorEvent.create({
      data: {
        lessonRecordId: dto.lessonRecordId || 0,
        studentId: dto.studentId || null,
        edgeTrackId: dto.edgeTrackId,
        type: dto.behavior,
        category: dto.category || 'normal',
        confidence: dto.confidence,
        bbox: dto.bbox ? JSON.stringify(dto.bbox) : null,
        videoUrl: dto.videoUrl || null,
        snapshotUrls: dto.snapshotUrls ? JSON.stringify(dto.snapshotUrls) : null,
        startTime: new Date(dto.timestamp),
        durationSec: dto.durationSec || null,
      },
    });

    return { ok: true, eventId: event.id };
  }

  /** 接收边缘端每分钟聚合统计 */
  async ingestMinuteAggregate(dto: MinuteAggregateDto) {
    await this.prisma.classMinuteAggregate.upsert({
      where: {
        lessonRecordId_minuteStart: {
          lessonRecordId: dto.lessonRecordId,
          minuteStart: new Date(dto.minuteStart),
        },
      },
      create: {
        lessonRecordId: dto.lessonRecordId,
        classId: dto.classId,
        gradeId: dto.gradeId,
        schoolId: dto.schoolId,
        minuteStart: new Date(dto.minuteStart),
        focusCount: dto.focusCount,
        handRaiseCount: dto.handRaiseCount,
        writingCount: dto.writingCount,
        talkingCount: dto.talkingCount,
        sleepingCount: dto.sleepingCount,
        phoneCount: dto.phoneCount,
        eatingCount: dto.eatingCount,
        leavingCount: dto.leavingCount,
        totalDetected: dto.totalDetected,
      },
      update: {
        focusCount: dto.focusCount,
        handRaiseCount: dto.handRaiseCount,
        writingCount: dto.writingCount,
        talkingCount: dto.talkingCount,
        sleepingCount: dto.sleepingCount,
        phoneCount: dto.phoneCount,
        eatingCount: dto.eatingCount,
        leavingCount: dto.leavingCount,
        totalDetected: dto.totalDetected,
      },
    });

    // 写一份快照：ClassMinuteAggregate 无对外直查接口，快照用于打通「上报 → 可见」
    this.lastAggLessonId = dto.lessonRecordId;
    try {
      const redis = this.getRedis();
      if (redis) {
        await redis.set(
          this.AGG_SNAPSHOT_KEY(dto.lessonRecordId),
          JSON.stringify(dto),
          'EX',
          this.AGG_SNAPSHOT_TTL_SEC,
        );
      }
    } catch (e: any) {
      // 快照失败不影响入库主流程
      this.logger.warn(`聚合快照写入失败: ${e?.message || e}`);
    }

    return { ok: true };
  }

  /** 查询某节课的事件流（后台报表用） */
  async listEvents(lessonRecordId: number, limit = 100) {
    return this.prisma.behaviorEvent.findMany({
      where: { lessonRecordId },
      orderBy: { startTime: 'desc' },
      take: limit,
    });
  }

  /** 查询某节课的每分钟聚合 */
  async listAggregates(lessonRecordId: number) {
    return this.prisma.classMinuteAggregate.findMany({
      where: { lessonRecordId },
      orderBy: { minuteStart: 'asc' },
    });
  }

  /** 读取某节课最近一次聚合快照（可观测性用，不参与业务判断） */
  async getLastAggregate(lessonRecordId: number): Promise<MinuteAggregateDto | null> {
    try {
      const redis = this.getRedis();
      if (!redis) return null;
      const raw = await redis.get(this.AGG_SNAPSHOT_KEY(lessonRecordId));
      return raw ? (JSON.parse(raw) as MinuteAggregateDto) : null;
    } catch (e: any) {
      this.logger.warn(`聚合快照读取失败: ${e?.message || e}`);
      return null;
    }
  }

  /** 边缘端拉取远程配置（开发阶段返回默认值，生产从 DB 读），附带最近聚合快照便于排查 */
  async getEdgeConfig(serial?: string) {
    // 取「最近一次上报聚合的课次」的快照；进程内记录，避免依赖环境变量配置
    const lastAggregates = this.lastAggLessonId
      ? await this.getLastAggregate(this.lastAggLessonId)
      : null;
    return {
      version: 'v1',
      model: { name: 'yolo26n', confidence: 0.5, iou: 0.45 },
      debounce: { sameStudentSameTypeWindowSec: 300, firstAlwaysRecord: true },
      triggerBehaviors: ['sleeping', 'using_phone', 'talking', 'eating', 'leaving_seat'],
      walkingGracePeriodSec: 900,
      evidence: { clipBeforeSec: 10, clipAfterSec: 20, snapshotCount: 3, retentionDays: 90 },
      pushIntervalSec: 1,
      aggregateIntervalSec: 60,
      lastAggregates,
      lessonContext: serial ? await this.resolveLessonContext(serial) : null,
    };
  }

  /**
   * 按盒子序列号解析当前课次上下文：Box → 教室 → 进行中的课 → 班级/年级。
   * 任一环节缺失或查询失败都降级为 null（边缘端据此跳过聚合上报），
   * 保证配置接口本身永远可用。
   */
  private async resolveLessonContext(serial: string): Promise<{
    schoolId: number;
    gradeId: number;
    classId: number;
    lessonRecordId: number;
  } | null> {
    try {
      const box = await this.prisma.box.findUnique({ where: { serialNumber: serial } });
      if (!box?.roomId) return null;

      const record = await this.prisma.lessonRecord.findFirst({
        where: {
          status: 'ongoing',
          schedule: { roomId: box.roomId },
        },
        orderBy: { startedAt: 'desc' },
        include: { schedule: { include: { class: true } } },
      });
      if (!record?.schedule?.class) return null;

      return {
        schoolId: box.schoolId,
        gradeId: record.schedule.class.gradeId,
        classId: record.classId,
        lessonRecordId: record.id,
      };
    } catch (e: any) {
      this.logger.warn(`课次上下文解析失败: ${e?.message || e}`);
      return null;
    }
  }
}
