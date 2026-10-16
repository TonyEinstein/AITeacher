import { Annotation } from "@langchain/langgraph";

/**
 * 课堂 Agent 状态（对应方案的 LessonState）
 * - 框架自动在每个节点结束后把这份状态快照写进 checkpointer
 * - 多租户隔离靠 thread_id（见 LessonAgentService.buildThreadKey），不靠字段
 */
export const LessonState = Annotation.Root({
  // ---- 课次元数据（启动时写入，全程不变）----
  schoolId: Annotation<number>(),
  gradeId: Annotation<number>(),
  classId: Annotation<number>(),
  scheduleId: Annotation<number>(),
  lessonTitle: Annotation<string>(),

  // 开场节点创建的课堂记录 id（后续节点落库用）
  lessonRecordId: Annotation<number>(),

  // ---- 课堂进度 ----
  phase: Annotation<string>(), // opening / rollcall / lecture / interaction / qa / evaluation / closing
  stepIndex: Annotation<number>(), // 讲到讲稿第几步
  transcript: Annotation<string[]>(), // 课前预生成/缓存的讲稿段落
  transcriptSource: Annotation<string>(), // 讲稿来源：lesson_plan / caller / empty
  attendanceSource: Annotation<string>(), // 考勤来源：device（设备上报）/ fallback（无上报时兜底全勤）

  // ---- 互动 ----
  interactionQuestion: Annotation<string>(), // 学生当前提问
  interactionAnswer: Annotation<string>(), // AI 答疑结果
  interactionCount: Annotation<number>(), // 本课已答疑次数

  // ---- 行为事件缓冲（边缘设备上报的行为事件队列）----
  pendingEvents: Annotation<
    { type: string; studentId?: number; category?: string; at: string }[]
  >(),
});

export type LessonStateType = typeof LessonState.State;
