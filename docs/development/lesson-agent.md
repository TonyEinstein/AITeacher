# 课堂 Agent（Lesson Agent）落地说明

> 落地日期：2026-09-26 · 更新：2026-09-30 · 状态：**实验态 · 业务节点已接通真实数据，尚未接管生产上课流程**
>
> ✅ 业务节点已接线（2026-09-30）：点名接真实考勤、讲授接教案讲稿、答疑接检索上下文、
> 下课复用课后评估、实时事件走 `pendingEvents` 缓冲。详见第四、九节。
>
> ⚠️ **与生产流程的关系**：当前教室上课仍由 `backend/src/lesson-records/lesson-records.service.ts` 承载。
> 本模块的 `startLesson` **未被任何 controller 调用**，且受 `LESSON_AGENT_ENABLED` 开关保护（默认关闭）。
> 正式切换前需先定好与老流程的去重/灰度策略。

## 一、目标

把"讲稿驱动的自动上课"升级为**可打断、可断点恢复、多学校多班级并发**的课堂 Agent。
原则：基建用框架（LangGraph），业务自己写（节点函数体）。

## 二、技术选型

| 组件 | 选型 | 说明 |
|---|---|---|
| 编排框架 | **@langchain/langgraph@1.4.18** | 状态机 + checkpointer + interrupt |
| 模型抽象 | **@langchain/openai@1.5.13** | ChatOpenAI 配 baseURL 接三家 |
| 持久化 | **@langchain/langgraph-checkpoint-postgres@1.0.5** | PostgresSaver，自动建 checkpoint 表 |
| 事件队列 | **BullMQ**（已有） | 新队列 `lesson-event` |
| 业务落库 | **Prisma**（已有） | LessonRecord / Attendance |

**不装**：`@langchain/langchain` 元包、`langgraph.prebuilt`（1.0 已废弃）、高层 `createAgent`。

## 三、文件

```
backend/src/lesson-agent/
├── lesson.agent.state.ts          # LessonState 定义（Annotation.Root）
├── lesson.agent.service.ts        # 图编译 + 七节点 + 对外 API
├── lesson-plan-transcript.ts      # 【新】教案正文 → 逐段讲稿（纯函数）
├── lesson-context.ts              # 【新】答疑上下文检索（中文 2-gram 相关度，纯函数）
├── lesson.event.processor.ts      # BullMQ lesson-event → resume 课堂会话
└── lesson.agent.module.ts         # 模块装配
backend/scripts/
├── poc-lesson-agent.ts            # MemorySaver 快速 POC
├── verify-lesson-agent.ts         # 全节点 + 落库验证
├── verify-lesson-bullmq.ts        # BullMQ 事件接入验证
└── verify-lesson-agent-chain.ts   # 【新】全链路验证（25 项断言）
```

改动：`app.module.ts` 注册 `LessonAgentModule`；`llm.service.ts` 升级为 ChatOpenAI 实现（**对外 `chat()` 接口签名不变，业务调用方零改动**）。

## 四、课堂状态机（七环节）

```
开场 → 点名 → 讲授(逐段循环) → 互动(interrupt 等学生) → 答疑 → 评估 → 下课
```

| 环节 | 数据来源 |
|---|---|
| **开场** | 建 `LessonRecord(ongoing)`，并从课次带出 `lessonPlanId` / `agentId` |
| **点名** | 优先采用设备（vision-service / 人脸）已上报的 `Attendance`；无上报才兜底全勤，并标记 `attendanceSource=fallback` |
| **讲授** | 讲稿三级优先：调用方传入 → 教案 `LessonPlan.content` 解析 → 空。**条件边循环**，逐段推进直到讲完 |
| **互动** | `interrupt()` 暂停等提问；等待前消费 `pendingEvents` 缓冲，违纪事件点名提醒 |
| **答疑** | 用 `buildQaContext` 检索本课讲稿 + 学科知识点组装上下文，再交给 LLM（无 Key 走 mock） |
| **评估** | 写 `LessonRecord.summary`，并复用 `EvaluationsService.scoreAfterLesson` 生成课后评估（含画像刷新） |
| **下课** | `LessonRecord → completed` |

### 灰度开关

`LESSON_AGENT_ENABLED=true` 才允许 `startLesson`，默认关闭。
目的是防止误调本模块导致与 `lesson-records` 老流程**双写** `LessonRecord`。

### 实时事件接入

**自动转发（默认路径）**：边缘设备走 HTTP 上报，无需关心 Agent 是否在跑。

```
教室端 → POST /lesson-records/:id/behavior
        → addBehaviorEvent()：落库（含 category）→ 违纪生成 Warning
        → forwardEvent() 查运行中会话 → 写入 pendingEvents
        → interaction 节点消费（违纪 → 点名提醒）→ 消费后清空缓冲
```

