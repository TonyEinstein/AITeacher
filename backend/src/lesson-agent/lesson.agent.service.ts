/**
 * 课堂 Agent 服务（实验态 · 业务节点已接通真实数据）
 *
 * 编排：LangGraph 状态机（七节点、interrupt/resume、PostgresSaver 持久化、thread_id 多租户隔离）
 * 业务：节点函数体（开场/点名/讲授/互动/答疑/评估/下课）
 *
 * 节点数据来源（2026-09-30 完成接线）：
 *   - 开场：创建 LessonRecord，并从课次带出 lessonPlanId / agentId
 *   - 点名：优先采用设备上报考勤；无上报才兜底全勤，并标记 attendanceSource=fallback
 *   - 讲授：讲稿来自「调用方传入 > 教案 LessonPlan.content 解析 > 空」三级优先，逐段推进
 *   - 互动：interrupt 挂起等提问；等待前消费 pendingEvents 缓冲，违纪事件点名提醒
 *   - 答疑：检索本课讲稿 + 学科知识点组装上下文后问 LLM（无 Key 仍走 mock）
 *   - 评估：复用 EvaluationsService.scoreAfterLesson 生成课后评估（含画像刷新）
 *   - 下课：LessonRecord → completed
 *
 * 仍未做的（见 docs/development/lesson-agent.md）：
 *   - 生产上课流程仍由 `lesson-records.service.ts` 承载，本模块 startLesson 未被 controller 调用
 *   - 答疑依赖真实 LLM API Key 才能验证效果（当前无 Key 走 mock）
 *   - 切换到本模块需要先定好与老流程的去重/灰度策略
 *
 * 灰度开关：`LESSON_AGENT_ENABLED=true` 才允许 startLesson，默认关闭，
 * 防止误调导致与老流程双写。
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
  ConflictException,
} from "@nestjs/common";
import {
  StateGraph,
  START,
  END,
  interrupt,
  Command,
  MemorySaver,
  CompiledStateGraph,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { LessonState, LessonStateType } from "./lesson.agent.state";
import { LlmService } from "../llm/llm.service";
import { PrismaService } from "../prisma/prisma.service";
import { EvaluationsService } from "../evaluations/evaluations.service";
import { transcriptFromLessonPlanContent } from "./lesson-plan-transcript";
import { buildQaContext } from "./lesson-context";

export interface LessonMeta {
  schoolId: number;
  gradeId: number;
  classId: number;
  scheduleId: number;
}

/**
 * 课堂 Agent 服务
 * 框架（LangGraph）负责：状态机编排、checkpoint 持久化、interrupt 暂停恢复、thread 隔离
 * 业务（我们）负责：节点函数体里的开场/点名/讲授/答疑/评估/下课
 * 多租户隔离：thread_id = schoolId:gradeId:classId:scheduleId（服务端生成，不信任前端）
 *
 * 完整环节：开场 → 点名 → 讲授 → 互动(interrupt) → 答疑 → 评估 → 下课
 */
