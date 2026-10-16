/**
 * 学生学科薄弱画像端到端验证（PRD §3.25）
 *
 * 覆盖：
 *  - 批改链路是否把题目的 knowledgePoint / subjectId 带进错题本（原实现丢弃 → 画像算不出来）
 *  - 薄弱画像按知识点聚合、排序、占比是否正确
 *  - 学情报告是否把薄弱摘要写入 StudentProfile.weaknesses
 *
 * 运行：npx ts-node --transpile-only scripts/verify-weakness-profile.ts
 *
 * 说明：脚本使用固定学号 E2E_WEAKNESS_01 的测试学生，
 *      每次运行前清空该学生的错题本，保证可重复执行且不影响其他学生。
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LlmModule } from '../src/llm/llm.module';
import { GradingService } from '../src/assignments/grading.service';
import { WrongQuestionsService } from '../src/wrong-questions/wrong-questions.service';
import { EvaluationsService } from '../src/evaluations/evaluations.service';

const TEST_STUDENT_NO = 'E2E_WEAKNESS_01';

@Module({
  imports: [PrismaModule, LlmModule],
  providers: [GradingService, WrongQuestionsService, EvaluationsService],
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
  const grading = app.get(GradingService);
  const wrongQuestions = app.get(WrongQuestionsService);
  const evaluations = app.get(EvaluationsService);

  // ---------- 1. 准备测试学生与教案 ----------
  const schedule = await prisma.schedule.findFirst({
    where: { class: { students: { some: {} } } },
    include: { class: { include: { grade: true } } },
    orderBy: { id: 'desc' },
  });
  if (!schedule) throw new Error('库里没有带学生的 Schedule，请先执行 prisma db seed');
  const klass = schedule.class;

  let plan = await prisma.lessonPlan.findFirst({ where: { subjectId: { not: undefined } } });
  if (!plan) {
    const textbook = await prisma.textbook.findFirst();
    if (!textbook) throw new Error('库里没有 Textbook/LessonPlan，无法构造作业');
    plan = await prisma.lessonPlan.create({
      data: {
        textbookId: textbook.id,
        subjectId: textbook.subjectId,
        title: 'E2E 薄弱画像课',
        chapter: 'E2E 薄弱画像课',
        status: 'confirmed',
        content: { generated: '教学过程\n用于薄弱画像验证' },
      },
    });
  }

  const student = await prisma.student.upsert({
    where: { studentNo: TEST_STUDENT_NO },
    update: { classId: klass.id },
    create: { classId: klass.id, name: '薄弱画像测试生', studentNo: TEST_STUDENT_NO },
  });
  line(`测试学生 #${student.id}（${student.studentNo}）班级「${klass.name}」`);
  line(`使用教案 #${plan.id}（学科 #${plan.subjectId}）`);

  // 清空该学生错题本，保证可重复运行
  const cleared = await prisma.wrongQuestion.deleteMany({ where: { studentId: student.id } });
  line(`已清空该学生历史错题 ${cleared.count} 条`);

  // ---------- 2. 走真实批改链路生成错题 ----------
  line();
  line('=== 批改链路（知识点是否带入错题本）===');
  const questions = [
    { type: 'choice', question: '光合作用的场所是？', options: ['叶绿体', '线粒体'], answer: '叶绿体', score: 5, knowledgePoint: '光合作用' },
    { type: 'choice', question: '光合作用释放的气体是？', options: ['氧气', '二氧化碳'], answer: '氧气', score: 5, knowledgePoint: '光合作用' },
    { type: 'choice', question: '光反应的产物是？', options: ['ATP', '葡萄糖'], answer: 'ATP', score: 5, knowledgePoint: '光反应' },
    { type: 'choice', question: '细胞呼吸的场所是？', options: ['线粒体', '核糖体'], answer: '线粒体', score: 5, knowledgePoint: '细胞呼吸' },
  ];
  const assignment = await prisma.assignment.create({
    data: {
      schoolId: klass.grade.schoolId,
      lessonPlanId: plan.id,
      title: 'E2E 薄弱画像作业',
      content: { questions },
      type: 'homework',
      status: 'closed',
    },
  });

  // 前 3 题答错，第 4 题答对
  const submission = await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      studentId: student.id,
      content: {
        answers: {
          '光合作用的场所是？': '线粒体',
          '光合作用释放的气体是？': '二氧化碳',
          '光反应的产物是？': '葡萄糖',
          '细胞呼吸的场所是？': '线粒体',
        },
      },
      status: 'submitted',
      submittedAt: new Date(),
    },
  });

  await grading.gradeSubmission(submission.id);

  const rows = await prisma.wrongQuestion.findMany({
    where: { studentId: student.id },
    orderBy: { id: 'asc' },
  });
  line(`  批改后错题本 ${rows.length} 条：`);
  for (const r of rows) {
    line(`    - [${r.knowledgePoint ?? '无知识点'}] ${r.question}`);
  }
  line();

  ok(rows.length === 3, `应有 3 道错题，实际 ${rows.length}`);
  ok(
    rows.every((r) => !!r.knowledgePoint),
    '每道错题都应带知识点（原实现丢弃该字段，导致画像无法计算）',
  );
  ok(
    rows.every((r) => r.subjectId === plan!.subjectId),
    `错题应带学科 id=${plan.subjectId}`,
  );

  // ---------- 3. 薄弱画像聚合 ----------
  line('=== 薄弱画像聚合 ===');
  const weakness = await wrongQuestions.weaknesses(student.id);
  line(`  totalWrong=${weakness.totalWrong} classified=${weakness.classified} unclassified=${weakness.unclassified}`);
  for (const it of weakness.items) {
    line(`    - ${it.knowledgePoint}: 错${it.wrongCount}题 近期${it.recentCount}题 占比${it.sharePercent}% 薄弱分${it.score}`);
  }
  line();

  ok(weakness.totalWrong === 3, `错题总数应为 3，实际 ${weakness.totalWrong}`);
  ok(weakness.unclassified === 0, `不应有无知识点错题，实际 ${weakness.unclassified}`);
  ok(weakness.items.length === 2, `应聚合出 2 个知识点，实际 ${weakness.items.length}`);
  ok(weakness.items[0].knowledgePoint === '光合作用', `最薄弱应为「光合作用」，实际「${weakness.items[0]?.knowledgePoint}」`);
  ok(weakness.items[0].wrongCount === 2, `光合作用错题数应为 2，实际 ${weakness.items[0]?.wrongCount}`);
  ok(
    weakness.items[0].sharePercent === 66.7,
    `光合作用占比应为 66.7%，实际 ${weakness.items[0]?.sharePercent}`,
  );
  ok(
    weakness.summary === '光合作用(错2题)、光反应(错1题)',
    `摘要应为「光合作用(错2题)、光反应(错1题)」，实际「${weakness.summary}」`,
  );

  // 按学科过滤也应生效（原实现 subjectId 被忽略）
  const filtered = await wrongQuestions.weaknesses(student.id, plan.subjectId!);
  ok(filtered.totalWrong === 3, '按学科过滤应命中同一批错题（subjectId 过滤已生效）');
  const otherSubject = await prisma.subject.findFirst({ where: { id: { not: plan.subjectId } } });
  if (otherSubject) {
    const empty = await wrongQuestions.weaknesses(student.id, otherSubject.id);
    ok(empty.totalWrong === 0, `按其他学科过滤应为空，实际 ${empty.totalWrong}`);
  }

  // ---------- 4. 学情报告写入画像 ----------
  line();
  line('=== 学情报告写入 StudentProfile.weaknesses ===');
  const report: any = await evaluations.studentReport(student.id);
  const profile = await prisma.studentProfile.findFirst({ where: { studentId: student.id } });
  line(`  report.weaknesses.summary = ${report?.weaknesses?.summary}`);
  line(`  StudentProfile.weaknesses = ${profile?.weaknesses}`);
  line();

  ok(!!report?.weaknesses, '学情报告应包含薄弱画像');
  ok(
    report?.weaknesses?.summary === '光合作用(错2题)、光反应(错1题)',
    '报告里的薄弱摘要应与聚合一致',
  );
  ok(
    profile?.weaknesses === '光合作用(错2题)、光反应(错1题)',
    `StudentProfile.weaknesses 应被写入，实际「${profile?.weaknesses}」`,
  );

  line();
  line(failed ? `❌ 存在 ${failed} 项未通过断言` : '✅ 薄弱画像全链路验证通过');
  await app.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('验证失败：', e);
  process.exit(1);
});
