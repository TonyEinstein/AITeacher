import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStreamService } from '../media-stream/media-stream.service';

/**
 * 手写 prisma 桩：记录 findFirst / create 收到的参数，便于断言查询条件与落库字段。
 * 桩数据模拟真实链路：盒子（id=1）绑定教室（roomId=3），该教室有一节进行中的课（id=99）。
 */
function makePrismaStub(opts: { box?: any; record?: any } = {}) {
  const calls = {
    boxFindFirst: [] as any[],
    lessonRecordFindFirst: [] as any[],
    behaviorEventCreate: [] as any[],
    notificationCreate: [] as any[],
  };
  const box = opts.box ?? { id: 1, serialNumber: 'TEST-BOX-1', roomId: 3 };
  const record = opts.record ?? { id: 99, status: 'ongoing' };
  const prisma = {
    box: {
      // 盒子按序列号反查（gateway 内部使用）
      findFirst: async (args: any) => {
        calls.boxFindFirst.push(args);
        return box;
      },
    },
    lessonRecord: {
      findFirst: async (args: any) => {
        calls.lessonRecordFindFirst.push(args);
        return record;
      },
    },
    behaviorEvent: {
      create: async (args: any) => {
        calls.behaviorEventCreate.push(args);
        return {};
      },
    },
    notification: {
      create: async (args: any) => {
        calls.notificationCreate.push(args);
        return {};
      },
    },
  };
  return { calls, prisma };
}

/** 构造被测 gateway：注入 prisma 桩与空的媒体流桩，手动补上 server 桩 */
async function makeGateway(prismaStub: any) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RealtimeGateway,
      { provide: PrismaService, useValue: prismaStub },
      // 媒体流能力与本用例无关，给空桩即可
      { provide: MediaStreamService, useValue: {} },
    ],
  }).compile();
  const gateway = module.get(RealtimeGateway);
  // 测试模块不会注入 @WebSocketServer()，手动补上；to() 给广播用
  gateway.server = {
    emit: vi.fn(),
    to: () => ({ emit: vi.fn() }),
  } as any;
  return gateway;
}

/** 教室盒子 client 桩：handleEvent 从 client.data.serial 取序列号 */
function makeClientStub() {
  return { data: { serial: 'TEST-BOX-1' }, emit: vi.fn(), join: vi.fn() } as any;
}

describe('RealtimeGateway 迟到/睡觉事件落库（handleLate/handleSleep）', () => {
  it('late 事件：按 schedule.roomId 查进行中的课，并把 BehaviorEvent 挂到该课次', async () => {
    const { calls, prisma } = makePrismaStub();
    const gateway = await makeGateway(prisma);
    const client = makeClientStub();

    await gateway.handleEvent(
      { event: 'late', data: { studentId: 1, minutesLate: 5 }, timestamp: Date.now() },
      client,
    );

    // LessonRecord 模型没有 boxId 字段——where 引用不存在字段会让 Prisma
    // 运行时抛错并被外层 catch 吞掉，落库静默失效。正确条件应与
    // handleHelpKey 一致：status='ongoing' + schedule.roomId 反查进行中的课。
    expect(calls.lessonRecordFindFirst).toHaveLength(1);
    expect(calls.lessonRecordFindFirst[0].where).toEqual({
      status: 'ongoing',
      schedule: { roomId: 3 },
    });
    // 行为事件必须挂到查到的课次（id=99）上
    expect(calls.behaviorEventCreate).toHaveLength(1);
    expect(calls.behaviorEventCreate[0].data.lessonRecordId).toBe(99);
    expect(calls.behaviorEventCreate[0].data.type).toBe('late');
    expect(calls.behaviorEventCreate[0].data.studentId).toBe(1);
  });

  it('sleep 事件：按 schedule.roomId 查进行中的课，落 BehaviorEvent 并通知家长', async () => {
    const { calls, prisma } = makePrismaStub();
    const gateway = await makeGateway(prisma);
    const client = makeClientStub();

    await gateway.handleEvent(
      { event: 'sleep', data: { studentId: 1, duration: 120 }, timestamp: Date.now() },
      client,
    );

    expect(calls.lessonRecordFindFirst).toHaveLength(1);
    expect(calls.lessonRecordFindFirst[0].where).toEqual({
      status: 'ongoing',
      schedule: { roomId: 3 },
    });
    expect(calls.behaviorEventCreate).toHaveLength(1);
    expect(calls.behaviorEventCreate[0].data.lessonRecordId).toBe(99);
    expect(calls.behaviorEventCreate[0].data.type).toBe('sleeping');
    expect(calls.behaviorEventCreate[0].data.studentId).toBe(1);
    // 睡觉事件还应创建家长通知
    expect(calls.notificationCreate).toHaveLength(1);
    expect(calls.notificationCreate[0].data.studentId).toBe(1);
  });
});
