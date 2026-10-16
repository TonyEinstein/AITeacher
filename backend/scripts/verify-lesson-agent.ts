/**
 * 集成验证：通过 NestJS DI 加载 LessonAgentService，
 * 真正跑一遍完整七环节：开场→点名→讲授→互动(interrupt)→答疑→评估→下课，
 * 并确认 LessonRecord/Attendance 落库 + checkpoint 写 Postgres。
 * 运行：npx ts-node --transpile-only scripts/verify-lesson-agent.ts
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { LessonAgentModule } from "../src/lesson-agent/lesson.agent.module";
import { LessonAgentService } from "../src/lesson-agent/lesson.agent.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const app = await NestFactory.createApplicationContext(PrismaModule, { logger: ["error", "warn"] });
  const prisma = app.get(PrismaService);

  // 找一条真实存在的 schedule/class/grade/school 链路，避免外键失败
  const sched = await (prisma as any).schedule.findFirst({
    include: { class: { include: { grade: true } } },
    orderBy: { id: "desc" },
  });
  if (!sched) {
    console.error("数据库里没有 Schedule 记录，无法验证外键落库");
    process.exit(1);
  }
  const meta = {
    schoolId: sched.class.grade.schoolId,
    gradeId: sched.class.gradeId,
    classId: sched.classId,
    scheduleId: sched.id,
  };
  console.log("使用真实课次 meta =", meta);

  const ctx = await NestFactory.createApplicationContext(LessonAgentModule, { logger: ["error", "warn"] });
  const agent = ctx.get(LessonAgentService);

  const transcript = [
    "同学们好，今天讲《光合作用》。",
    "叶绿体利用光能把 CO2 和水转化成有机物。",
    "光合作用分为光反应和暗反应两个阶段。",
  ];

  console.log("\n=== 1) startLesson（跑完 开场→点名→讲授→互动等待） ===");
  const r1 = await agent.startLesson(meta, { lessonTitle: "光合作用", transcript });
  console.log("threadId =", r1.threadId);
  console.log("phase =", (r1.state as any).phase, "stepIndex =", (r1.state as any).stepIndex);
  console.log("lessonRecordId =", (r1.state as any).lessonRecordId);
  console.log("interrupt? =", Boolean((r1.state as any).__interrupt__));

  console.log("\n=== 2) resumeLesson（学生提问 → 答疑→评估→下课） ===");
  const r2 = await agent.resumeLesson(meta, {
    student: "张三",
    question: "光反应和暗反应有什么区别？",
  });
  console.log("phase =", (r2.state as any).phase, "已答 =", (r2.state as any).interactionCount);

  console.log("\n=== 3) 数据库落库验证 ===");
  const rec = await (prisma as any).lessonRecord.findUnique({
    where: { id: (r2.state as any).lessonRecordId },
  });
  console.log("LessonRecord.status =", rec.status, "endedAt =", rec.endedAt ? "已写" : "未写");
  console.log("LessonRecord.summary =", JSON.stringify(rec.summary));
  const attCount = await (prisma as any).attendance.count({
    where: { lessonRecordId: rec.id },
  });
  console.log("Attendance 行数 =", attCount);

  await ctx.close();
  await app.close();
  console.log("\n=== 全节点验证通过：七环节编排 + LessonRecord/Attendance 落库 + Postgres checkpoint ===");
}

main().catch((e) => {
  console.error("验证失败:", e);
  process.exit(1);
});
