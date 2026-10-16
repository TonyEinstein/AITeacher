import { Test, TestingModule } from '@nestjs/testing';
import { VisionService } from './vision.service';
import { PrismaService } from '../prisma/prisma.service';

/** 最小 Redis 桩：只实现快照所需能力，避免测试连真实 Redis */
class RedisStub {
  store = new Map<string, string>();
  async set(k: string, v: string) {
    this.store.set(k, v);
    return 'OK';
  }
  async get(k: string) {
    return this.store.get(k) ?? null;
  }
  async quit() {
    return 'OK';
  }
  on() {
    return this;
  }
}

describe('VisionService 聚合快照', () => {
  let service: VisionService;
  let redis: RedisStub;

  const dto: any = {
    schoolId: 1, gradeId: 1, classId: 1, lessonRecordId: 42,
    minuteStart: new Date('2026-10-09T10:00:00Z').toISOString(),
    focusCount: 2, handRaiseCount: 0, writingCount: 1, talkingCount: 1,
    sleepingCount: 0, phoneCount: 0, eatingCount: 0, leavingCount: 0,
    totalDetected: 3,
  };

  beforeEach(async () => {
    redis = new RedisStub();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        { provide: PrismaService, useValue: { classMinuteAggregate: { upsert: async () => ({}) } } },
      ],
    }).compile();
    service = module.get(VisionService);
    // 注入桩，避免真实 Redis 连接
    service.setRedisForTest(redis as any);
  });

  it('上报聚合后写入 Redis 快照，可按 lessonRecordId 读回', async () => {
    await service.ingestMinuteAggregate(dto);
    const got = await service.getLastAggregate(42);
    expect(got).not.toBeNull();
    expect(got!.lessonRecordId).toBe(42);
    expect(got!.focusCount).toBe(2);
    expect(got!.totalDetected).toBe(3);
  });

  it('未上报过的课次返回 null 而不是抛错', async () => {
    const got = await service.getLastAggregate(999999);
    expect(got).toBeNull();
  });

  it('getEdgeConfig 暴露 lastAggregates 且不破坏既有字段', async () => {
    await service.ingestMinuteAggregate(dto);
    const cfg: any = await service.getEdgeConfig();
    expect(cfg.version).toBe('v1');
    expect(cfg.model.name).toBe('yolo26n');
    expect(cfg.lastAggregates).not.toBeNull();
    expect(cfg.lastAggregates.focusCount).toBe(2);
  });

  it('upsert 的 update 分支与 create 分支字段全集一致（防同分钟重复上报丢字段）', async () => {
    let captured: any = null;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        {
          provide: PrismaService,
          useValue: {
            classMinuteAggregate: {
              upsert: async (args: any) => {
                captured = args;
                return {};
              },
            },
          },
        },
      ],
    }).compile();
    const svc = module.get(VisionService);
    svc.setRedisForTest(new RedisStub() as any);

    await svc.ingestMinuteAggregate(dto);

    expect(captured).not.toBeNull();
    // 计数类字段（不含 lessonRecordId/classId/gradeId/schoolId/minuteStart 这些定位字段）
    const countKeys = [
      'focusCount', 'handRaiseCount', 'writingCount', 'talkingCount',
      'sleepingCount', 'phoneCount', 'eatingCount', 'leavingCount', 'totalDetected',
    ];
    for (const k of countKeys) {
      expect(Object.keys(captured.create)).toContain(k);
      // update 分支必须同样覆盖每个计数字段，否则重复上报时该字段保持陈旧值
      expect(Object.keys(captured.update)).toContain(k);
    }
  });
});

describe('VisionService 课次上下文解析（getEdgeConfig serial 参数）', () => {
  let service: VisionService;

  /** 构造可注入的 prisma 桩：box 按 serial 返回，lessonRecord 按条件返回进行中的课 */
  function makePrismaStub(opts: {
    box?: any;
    ongoingRecord?: any;
  }) {
    return {
      box: {
        findUnique: async (args: any) =>
          args?.where?.serialNumber === opts.box?.serialNumber ? opts.box : null,
      },
      lessonRecord: {
        findFirst: async () => opts.ongoingRecord ?? null,
      },
    };
  }

  async function makeService(prismaStub: any) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();
    service = module.get(VisionService);
    service.setRedisForTest(new RedisStub() as any);
  }

  const box = { id: 7, serialNumber: 'SCH1-BOX1', schoolId: 1, roomId: 3 };
  /** service 层解析后的进行中课次形态（include schedule.class 取 gradeId） */
  const ongoingRecord = {
    id: 42,
    classId: 11,
    status: 'ongoing',
    schedule: { roomId: 3, class: { gradeId: 2 } },
  };

  it('serial 对应盒子且有进行中的课 → 返回完整 lessonContext', async () => {
    await makeService(makePrismaStub({ box, ongoingRecord }));
    const cfg: any = await service.getEdgeConfig('SCH1-BOX1');
    expect(cfg.lessonContext).toEqual({
      schoolId: 1,
      gradeId: 2,
      classId: 11,
      lessonRecordId: 42,
    });
  });

  it('不传 serial → lessonContext 为 null（兼容旧调用方）', async () => {
    await makeService(makePrismaStub({ box, ongoingRecord }));
    const cfg: any = await service.getEdgeConfig();
    expect(cfg.lessonContext).toBeNull();
  });

  it('serial 查不到盒子 → lessonContext 为 null', async () => {
    await makeService(makePrismaStub({ box, ongoingRecord }));
    const cfg: any = await service.getEdgeConfig('UNKNOWN-SERIAL');
    expect(cfg.lessonContext).toBeNull();
  });

  it('盒子未绑定教室（roomId 为空）→ lessonContext 为 null', async () => {
    await makeService(makePrismaStub({ box: { ...box, roomId: null }, ongoingRecord }));
    const cfg: any = await service.getEdgeConfig('SCH1-BOX1');
    expect(cfg.lessonContext).toBeNull();
  });

  it('教室无进行中的课 → lessonContext 为 null', async () => {
    await makeService(makePrismaStub({ box, ongoingRecord: null }));
    const cfg: any = await service.getEdgeConfig('SCH1-BOX1');
    expect(cfg.lessonContext).toBeNull();
  });

  it('解析失败时降级为 null，不影响配置其余字段', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        {
          provide: PrismaService,
          useValue: {
            box: { findUnique: async () => { throw new Error('db down'); } },
            lessonRecord: { findFirst: async () => null },
          },
        },
      ],
    }).compile();
    service = module.get(VisionService);
    service.setRedisForTest(new RedisStub() as any);
    const cfg: any = await service.getEdgeConfig('SCH1-BOX1');
    expect(cfg.lessonContext).toBeNull();
    expect(cfg.version).toBe('v1');
    expect(cfg.model.name).toBe('yolo26n');
  });
});