@Injectable()
export class LessonAgentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LessonAgentService.name);
  private graph!: CompiledStateGraph<LessonStateType, any, any>;
  private checkpointerName = "MemorySaver(开发降级)";

  /**
   * 运行中的课堂会话：lessonRecordId → 会话元数据。
   * 用于把边缘设备上报的课堂事件自动转发进对应会话的 pendingEvents。
   *
   * ⚠️ 单实例内存表：多实例部署时事件只会命中本进程内的会话。
   * 生产多副本需要换成 Redis/DB 共享的 lessonRecordId → threadId 映射。
   */
  private readonly activeSessions = new Map<number, LessonMeta>();

  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
    private readonly evaluations: EvaluationsService,
  ) {}

  async onModuleInit() {
    let checkpointer;
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const saver = PostgresSaver.fromConnString(dbUrl);
        await saver.setup();
        checkpointer = saver;
        this.checkpointerName = "PostgresSaver";
      } catch (e: any) {
        this.logger.warn(`PostgresSaver 初始化失败，降级 MemorySaver: ${e?.message || e}`);
        checkpointer = new MemorySaver();
      }
    } else {
      checkpointer = new MemorySaver();
    }

    const builder = new StateGraph(LessonState)
      .addNode("opening", this.openingNode.bind(this))
      .addNode("rollcall", this.rollcallNode.bind(this))
      .addNode("lecture", this.lectureNode.bind(this))
      .addNode("interaction", this.interactionNode.bind(this))
      .addNode("qa", this.qaNode.bind(this))
      .addNode("evaluation", this.evaluationNode.bind(this))
      .addNode("closing", this.closingNode.bind(this))
      .addEdge(START, "opening")
      .addEdge("opening", "rollcall")
      .addEdge("rollcall", "lecture")
      // 讲授必须逐段推进：讲稿没讲完就回到 lecture 继续，讲完才进互动。
      // （原实现是 addEdge("lecture","interaction") 无条件边，导致只讲第一段就跳走）
      .addConditionalEdges(
        "lecture",
        (state: LessonStateType) => (state.phase === "lecture" ? "lecture" : "interaction"),
        { lecture: "lecture", interaction: "interaction" }
      )
      .addEdge("interaction", "qa")
      .addEdge("qa", "evaluation")
      .addEdge("evaluation", "closing")
      .addEdge("closing", END);

    this.graph = builder.compile({ checkpointer });
    this.logger.log(`课堂 Agent 图已编译（checkpointer=${this.checkpointerName}）`);
  }

  /** 进程退出时清理运行中的会话登记，避免内存泄漏 */
  onModuleDestroy() {
    this.activeSessions.clear();
  }

  // ============ 节点 ============

  /** 开场：创建 LessonRecord(ongoing)，并从课次带出教案/Agent 关联 */
  private async openingNode(state: LessonStateType) {
    this.logger.log(`[开场] 准备上课: ${state.lessonTitle}`);
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: state.scheduleId },
      select: { lessonPlanId: true, agentId: true },
    });
    const rec = await this.prisma.lessonRecord.create({
      data: {
        scheduleId: state.scheduleId,
        classId: state.classId,
        agentId: schedule?.agentId ?? null,
        lessonPlanId: schedule?.lessonPlanId ?? null,
        startedAt: new Date(),
        status: "ongoing",
      },
    });
    // 登记运行中的会话，供视觉事件自动转发定位 thread（见 forwardEvent）
    this.activeSessions.set(rec.id, {
      schoolId: state.schoolId,
      gradeId: state.gradeId,
      classId: state.classId,
      scheduleId: state.scheduleId,
    });
    return { lessonRecordId: rec.id, phase: "rollcall" };
  }

  /**
   * 点名：优先采用设备（vision-service / 人脸）已上报的考勤；
   * 无上报数据时兜底全勤，但会标记 attendanceSource=fallback，
   * 避免把兜底数据当成真实考勤（下游打分/报表会用到）。
   */
  private async rollcallNode(state: LessonStateType) {
    const lid = state.lessonRecordId!;
    this.logger.log(`[点名] classId=${state.classId}`);

    const reported = await this.prisma.attendance.findMany({
      where: { lessonRecordId: lid },
      select: { studentId: true, status: true },
    });
    if (reported.length) {
      this.logger.log(`[点名] 采用设备上报考勤 ${reported.length} 条`);
      return { phase: "lecture", attendanceSource: "device" };
    }

    const students = await this.prisma.student.findMany({
      where: { classId: state.classId },
      select: { id: true },
    });
    if (students.length) {
      await this.prisma.attendance.createMany({
        data: students.map((s) => ({
          lessonRecordId: lid,
          studentId: s.id,
          status: "present",
        })),
      });
    }
    this.logger.warn(`[点名] 无设备上报，兜底全勤 ${students.length} 人（attendanceSource=fallback）`);
    return { phase: "lecture", attendanceSource: "fallback" };
  }

  /** 讲授：推进一步讲稿 */
  private async lectureNode(state: LessonStateType) {
    const total = (state.transcript ?? []).length;
    if (!total) {
      this.logger.warn("[讲授] 无讲稿可讲（教案未解析出内容），直接进入互动");
      return { stepIndex: 0, phase: "interaction" };
    }
    const next = Math.min((state.stepIndex ?? 0) + 1, total);
    const done = next >= total;
    this.logger.log(`[讲授] step=${next}/${total}${done ? "(讲完)" : ""}`);
    return { stepIndex: next, phase: done ? "interaction" : "lecture" };
  }

  /**
   * 互动：interrupt 等学生提问。
   * 等待前先消费 pendingEvents 缓冲 —— 违纪类事件会让数字人在本次互动中点名提醒。
   */
  private async interactionNode(state: LessonStateType) {
    const pending = state.pendingEvents ?? [];
    const violations = pending.filter((e) => e.category === "violation");
    if (violations.length) {
      const who = violations.map((e) => e.studentId ?? "某同学").join("、");
      this.logger.warn(`[互动] 缓冲内 ${violations.length} 起违纪，点名提醒：${who}`);
    }

    const incoming = interrupt({
      type: "wait_student_question",
      message: "学生可以举手提问了",
      lessonTitle: state.lessonTitle,
      // 待提醒的违纪事件一并抛出，供教室端播报
      reminders: violations.map((e) => ({ type: e.type, studentId: e.studentId })),
    }) as { student: string; question: string };

    this.logger.log(`[互动] 学生 ${incoming.student} 提问：${incoming.question}`);
    return {
      phase: "qa",
      interactionQuestion: incoming.question,
      // 事件已消费，清空缓冲
      pendingEvents: [],
    };
  }

  /**
   * 答疑：检索本课讲稿 + 学科知识点组装上下文，再交给 LLM 作答。
   * 上下文由纯函数 buildQaContext 组装（2-gram 相关度检索，无重合不硬塞）。
   */
  private async qaNode(state: LessonStateType) {
    const question = state.interactionQuestion ?? "";
    const knowledgePoints = await this.loadKnowledgePoints(state.scheduleId);
    const context = buildQaContext({
      question,
      lessonTitle: state.lessonTitle,
      transcript: state.transcript ?? [],
      knowledgePoints,
    });

    const reply = await this.llm.chat(
      [
        {
          role: "system",
          content:
            "你是一位经验丰富的课堂老师，用简洁口语回答学生提问。" +
            "只依据提供的课程资料作答；资料未覆盖时如实说明，不要编造。",
        },
        { role: "user", content: `${context}\n\n学生提问：${question}` },
      ],
      { schoolId: state.schoolId }
    );
    this.logger.log(`[答疑] 上下文 ${context.length} 字，回答：${String(reply).slice(0, 60)}...`);
    return {
      phase: "evaluation",
      interactionAnswer: reply,
      interactionCount: (state.interactionCount ?? 0) + 1,
    };
  }

  /** 取该课次所属学科的知识点（题库去重），作为答疑检索候选 */
  private async loadKnowledgePoints(scheduleId: number): Promise<string[]> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { lessonPlan: { select: { subjectId: true } } },
    });
    const subjectId = schedule?.lessonPlan?.subjectId;
    if (!subjectId) return [];

    const rows = await this.prisma.questionBank.findMany({
      where: { subjectId, knowledgePoint: { not: null } },
      select: { knowledgePoint: true },
      distinct: ["knowledgePoint"],
      take: 200,
    });
    return rows.map((r) => r.knowledgePoint).filter((k): k is string => !!k);
  }

  /** 评估：汇总课堂行为数据，写课堂小结到 LessonRecord.summary */
  private async evaluationNode(state: LessonStateType) {
    const lid = state.lessonRecordId!;

    // 1) 统计违纪事件（按类型分组）
    const violationGrouped = await this.prisma.behaviorEvent.groupBy({
      by: ["type"],
      where: { lessonRecordId: lid, category: "violation" },
      _count: { id: true },
    });
    const violations: Record<string, number> = {};
    for (const g of violationGrouped) violations[g.type] = g._count.id;

    // 2) 统计总检测人数（取最后一分钟聚合的 totalDetected）
    const lastMinute = await this.prisma.classMinuteAggregate.findFirst({
      where: { lessonRecordId: lid },
      orderBy: { minuteStart: "desc" },
    });

    // 3) 举手次数
    const handRaiseCount = await this.prisma.behaviorEvent.count({
      where: { lessonRecordId: lid, type: "hand_raise" },
    });

    // 4) 生成课后评估：复用 EvaluationsService 的打分逻辑
    //    （真实数据源 + 画像刷新，与 lesson-records 流程保持同一套口径）
    let evaluatedStudents = 0;
    try {
      const evaluations = await this.evaluations.scoreAfterLesson(lid);
      evaluatedStudents = evaluations.length;
    } catch (e: any) {
      // 打分失败不应阻断下课
      this.logger.error(`[评估] 课后打分失败：${e?.message || e}`);
    }

    const summary = {
      title: state.lessonTitle,
      stepsCovered: state.stepIndex,
      interactions: state.interactionCount ?? 0,
      answer: state.interactionAnswer ?? "",
      violations,
      handRaiseCount,
      lastDetectedStudents: lastMinute?.totalDetected ?? null,
      attendanceSource: state.attendanceSource ?? null,
      transcriptSource: state.transcriptSource ?? null,
      evaluatedStudents,
      evaluatedAt: new Date().toISOString(),
    };
    await this.prisma.lessonRecord.update({
      where: { id: lid },
      data: { summary: summary as any },
    });
    this.logger.log(
      `[评估] 课堂小结已写入: 违纪=${JSON.stringify(violations)} 举手=${handRaiseCount} 已评分=${evaluatedStudents} 人`
    );
    return { phase: "closing" };
  }

  /** 下课：LessonRecord → completed，并注销运行中的会话 */
  private async closingNode(state: LessonStateType) {
    await this.prisma.lessonRecord.update({
      where: { id: state.lessonRecordId! },
      data: { status: "completed", endedAt: new Date() },
    });
    this.activeSessions.delete(state.lessonRecordId!);
    this.logger.log(`[下课] 课堂结束，会话已注销`);
    return { phase: "done" };
  }

  // ============ 对外 API ============

  buildThreadKey(meta: LessonMeta): string {
    return `${meta.schoolId}:${meta.gradeId}:${meta.classId}:${meta.scheduleId}`;
  }

  async startLesson(meta: LessonMeta, input: { lessonTitle: string; transcript?: string[] }) {
    this.assertEnabled();

    // 防双写：同一课次同一时刻只允许一节进行中的课。
    // 老流程（lesson-records.startLesson）与课堂 Agent 共用这条约束，
    // 避免两个流程对同一 scheduleId 各写一条 LessonRecord。
    const ongoing = await this.prisma.lessonRecord.findFirst({
      where: { scheduleId: meta.scheduleId, status: "ongoing" },
      select: { id: true },
    });
    if (ongoing) {
      throw new ConflictException(
        `该课次已有进行中的课堂记录 #${ongoing.id}，请先结束再开课（可能与另一流程重复开课）`
      );
    }

    const threadId = this.buildThreadKey(meta);
    const config = { configurable: { thread_id: threadId } };

    // 讲稿来源优先级：调用方显式传入 > 课次绑定教案解析 > 空
    const { steps: transcript, source: transcriptSource } = await this.resolveTranscript(
      meta,
      input.transcript
    );

    const result = await this.graph.invoke(
      {
        ...meta,
        lessonTitle: input.lessonTitle,
        stepIndex: 0,
        transcript,
        transcriptSource,
        attendanceSource: "",
        phase: "opening",
        interactionCount: 0,
        pendingEvents: [],
      },
      config
    );
    return { threadId, state: result, transcriptSource };
  }

  /**
   * 解析本课讲稿。
   * 调用方（如课前预热流程）已准备好讲稿时直接使用；
   * 否则从课次绑定的教案 `LessonPlan.content` 里解析。
   */
  private async resolveTranscript(
    meta: LessonMeta,
    provided?: string[]
  ): Promise<{ steps: string[]; source: "caller" | "lesson_plan" | "empty" }> {
    if (provided?.length) return { steps: provided, source: "caller" };

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: meta.scheduleId },
      select: { lessonPlan: { select: { content: true, title: true } } },
    });
    const plan = schedule?.lessonPlan;
    if (!plan) {
      this.logger.warn(`[备课] 课次 ${meta.scheduleId} 未绑定教案，讲稿为空`);
      return { steps: [], source: "empty" };
    }

    const { steps, source } = transcriptFromLessonPlanContent(plan.content);
    this.logger.log(`[备课] 从教案「${plan.title}」解析讲稿 ${steps.length} 段（${source}）`);
    return { steps, source: steps.length ? "lesson_plan" : "empty" };
  }

  async resumeLesson(meta: LessonMeta, event: { student: string; question: string }) {
    const threadId = this.buildThreadKey(meta);
    const config = { configurable: { thread_id: threadId } };
    const result = await this.graph.invoke(new Command({ resume: event }), config);
    return { threadId, state: result };
  }

  /**
   * 把课堂中实时发生的事件（举手 / 违纪 / 迟到等）推进运行中的课堂会话。
   *
   * 事件先写入 `pendingEvents` 缓冲，由 interaction 节点消费：
   * 违纪类事件会让数字人在下一次互动中点名提醒。
   * 会话不存在或已下课时返回 accepted=false，不抛错（事件源不该因此失败）。
   */
  async pushEvent(
    meta: LessonMeta,
    event: { type: string; studentId?: number; category?: string }
  ) {
    const threadId = this.buildThreadKey(meta);
    const config = { configurable: { thread_id: threadId } };

    const snap = await this.graph.getState(config);
    const phase = (snap?.values as LessonStateType | undefined)?.phase;
    if (!snap?.values || phase === "done") {
      return { accepted: false, reason: "课堂会话不存在或已下课" };
    }

    const pending = [...((snap.values as LessonStateType).pendingEvents ?? [])];
    pending.push({
      type: event.type,
      studentId: event.studentId,
      category: event.category,
      at: new Date().toISOString(),
    });
    await this.graph.updateState(config, { pendingEvents: pending });
    return { accepted: true, pendingCount: pending.length };
  }

  /**
   * 按 lessonRecordId 转发课堂事件（供视觉上报链路调用）。
   *
   * 与 `pushEvent` 的区别：调用方只有 lessonRecordId（边缘设备上报时只带这个），
   * 由这里负责查会话元数据。若该课次不是由课堂 Agent 驱动（例如走 lesson-records
   * 老流程），返回 forwarded=false，调用方无需关心。
   */
  async forwardEvent(
    lessonRecordId: number,
    event: { type: string; studentId?: number; category?: string }
  ) {
    const meta = this.activeSessions.get(lessonRecordId);
    if (!meta) return { forwarded: false, reason: "该课次不是由课堂 Agent 驱动" };
    const res = await this.pushEvent(meta, event);
    return { forwarded: res.accepted, ...res };
  }

  /**
   * 灰度开关：课堂 Agent 目前是实验态，默认**不允许**启动，
   * 必须显式设置环境变量 `LESSON_AGENT_ENABLED=true` 才放行。
   * 这样即使误调 startLesson 也不会与 lesson-records 的老流程产生双写。
   */
  private assertEnabled() {
    if (process.env.LESSON_AGENT_ENABLED !== "true") {
      throw new ServiceUnavailableException(
        "课堂 Agent 处于实验态，未启用。设置 LESSON_AGENT_ENABLED=true 后可用。"
      );
    }
  }

  async getLessonState(meta: LessonMeta) {
    const threadId = this.buildThreadKey(meta);
    const snap = await this.graph.getState({ configurable: { thread_id: threadId } });
    return { threadId, values: snap.values, next: snap.next };
  }
}
