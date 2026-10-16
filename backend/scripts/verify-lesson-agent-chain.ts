/**
 * 课堂 Agent 端到端验证：备课 → 开场 → 点名 → 讲授 → 互动 → 答疑 → 评估 → 下课
 *
 * 覆盖：
 *  - 讲稿从教案 LessonPlan.content 解析（不再依赖调用方传固定文本）
 *  - 点名考勤来源标记（device / fallback）
 *  - 灰度开关 LESSON_AGENT_ENABLED
 *  - pushEvent 事件缓冲 + 互动节点消费违纪事件
 *  - 答疑上下文（讲稿 + 学科知识点检索）
 *  - 下课节点复用 EvaluationsService 生成课后评估
 *
 * 运行：npx ts-node --transpile-only scripts/verify-lesson-agent-chain.ts
 *
 * 说明：脚本会在库里真实写入一条 LessonRecord 及配套数据，可重复运行。
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LlmModule } from '../src/llm/llm.module';
import { EvaluationsService } from '../src/evaluations/evaluations.service';
import { WrongQuestionsService } from '../src/wrong-questions/wrong-questions.service';
import { LessonAgentService } from '../src/lesson-agent/lesson.agent.service';
import { LessonRecordsService } from '../src/lesson-records/lesson-records.service';

// 只装配 Service，不加载 Controller —— 避免拉起 JwtAuthGuard 依赖链
@Module({
  imports: [PrismaModule, LlmModule],
  providers: [LessonAgentService, EvaluationsService, WrongQuestionsService, LessonRecordsService],
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

/** E2E 用的教案正文（含「教学过程」段落，供解析器提取讲稿） */
const PLAN_TEXT = [
  '教学目标',
  '理解光合作用的基本过程与意义',
  '教学重点',
  '光反应与暗反应的区别与联系',
  '教学过程',
  '导入：同学们，植物为什么是绿色的？今天我们来研究这个问题。',
  '新授：叶绿体利用光能把二氧化碳和水转化成有机物，并释放氧气。',
  '新授：光合作用分为光反应和暗反应两个阶段，光反应在类囊体薄膜上进行。',
  '小结：今天我们学习了光合作用的两个阶段，以及它们发生的场所。',
  '课堂提问',
  '光反应和暗反应分别发生在哪里？',
  '板书设计',
  '光合作用：光反应 / 暗反应',
].join('\n');

