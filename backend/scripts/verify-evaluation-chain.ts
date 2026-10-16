/**
 * 端到端验证：造一节完整的课 → 打分 → 情绪 → 预警 → 排名
 *
 * 覆盖数据源：Attendance / BehaviorEvent(正常+违纪) / Warning / Assignment+Submission
 * 覆盖链路：EvaluationsService.scoreAfterLesson
 *          → AlertsService.scan
 *          → RankingsService.classRanking
 *
 * 运行：npx ts-node --transpile-only scripts/verify-evaluation-chain.ts
 *
 * 说明：脚本会在库里真实写入一条 LessonRecord 及其关联数据，可重复运行
 *      （每跑一次相当于多上了一节课），不需要清理。
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LlmModule } from '../src/llm/llm.module';
import { EvaluationsService } from '../src/evaluations/evaluations.service';
import { WrongQuestionsService } from '../src/wrong-questions/wrong-questions.service';
import { AlertsService } from '../src/alerts/alerts.service';
import { RankingsService } from '../src/rankings/rankings.service';
import { NotificationsService } from '../src/notifications/notifications.service';

// 只装配 Service，不加载 Controller —— 避免拉起 JwtAuthGuard 的整条依赖链
@Module({
  imports: [PrismaModule, LlmModule],
  providers: [
    EvaluationsService,
    WrongQuestionsService,
    AlertsService,
    RankingsService,
    NotificationsService,
  ],
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

async function main() {
  const app = await NestFactory.createApplicationContext(VerifyModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const evaluations = app.get(EvaluationsService);
  const alerts = app.get(AlertsService);
  const rankings = app.get(RankingsService);

  // ---------- 1. 找一条真实链路 ----------
  const withStudents = {
    class: { include: { students: true, grade: true } },
  } as const;

  const schedule =
    (await prisma.schedule.findFirst({
      where: { lessonPlanId: { not: null }, class: { students: { some: {} } } },
      include: withStudents,
      orderBy: { id: 'desc' },
    })) ||
    (await prisma.schedule.findFirst({
      where: { class: { students: { some: {} } } },
      include: withStudents,
      orderBy: { id: 'desc' },
    }));

  if (!schedule) throw new Error('库里没有带学生的 Schedule，请先执行 prisma db seed');

  const klass = schedule.class;
  const students = klass.students;
  if (students.length < 3) throw new Error(`班级学生不足 3 人（当前 ${students.length}）`);

  line(
    `链路：学校#${klass.grade.schoolId} 年级「${klass.grade.name}」班级「${klass.name}」共 ${students.length} 名学生`,
  );

  // ---------- 2. 造一节完整的课 ----------
  const record = await prisma.lessonRecord.create({
    data: {
      scheduleId: schedule.id,
      classId: klass.id,
      agentId: schedule.agentId,
      lessonPlanId: schedule.lessonPlanId,
      startedAt: new Date(Date.now() - 45 * 60 * 1000),
      endedAt: new Date(),
      status: 'completed',
      summary: { note: 'E2E 验证课程' },
    },
  });
  line(`已创建 LessonRecord #${record.id}`);

  const [good, avg, bad] = students;

  // 出勤：bad 迟到，其余正常
  await prisma.attendance.createMany({
    data: students.map((s) => ({
      lessonRecordId: record.id,
      studentId: s.id,
      status: s.id === bad.id ? 'late' : 'present',
    })),
  });

  // 行为事件：good 举手3+专注5；avg 举手1+专注4；bad 违纪2
  const events: any[] = [];
  const push = (studentId: number, type: string, category: string, n: number) => {
    for (let i = 0; i < n; i += 1) {
      events.push({
        lessonRecordId: record.id,
        studentId,
        type,
        category,
        startTime: new Date(Date.now() - (i + 1) * 60 * 1000),
      });
    }
  };
  push(good.id, 'hand_raise', 'normal', 3);
  push(good.id, 'focus', 'normal', 5);
  push(avg.id, 'hand_raise', 'normal', 1);
  push(avg.id, 'focus', 'normal', 4);
  push(bad.id, 'talking', 'violation', 2);
  await prisma.behaviorEvent.createMany({ data: events });
  line(`已写入 ${events.length} 条行为事件（含 ${2} 条违纪）`);

  // 违纪事件同步生成 Warning（模拟 lesson-records 的行为）
  await prisma.warning.create({
    data: {
      lessonRecordId: record.id,
      studentId: bad.id,
      type: 'discipline',
      content: '课堂讲话，扣1分',
      scoreDeduction: 1,
    },
  });

  // 作业：三名学生各造 2 条已批改 Submission
  // 注意：Assignment.lessonPlanId 可空；即使课次未绑教案也要造作业数据，
  //       否则 homework 永远走默认分，验证不到真实路径。
  {
    const assignment = await prisma.assignment.create({
      data: {
        schoolId: klass.grade.schoolId,
        lessonPlanId: schedule.lessonPlanId ?? null,
        title: 'E2E 验证作业',
        content: { questions: [] },
        type: 'homework',
        status: 'closed',
      },
    });
    const scorePlan: Array<[number, number[]]> = [
      [good.id, [95, 92]],
      [avg.id, [80, 78]],
      [bad.id, [60, 55]],
    ];
    const subs: any[] = [];
    for (const [sid, list] of scorePlan) {
      for (const sc of list) {
        subs.push({
          assignmentId: assignment.id,
          studentId: sid,
          score: sc,
          status: 'reviewed',
          submittedAt: new Date(),
        });
      }
    }
    await prisma.submission.createMany({ data: subs });
    line(`已写入 ${subs.length} 条已批改作业`);
  }

  // ---------- 3. 打分 ----------
  line();
  line('=== 课后打分 ===');
  const results: any[] = await evaluations.scoreAfterLesson(record.id);
  const byId = new Map<number, any>(results.map((e: any) => [e.studentId, e]));

  const g = byId.get(good.id);
  const b = byId.get(bad.id);

  line(`  ${good.name}: score=${g?.score} dims=${JSON.stringify(g?.dimensions)} emotion=${g?.emotion}`);
  line(`  ${bad.name}: score=${b?.score} dims=${JSON.stringify(b?.dimensions)} emotion=${b?.emotion}`);
  line();

  ok(results.length === students.length, `全班 ${students.length} 名学生都生成了 Evaluation`);
  ok(
    g?.dimensions?.discipline === 100,
    `${good.name}（无违纪）纪律分应为 100，实际 ${g?.dimensions?.discipline}`,
  );
  ok(
    b?.dimensions?.discipline === 100 - 2 * 10 - 1,
    `${bad.name}（2 违纪 + 扣1分）纪律分应为 79，实际 ${b?.dimensions?.discipline}`,
  );
  ok(
    g?.dimensions?.participation === 100,
    `${good.name}（举手3次）参与度应为 100，实际 ${g?.dimensions?.participation}`,
  );
  ok(
    b?.dimensions?.participation === 70,
    `${bad.name}（举手0次）参与度应为 70，实际 ${b?.dimensions?.participation}`,
  );
  ok(g?.dimensions?._sources?.homework === 'submission', '作业分来源应为 submission');
  ok(g?.emotion === 'positive', `${good.name} 情绪应为 positive，实际 ${g?.emotion}`);
  ok(b?.emotion === 'negative', `${bad.name} 情绪应为 negative，实际 ${b?.emotion}`);

  // 确定性：再打一次分，结果必须完全一致
  const again: any[] = await evaluations.scoreAfterLesson(record.id);
  const g2 = again.find((e: any) => e.studentId === good.id);
  ok(g2?.score === g?.score, `重复打分结果一致（无随机性）：${g?.score} vs ${g2?.score}`);

  // ---------- 4. 预警 ----------
  line();
  line('=== 学生预警扫描 ===');
  const scan = await alerts.scan(klass.grade.schoolId);
  line(`  扫描：${scan.scannedStudents} 名学生，新增 ${scan.createdAlerts} 条预警`);
  const alertRows = await prisma.studentAlert.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  for (const a of alertRows) {
    line(`  [${a.level}] ${a.type} — ${a.content}`);
  }
  ok(true, '预警扫描未抛错（本班无触发条件属正常，规则需累计数据）');

  // ---------- 5. 排名 ----------
  line();
  line('=== 班级排名 ===');
  const rank = await rankings.classRanking(klass.id);
  for (const r of rank.slice(0, 5)) {
    line(`  #${r.rank} ${r.name} ${r.score} 分`);
  }
  ok(rank.length > 0, '班级排名返回数据');
  ok(
    rank.length < 2 || rank[0].score >= rank[rank.length - 1].score,
    '排名按分数降序',
  );
  // 打分后画像必须被刷新，否则排名恒为 0（排名读的是 StudentProfile.overallScore）
  ok(rank[0].score > 0, `打分后排名不应为 0 分，实际第一名 ${rank[0].score} 分`);
  ok(
    rank[0].studentId === good.id,
    `第一名应为表现最好的 ${good.name}，实际是 studentId=${rank[0].studentId}`,
  );
  const badRow = rank.find((r: any) => r.studentId === bad.id);
  ok(
    !!badRow && badRow.score > 0 && badRow.score < rank[0].score,
    `${bad.name} 应排在 ${good.name} 之后且分数大于 0，实际 ${badRow?.score}`,
  );

  line();
  line(failed ? `❌ 存在 ${failed} 项未通过断言` : '✅ 全链路验证通过');
  await app.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('验证失败：', e);
  process.exit(1);
});