**手动推送**：`pushEvent(meta, event)`，适合网关/测试直接对接 Agent。

⚠️ 会话定位靠 **`LessonAgentService.activeSessions`（单实例内存表）**：多副本部署时
事件只会命中本进程内的会话，需换成 Redis/DB 共享的 `lessonRecordId → threadId` 映射。

### 防双写

同一课次同一时刻**只允许一节进行中的 `LessonRecord`**，
老流程 `lesson-records.startLesson` 与本模块 `startLesson` 共用此约束，重复开课返回 409。
灰度开关 `LESSON_AGENT_ENABLED` 仍默认关闭，切换前请先读完第九节。

## 五、多租户并发与隔离

- `thread_id = schoolId:gradeId:classId:scheduleId`（**服务端生成**，不信任前端）
- 每个课堂会话独立图实例，框架天然隔离
- 状态快照写 Postgres（表 `checkpoints` / `checkpoint_blobs` / `checkpoint_writes`）

## 六、事件接入链路

```
教室端/网关 → POST 接口 → LessonEventProcessor.enqueue()
         → BullMQ 队列 lesson-event
         → Worker → LessonAgentService.resumeLesson(meta, event)
         → Command({ resume }) 唤醒对应 thread
```

## 七、模型服务层（LlmService 升级）

- **多厂商**：DeepSeek / 通义千问 / 豆包（火山方舟），OpenAI 兼容协议，`ChatOpenAI` 配不同 baseURL
- **重试**：`maxRetries: 2`（框架内置）
- **降级**：`withFallbacks` 主模型失败自动切备用厂商
- **用量**：沿用 UsageLog（框架 AIMessage 自带 usage_metadata）
- **mock 降级**：未配 API Key 时返回占位文本

环境变量（`.env`）：
```
LLM_PROVIDER=deepseek            # deepseek | qwen | doubao
DEEPSEEK_API_KEY=sk-xxx
# DEEPSEEK_BASE_URL / DEEPSEEK_MODEL 可选
LLM_FALLBACK_PROVIDER=qwen       # 可选，主厂商失败时备用
DASHSCOPE_API_KEY=sk-xxx         # 千问备用
```

## 八、验证记录（全部通过）

| 验证项 | 结果 |
|---|---|
| StateGraph 编排 / interrupt 暂停 / Command(resume) 恢复 | ✅ |
| thread_id 多租户隔离（两个班互不串） | ✅ |
| PostgresSaver 建表 + 状态持久化（5 个 checkpoint/会话） | ✅ |
| 七节点全链路（开场→…→下课） | ✅ |
| LessonRecord 落库（status=completed, endedAt, summary） | ✅ |
| Attendance 落库（13 行/班） | ✅ |
| BullMQ 事件 → Worker → resume | ✅ |
| 旧业务调用方零改动（chat 接口兼容） | ✅ |

## 九、当前边界与后续

### 已完成（2026-09-30 更新）

**编排与持久化**：七节点状态机、interrupt/resume、PostgresSaver 持久化、thread_id 多租户隔离、BullMQ 事件接入、模型层升级 —— 全部验证通过。

**业务节点接线**（本轮完成）：

| 项 | 状态 |
|---|---|
| 点名接真实考勤 | ✅ 优先采用设备上报考勤，无上报才兜底并标记 `fallback` |
| 讲授接教案讲稿 | ✅ 从 `LessonPlan.content` 解析「教学过程」段落；三级优先级；条件边逐段循环 |
| 答疑接真实 LLM | ⚠️ 代码已就绪，**需配 `DEEPSEEK_API_KEY` 才能验证效果**（当前走 mock） |
| 行为事件缓冲 | ✅ `pushEvent` → `pendingEvents` → 互动节点消费违纪事件并点名提醒 |
| 下课生成评估 | ✅ 复用 `EvaluationsService.scoreAfterLesson`，与老流程同一套打分口径 |
| 灰度开关 | ✅ `LESSON_AGENT_ENABLED`，默认关闭 |

验证脚本：`scripts/verify-lesson-agent-chain.ts`（25 项断言，含讲稿解析/事件自动转发/落库校验/防双写）。

### 仍是占位 / 未做

1. **答疑效果未验证**：无 LLM API Key，只能验证链路通不通，验证不了答得好不好
2. **点名 device 分支未覆盖**：端到端脚本只覆盖了 `fallback` 分支；`device` 分支需要盒子在「开场」与「点名」之间上报考勤，没有真机难以模拟
3. **生产切换未做**：`startLesson` 仍未被任何 controller 调用，生产上课流程仍由 `lesson-records.service.ts` 承载（防双写约束已就绪，见「防双写」一节）
4. **`activeSessions` 是单实例内存表**：多副本部署时视觉事件只会命中本进程内的会话，需换 Redis/DB 共享映射

