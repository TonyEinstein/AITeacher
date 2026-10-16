import { Module } from "@nestjs/common";
import { LessonAgentService } from "./lesson.agent.service";
import { LessonEventProcessor } from "./lesson.event.processor";
import { LlmModule } from "../llm/llm.module";
import { PrismaModule } from "../prisma/prisma.module";
import { EvaluationsModule } from "../evaluations/evaluations.module";

/**
 * 课堂 Agent 模块
 * 编排：LangGraph 状态机（框架）
 * 业务：节点函数体（自己写）
 * 持久化：PostgresSaver（框架自动建表）
 * 事件：BullMQ lesson-event 队列 → resume 课堂会话
 * 评估：下课节点复用 EvaluationsService 的课后打分（与 lesson-records 流程同一套逻辑）
 */
@Module({
  imports: [LlmModule, PrismaModule, EvaluationsModule],
  providers: [LessonAgentService, LessonEventProcessor],
  exports: [LessonAgentService, LessonEventProcessor],
})
export class LessonAgentModule {}