async function main() {
  const app = await NestFactory.createApplicationContext(VerifyModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const agent = app.get(LessonAgentService);
  const lessonRecords = app.get(LessonRecordsService);

  // ---------- 1. 找一条带学生的课次 ----------
  // 排除其他验证脚本在 2027 年造的测试课表，避免脚本之间互相干扰
  const schedule = await prisma.schedule.findFirst({
    where: {
      class: { students: { some: {} } },
      startTime: { lt: new Date('2027-01-01T00:00:00.000Z') },
    },
    include: { class: { include: { students: true, grade: true } } },
    orderBy: { id: 'desc' },
  });
  if (!schedule) throw new Error('库里没有带学生的 Schedule，请先执行 prisma db seed');

  const klass = schedule.class;
  const students = klass.students;
  line(`链路：学校#${klass.grade.schoolId} 年级「${klass.grade.name}」班级「${klass.name}」${students.length} 名学生`);

  // ---------- 2. 确保课次绑定了教案（讲稿来源） ----------
  let lessonPlanId = schedule.lessonPlanId;
  let subjectId: number | null = null;

  if (lessonPlanId) {
    const plan = await prisma.lessonPlan.findUnique({ where: { id: lessonPlanId } });
    subjectId = plan?.subjectId ?? null;
    line(`课次已绑定教案 #${lessonPlanId}`);
  } else {
    const textbook =
      (await prisma.textbook.findFirst({ where: { schoolId: klass.grade.schoolId } })) ??
      (await prisma.textbook.findFirst());
    if (!textbook) throw new Error('库里没有 Textbook，无法构造教案');

    const plan = await prisma.lessonPlan.create({
      data: {
        textbookId: textbook.id,
        subjectId: textbook.subjectId,
        title: 'E2E 验证课·光合作用',
        chapter: 'E2E 验证课·光合作用',
        status: 'confirmed',
        content: { generated: PLAN_TEXT },
      },
    });
    lessonPlanId = plan.id;
    subjectId = plan.subjectId;
    await prisma.schedule.update({ where: { id: schedule.id }, data: { lessonPlanId } });
    line(`已创建教案 #${lessonPlanId} 并绑定到课次 #${schedule.id}`);
  }

  // ---------- 3. 确保有知识点（答疑检索候选） ----------
  if (subjectId) {
    const kpCount = await prisma.questionBank.count({
      where: { subjectId, knowledgePoint: { not: null } },
    });
    if (!kpCount) {
      await prisma.questionBank.createMany({
        data: [
          { subjectId, question: '光合作用的场所是？', type: 'choice', answer: '叶绿体', difficulty: 1, knowledgePoint: '光合作用' },
          { subjectId, question: '光反应的产物是？', type: 'choice', answer: 'ATP和NADPH', difficulty: 2, knowledgePoint: '光反应' },
          { subjectId, question: '细胞呼吸的场所是？', type: 'choice', answer: '线粒体', difficulty: 1, knowledgePoint: '细胞呼吸' },
        ],
      });
      line('已写入 3 条知识点（供答疑检索）');
    }
  }

  const meta = {
    schoolId: klass.grade.schoolId,
    gradeId: klass.gradeId,
    classId: klass.id,
    scheduleId: schedule.id,
  };

  // ---------- 4. 灰度开关 ----------
  line();
  line('=== 灰度开关 ===');
  delete process.env.LESSON_AGENT_ENABLED;
  let rejected = false;
  try {
    await agent.startLesson(meta, { lessonTitle: '不应被启动' });
  } catch (e: any) {
    rejected = /实验态/.test(e?.message || '');
  }
  ok(rejected, '未开启 LESSON_AGENT_ENABLED 时拒绝启动课堂');

  process.env.LESSON_AGENT_ENABLED = 'true';

  // 收尾历史遗留的进行中课次（保证脚本可重复运行；不会误伤正常课堂，只处理本课次）
  const stale = await prisma.lessonRecord.findMany({
    where: { scheduleId: schedule.id, status: 'ongoing' },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.lessonRecord.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: { status: 'completed', endedAt: new Date() },
    });
    line(`已收尾 ${stale.length} 条历史遗留的进行中课次`);
  }

  // ---------- 5. 启动课堂（跑完 开场→点名→讲授→互动等待） ----------
  line();
  line('=== 启动课堂 ===');
  const started = await agent.startLesson(meta, { lessonTitle: '光合作用（E2E）' });
  const lessonRecordId = (started.state as any).lessonRecordId as number;

  line(`  threadId=${started.threadId}`);
  line(`  讲稿来源=${started.transcriptSource}，段数=${(started.state as any).transcript?.length}`);
  line(`  课堂记录 #${lessonRecordId}，phase=${(started.state as any).phase}`);
  line();

  ok(started.transcriptSource === 'lesson_plan', '讲稿应来自教案解析（lesson_plan）');
  ok(((started.state as any).transcript?.length ?? 0) > 0, '应从教案解析出讲稿段落');
  ok(!!lessonRecordId, '开场节点应创建 LessonRecord');

  const snapAfterStart = await agent.getLessonState(meta);
  ok(
    (snapAfterStart.next as string[]).includes('interaction'),
    `应停在互动节点等待提问，实际 next=${JSON.stringify(snapAfterStart.next)}`,
  );

  // ---------- 6. 行为事件：走真实的 HTTP 上报路径 ----------
  // addBehaviorEvent 的完整链路：落库 → 违纪生成 Warning → 自动转发进课堂 Agent 的 pendingEvents
  line('=== 行为事件上报（真实路径，含自动转发）===');
  const [s0, s1] = students;
  await lessonRecords.addBehaviorEvent(lessonRecordId, {
    studentId: s0.id, type: 'hand_raise', category: 'normal', time: Date.now(),
  });
  await lessonRecords.addBehaviorEvent(lessonRecordId, {
    studentId: s0.id, type: 'hand_raise', category: 'normal', time: Date.now(),
  });
  await lessonRecords.addBehaviorEvent(lessonRecordId, {
    studentId: s1.id, type: 'talking', category: 'violation', time: Date.now(),
  });

  const snapMid = await agent.getLessonState(meta);
  const pending = ((snapMid.values as any).pendingEvents ?? []) as any[];
  line(`  缓冲事件 ${pending.length} 条：${pending.map((e) => `${e.type}(${e.category})`).join(', ')}`);
  line();

  ok(pending.length === 3, `3 次上报应全部自动转发进缓冲，实际 ${pending.length}`);
  ok(
    pending.some((e) => e.type === 'talking' && e.category === 'violation'),
    '违纪事件应进入缓冲（供互动节点点名提醒）',
  );

  // 行为事件落库校验（含 category —— 原实现把 category 丢掉，HTTP 上报的违纪永远不扣分）
  const eventRows = await prisma.behaviorEvent.findMany({ where: { lessonRecordId } });
  ok(eventRows.length === 3, `行为事件应落库 3 条，实际 ${eventRows.length}`);
  ok(eventRows.every((e) => !!e.category), '每条行为事件都应带 category');
  ok(
    eventRows.find((e) => e.type === 'talking')?.category === 'violation',
    '违纪事件的 category 应为 violation',
  );
  const warningCount = await prisma.warning.count({ where: { lessonRecordId } });
  ok(warningCount >= 1, `违纪应同步生成课堂警告，实际 ${warningCount} 条`);

  // 防双写：Agent 会话进行中时，老流程再开课应被拒
  const dupMsg = await expectThrow(() => lessonRecords.startLesson(schedule.id));
  ok(
    /已有进行中的课堂记录/.test(dupMsg),
    `Agent 会话进行中时老流程开课应被拒，实际「${dupMsg}」`,
  );

  // ---------- 7. 学生提问 → 走完 答疑 → 评估 → 下课 ----------
  line();
  line('=== 学生提问 → 答疑 → 评估 → 下课 ===');
  const resumed = await agent.resumeLesson(meta, {
    student: s0.name,
    question: '光合作用的暗反应在哪里进行',
  });
  const finalPhase = (resumed.state as any).phase;
  const answer = String((resumed.state as any).interactionAnswer ?? '');
  line(`  最终 phase=${finalPhase}`);
  line(`  答疑回答：${answer.slice(0, 80)}...`);
  line();

  ok(finalPhase === 'done', `课堂应走到 done，实际 ${finalPhase}`);
  ok(answer.length > 0, '答疑节点应产出回答');
  ok(
    (resumed.state as any).pendingEvents?.length === 0,
    '互动节点消费后应清空事件缓冲',
  );

  // ---------- 8. 落库校验 ----------
  line('=== 落库校验 ===');
  const record = await prisma.lessonRecord.findUnique({
    where: { id: lessonRecordId },
    include: { attendance: true, evaluations: true },
  });
  const summary = (record?.summary ?? {}) as any;

  line(
    `  status=${record?.status} 考勤=${record?.attendance.length} 评估=${record?.evaluations.length}`,
  );
  line(`  summary=${JSON.stringify(summary)}`);
  line();

  ok(record?.status === 'completed', `LessonRecord 应为 completed，实际 ${record?.status}`);
  ok(record?.endedAt != null, '应有 endedAt');
  ok(record?.lessonPlanId === lessonPlanId, '开场节点应带出 lessonPlanId');
  ok(record?.attendance.length === students.length, `应为全班 ${students.length} 人写考勤`);
  ok(
    summary.attendanceSource === 'fallback',
    `无设备上报考勤时应标记 fallback，实际 ${summary.attendanceSource}`,
  );
  ok(summary.handRaiseCount === 2, `summary 举手数应为 2，实际 ${summary.handRaiseCount}`);

  // 讲授节点必须把讲稿逐段讲完，而不是只讲一段就跳去互动
  const expectedSteps = ((started.state as any).transcript?.length ?? 0) as number;
  ok(
    summary.stepsCovered === expectedSteps,
    `应讲完 ${expectedSteps} 段讲稿，实际 stepsCovered=${summary.stepsCovered}`,
  );
  ok(
    record?.evaluations.length === students.length,
    `下课节点应生成全班 ${students.length} 份课后评估，实际 ${record?.evaluations.length}`,
  );
  ok(summary.evaluatedStudents === students.length, 'summary 应记录已评分人数');
  ok(summary.transcriptSource === 'lesson_plan', 'summary 应记录讲稿来源');

  line();
  line(failed ? `❌ 存在 ${failed} 项未通过断言` : '✅ 课堂 Agent 全链路验证通过');
  await app.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('验证失败：', e);
  process.exit(1);
});
