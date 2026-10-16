/**
 * 调课端到端验证（PRD §3.15 整体顺延 / §3.23 临时停课）
 *
 * 覆盖：
 *  - 整体顺延：只挪范围内「未开始且未取消」的课，已取消/已完成的不动
 *  - 临时停课：置 cancelled + 记录原因；可选补课并溯源到原课
 *  - 单节改时间：同班冲突检测（背靠背不算冲突）
 *  - 参数边界：天数非正、停已完成课、改已完成课
 *
 * 运行：npx ts-node --transpile-only scripts/verify-schedule-adjust.ts
 *
 * 说明：脚本在 2027-03 这个未来窗口内造课表，运行前会清理该窗口的测试数据，
 *      不影响种子数据与真实课表。
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulesService } from '../src/schedules/schedules.service';

/** 测试窗口：远离种子数据的未来月份 */
const WIN_START = '2027-03-01T00:00:00.000Z';
const WIN_END = '2027-04-01T00:00:00.000Z';

@Module({
  imports: [PrismaModule],
  providers: [SchedulesService],
})
class VerifyModule {}

function line(t = '') {
  console.log(t);
}

let failed = 0;
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`);
  if (!cond) failed += 1;
}

async function expectThrow(fn: () => Promise<any>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (e: any) {
    return e?.message ?? String(e);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(VerifyModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const schedules = app.get(SchedulesService);

  // ---------- 0. 准备 ----------
  const klass = await prisma.class.findFirst({
    where: { students: { some: {} } },
    include: { grade: true },
    orderBy: { id: 'desc' },
  });
  if (!klass) throw new Error('库里没有带学生的 Class，请先执行 prisma db seed');

  // 清理该窗口内的历史测试数据。
  // 注意：其他验证脚本可能把 LessonRecord 挂到这些课表上，直接删 Schedule 会外键冲突，
  // 因此要按依赖顺序先清子表；补课的自关联也要先断开。
  const testScheduleIds = (
    await prisma.schedule.findMany({
      where: {
        classId: klass.id,
        startTime: { gte: new Date(WIN_START), lt: new Date(WIN_END) },
      },
      select: { id: true },
    })
  ).map((s) => s.id);

  let cleanedRecords = 0;
  if (testScheduleIds.length) {
    const recordIds = (
      await prisma.lessonRecord.findMany({
        where: { scheduleId: { in: testScheduleIds } },
        select: { id: true },
      })
    ).map((r) => r.id);

    if (recordIds.length) {
      // BehaviorEvent / Warning / MyopiaReminder 未声明级联删除，需显式清理
      await prisma.behaviorEvent.deleteMany({ where: { lessonRecordId: { in: recordIds } } });
      await prisma.warning.deleteMany({ where: { lessonRecordId: { in: recordIds } } });
      await prisma.myopiaReminder.deleteMany({ where: { lessonRecordId: { in: recordIds } } });
      await prisma.attendance.deleteMany({ where: { lessonRecordId: { in: recordIds } } });
      await prisma.evaluation.deleteMany({ where: { lessonRecordId: { in: recordIds } } });
      await prisma.classMinuteAggregate.deleteMany({ where: { lessonRecordId: { in: recordIds } } });
      await prisma.lessonRecord.deleteMany({ where: { id: { in: recordIds } } });
      cleanedRecords = recordIds.length;
    }

    // 先断开补课自关联，否则删原课会违反外键
    await prisma.schedule.updateMany({
      where: { originalScheduleId: { in: testScheduleIds } },
      data: { originalScheduleId: null },
    });
    await prisma.schedule.deleteMany({ where: { id: { in: testScheduleIds } } });
  }

  line(`班级「${klass.name}」（schoolId=${klass.grade.schoolId}）`);
  line(`已清理该班 2027-03 窗口内测试数据：课表 ${testScheduleIds.length} 条 / 课堂记录 ${cleanedRecords} 条`);

  const mk = (day: number, hour: number, status = 'scheduled') => ({
    schoolId: klass.grade.schoolId,
    classId: klass.id,
    startTime: new Date(`2027-03-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`),
    endTime: new Date(`2027-03-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:45:00.000Z`),
    status,
  });

  const s1 = await prisma.schedule.create({ data: mk(1, 8) });
  const s2 = await prisma.schedule.create({ data: mk(2, 8) });
  const s3 = await prisma.schedule.create({ data: mk(3, 8) });
  const s4 = await prisma.schedule.create({ data: mk(4, 8) });
  await prisma.schedule.create({ data: mk(5, 8, 'cancelled') });
  await prisma.schedule.create({ data: mk(6, 8, 'completed') });
  line(`已造 6 节课表（4 节 scheduled / 1 节 cancelled / 1 节 completed）`);

  // ---------- 1. 整体顺延 ----------
  line();
  line('=== 整体顺延 7 天 ===');
  const result = await schedules.postpone({
    scope: 'class',
    targetId: klass.id,
    fromDate: WIN_START,
    days: 7,
  });
  line(`  候选 ${result.candidateCount} 节，顺延 ${result.shifted} 节，跳过 ${result.skipped} 节`);
  for (const it of result.items) {
    line(`    #${it.id} ${it.from} → ${it.to}`);
  }
  line();

  ok(result.shifted === 4, `应顺延 4 节，实际 ${result.shifted}`);
  ok(result.skipped === 2, `应跳过 2 节（已取消/已完成），实际 ${result.skipped}`);

  const moved1 = await prisma.schedule.findUnique({ where: { id: s1.id } });
  ok(
    moved1?.startTime.toISOString() === '2027-03-08T08:00:00.000Z',
    `#${s1.id} 应挪到 03-08 08:00，实际 ${moved1?.startTime.toISOString()}`,
  );
  ok(
    moved1?.endTime.toISOString() === '2027-03-08T08:45:00.000Z',
    '结束时间应同步后移，时长不变',
  );
  const untouchedCancelled = await prisma.schedule.findFirst({
    where: { classId: klass.id, status: 'cancelled', startTime: { gte: new Date(WIN_START) } },
  });
  ok(
    untouchedCancelled?.startTime.toISOString() === '2027-03-05T08:00:00.000Z',
    '已取消的课不应被顺延',
  );

  const badDays = await expectThrow(() =>
    schedules.postpone({ scope: 'class', targetId: klass.id, fromDate: WIN_START, days: 0 }),
  );
  ok(/正整数/.test(badDays), `顺延 0 天应报错，实际「${badDays}」`);

  // ---------- 2. 临时停课 + 补课 ----------
  line('=== 临时停课 + 补课 ===');
  const target = await prisma.schedule.findUnique({ where: { id: s2.id } });
  const cancelled = await schedules.cancelLesson(s2.id, {
    reason: '暴雨停课',
    makeupStartTime: '2027-03-20T08:00:00.000Z',
    makeupEndTime: '2027-03-20T08:45:00.000Z',
  });
  const afterCancel = await prisma.schedule.findUnique({ where: { id: s2.id } });
  line(`  #${s2.id} status=${afterCancel?.status} reason=${afterCancel?.cancelReason}`);
  line(`  补课 #${cancelled.makeup?.id} @ ${cancelled.makeup?.startTime.toISOString()}`);
  line();

  ok(afterCancel?.status === 'cancelled', `原课应变为 cancelled，实际 ${afterCancel?.status}`);
  ok(afterCancel?.cancelReason === '暴雨停课', '应记录停课原因');
  ok(!!afterCancel?.cancelledAt, '应记录停课时间');
  ok(!!cancelled.makeup, '应生成补课记录');
  ok(
    cancelled.makeup?.originalScheduleId === s2.id,
    `补课应溯源到原课 #${s2.id}，实际 ${cancelled.makeup?.originalScheduleId}`,
  );
  ok(
    cancelled.makeup?.startTime.toISOString() === '2027-03-20T08:00:00.000Z',
    '补课时间应为指定时间',
  );
  ok(target?.startTime.getTime() !== cancelled.makeup?.startTime.getTime(), '补课时间与原课不同');

  const makeups = await schedules.findMakeups(s2.id);
  ok(makeups.length === 1, `findMakeups 应返回 1 条，实际 ${makeups.length}`);

  const doubleCancel = await expectThrow(() => schedules.cancelLesson(s2.id, {}));
  ok(/已停课/.test(doubleCancel), `重复停课应报错，实际「${doubleCancel}」`);

  const completed = await prisma.schedule.findFirst({
    where: { classId: klass.id, status: 'completed', startTime: { gte: new Date(WIN_START) } },
  });
  const cancelCompleted = await expectThrow(() => schedules.cancelLesson(completed!.id, {}));
  ok(/已完成/.test(cancelCompleted), `停已完成的课应报错，实际「${cancelCompleted}」`);

  // ---------- 3. 单节改时间 + 冲突检测 ----------
  line();
  line('=== 单节改时间与冲突检测 ===');
  const b = await prisma.schedule.findUnique({ where: { id: s3.id } });
  line(`  当前 #${s3.id} @ ${b?.startTime.toISOString()}`);

  // 与 s4（03-11 08:00-08:45，顺延后）重叠 → 应冲突
  const conflictMsg = await expectThrow(() =>
    schedules.reschedule(s3.id, '2027-03-11T08:15:00.000Z', '2027-03-11T09:00:00.000Z'),
  );
  ok(/冲突/.test(conflictMsg), `与同班课程重叠应报冲突，实际「${conflictMsg}」`);

  // 背靠背（结束 == 下一节开始）不算冲突
  const backToBack = await expectThrow(() =>
    schedules.reschedule(s3.id, '2027-03-11T07:15:00.000Z', '2027-03-11T08:00:00.000Z'),
  );
  ok(backToBack === '', `背靠背排课不应冲突，实际「${backToBack}」`);

  const movedB = await prisma.schedule.findUnique({ where: { id: s3.id } });
  ok(
    movedB?.startTime.toISOString() === '2027-03-11T07:15:00.000Z',
    '改时间应落库',
  );

  const badRange = await expectThrow(() =>
    schedules.reschedule(s3.id, '2027-03-11T09:00:00.000Z', '2027-03-11T08:00:00.000Z'),
  );
  ok(/结束时间必须晚于开始时间/.test(badRange), `结束早于开始应报错，实际「${badRange}」`);

  const rescheduleCompleted = await expectThrow(() =>
    schedules.reschedule(completed!.id, '2027-03-12T08:00:00.000Z', '2027-03-12T08:45:00.000Z'),
  );
  ok(/不允许改时间/.test(rescheduleCompleted), `改已完成的课应报错，实际「${rescheduleCompleted}」`);

  // ---------- 收尾 ----------
  line();
  line(failed ? `❌ 存在 ${failed} 项未通过断言` : '✅ 调课全链路验证通过');
  await app.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('验证失败：', e);
  process.exit(1);
});
