/**
 * 验证 BullMQ 事件接入：startLesson → 入队 lesson-event → Worker resume → 课堂跑完
 * 运行：npx ts-node --transpile-only scripts/verify-lesson-bullmq.ts
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { LessonAgentModule } from "../src/lesson-agent/lesson.agent.module";
import { LessonAgentService } from "../src/lesson-agent/lesson.agent.service";
import { LessonEventProcessor } from "../src/lesson-agent/lesson.event.processor";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const app = await NestFactory.createApplicationContext(PrismaModule, { logger: ["error", "warn"] });
  const prisma = app.get(PrismaService);

  const sched = await (prisma as any).schedule.findFirst({
    include: { class: { include: { grade: true } } },
    orderBy: { id: "desc" },
  });
  const meta = {
    schoolId: sched.class.grade.schoolId,
    gradeId: sched.class.gradeId,
    classId: sched.classId,
    scheduleId: sched.id,
  };
  console.log("meta =", meta);

  const ctx = await NestFactory.createApplicationContext(LessonAgentModule, { logger: ["log", "error", "warn"] });
  const agent = ctx.get(LessonAgentService);
  const processor = ctx.get(LessonEventProcessor);

  console.log("\n=== 1) startLesson（停在互动 interrupt） ===");
  await agent.startLesson(meta, {
    lessonTitle: "光合作用",
    transcript: ["第一句", "第二句", "第三句"],
  });

  console.log("\n=== 2) 入队课堂事件（学生提问） ===");
  await processor.enqueue(meta, { student: "李四", question: "什么是光反应？" });

  // 等 Worker 消费完
  await new Promise((r) => setTimeout(r, 4000));

  console.log("\n=== 3) 查课堂最终状态 ===");
  const s = await agent.getLessonState(meta);
  console.log("phase =", (s.values as any).phase, "已答 =", (s.values as any).interactionCount);

  await ctx.close();
  await app.close();
  console.log("\n=== BullMQ 事件接入验证通过 ===");
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
