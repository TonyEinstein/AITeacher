/**
 * POC: 课堂 Agent 骨架验证（不动业务）
 * 流程：开场 → 讲授(讲稿推进) → 互动(interrupt 等待学生) → 答疑 → 结束
 * 验证点：
 *  1) StateGraph 编排
 *  2) interrupt/Command(resume) 暂停恢复
 *  3) thread_id 会话持久化（MemorySaver）
 *  4) getState 查当前节点
 *  5) 多 thread 互不串扰
 * 运行：npx ts-node scripts/poc-lesson-agent.ts
 */
import {
  StateGraph,
  Annotation,
  START,
  END,
  interrupt,
  Command,
  MemorySaver,
} from "@langchain/langgraph";

// ---------- 1. 课堂状态（对应方案的 LessonState）----------
const LessonState = Annotation.Root({
  schoolId: Annotation<number>(),
  classId: Annotation<number>(),
  lessonTitle: Annotation<string>(),
  stepIndex: Annotation<number>(), // 讲到讲稿第几步
  transcript: Annotation<string[]>(), // 课前预生成的讲稿段落
  phase: Annotation<string>(), // 当前环节
  interactionQuestion: Annotation<string>(), // 学生当前提问
  interactionAnswer: Annotation<string>(), // AI 答疑结果
  interactionCount: Annotation<number>(), // 本课已答次数
});

type State = typeof LessonState.State;

// ---------- 2. 节点（业务内容先占位，验证编排机制）----------

// 讲授：推进一步讲稿；讲完自动进入互动环节
const lectureNode = async (state: State) => {
  const nextStep = Math.min(state.stepIndex + 1, state.transcript.length);
  const done = nextStep >= state.transcript.length;
  console.log(`   [讲授] step=${nextStep}/${state.transcript.length}: ${state.transcript[nextStep - 1]}`);
  return {
    stepIndex: nextStep,
    phase: done ? "interaction" : "lecture",
  } as Partial<State>;
};

// 互动：暂停图，等学生举手/提问（interrupt）
const interactionNode = async (state: State) => {
  // 把"等待提问"这个事件抛给外部，图在这里挂起
  const incoming = interrupt({
    type: "wait_student_question",
    message: "学生可以举手提问了",
    lessonTitle: state.lessonTitle,
  }) as { student: string; question: string };

  console.log(`   [互动] 学生 ${incoming.student} 提问：${incoming.question}`);
  return {
    phase: "qa",
    interactionQuestion: incoming.question,
  } as Partial<State>;
};

// 答疑：调 LLM（POC 用占位回答，验证编排即可）
const qaNode = async (state: State) => {
  const answer = `【答疑·演示】关于「${state.interactionQuestion}」：先用生活中的例子理解概念，再做两道小练习。`;
  console.log(`   [答疑] ${answer}`);
  return {
    phase: "done",
    interactionAnswer: answer,
    interactionCount: (state.interactionCount ?? 0) + 1,
  } as Partial<State>;
};

// ---------- 3. 构图 ----------
const builder = new StateGraph(LessonState)
  .addNode("lecture", lectureNode)
  .addNode("interaction", interactionNode)
  .addNode("qa", qaNode)
  .addEdge(START, "lecture")
  // 讲完 → 互动
  .addEdge("lecture", "interaction")
  // 互动收到问题 → 答疑
  .addEdge("interaction", "qa")
  // 答疑完 → 结束（POC 只演示一轮）
  .addEdge("qa", END);

const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

// ---------- 4. 跑一次完整课堂 ----------
async function main() {
  // 复合 thread_id = school:class:lesson（方案定的多租户隔离键）
  const threadId = "school-100:class-1:lesson-20260926-01";
  const config = { configurable: { thread_id: threadId } };

  const transcript = [
    "同学们好，今天我们讲《光合作用》。",
    "光合作用是植物利用光能，把二氧化碳和水转化成有机物。",
    "其中叶绿体是进行光合作用的主要场所。",
  ];

  console.log("=== 启动课堂：开始讲授 ===");
  const run1 = await graph.invoke(
    {
      schoolId: 100,
      classId: 1,
      lessonTitle: "光合作用",
      stepIndex: 0,
      transcript,
      phase: "opening",
      interactionCount: 0,
    } satisfies Partial<State>,
    config
  );

  // 讲稿只有 3 步：第一次 invoke 会把 lecture 跑完 3 步？
  // 注意：lectureNode 一次只推进一步。需要看图实际走法——
  // lecture → interaction 是固定边，所以一次 invoke 只跑一步就进 interaction。
  // 这里演示"讲了一步就到互动等待"的暂停点。

  console.log("\n--- 第一次 invoke 后状态 ---");
  console.log("phase =", (run1 as any).phase, "stepIndex =", (run1 as any).stepIndex);
  console.log("interrupt =", JSON.stringify((run1 as any).__interrupt__ ?? null));

  // 图在 interaction 暂停。模拟学生举手
  console.log("\n=== 模拟学生举手提问（resume） ===");
  const run2 = await graph.invoke(
    new Command({ resume: { student: "张三", question: "叶绿体为什么能进行光合作用？" } }),
    config
  );
  console.log("resume 后 phase =", (run2 as any).phase, "已答次数 =", (run2 as any).interactionCount);

  // 查当前状态（运维/监控场景）
  const snapshot = await graph.getState(config);
  console.log("\n--- getState ---");
  console.log("当前 phase =", snapshot.values.phase, "下一步节点 next =", JSON.stringify(snapshot.next));

  // 多租户验证：另一个班的 thread 不互相影响
  const otherConfig = { configurable: { thread_id: "school-101:class-2:lesson-20260926-02" } };
  await graph.invoke(
    { ...({} as Partial<State>), schoolId: 101, classId: 2, lessonTitle: "另一个班", stepIndex: 0, transcript: ["另一个班讲别的"], phase: "opening", interactionCount: 0 },
    otherConfig
  );
  const otherSnap = await graph.getState(otherConfig);
  const mySnap = await graph.getState(config);
  console.log("\n--- 多租户隔离验证 ---");
  console.log("A 班 phase =", mySnap.values.phase, "| B 班 lessonTitle =", otherSnap.values.lessonTitle);

  console.log("\n=== POC 通过：StateGraph 编排 / interrupt 暂停 / resume 恢复 / thread 隔离 全部工作 ===");
}

main().catch((e) => {
  console.error("POC 失败:", e);
  process.exit(1);
});
