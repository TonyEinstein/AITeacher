# AI-Teacher PRD 与前后端实现对照差异分析

> 分析日期：2026-09-22（**历史快照，请先读下方「现状更新」**）
> 对照基准：《AI-Teacher-产品需求文档.md》v1.0（2026-09-20）
> 代码基线（**为 2026-09-22 当时值**）：
> - 前端路由 `admin-web/src/router/index.ts`、前端 API `admin-web/src/api/index.ts`（21 个页面）
> - 后端 controller `backend/src/**/*.controller.ts`（37 个 controller）
> - 数据模型 `backend/prisma/schema.prisma`（45 个 model）
> - 种子数据 `backend/prisma/seed.ts`

---

## 零、现状更新（2026-09-30 复核）

> 本报告写于 2026-09-22，此后代码继续演进。以下是**已发生变化**的条目，阅读下文时请以此为准。

### 0.1 代码规模已变化

| 项 | 2026-09-22 | 2026-09-30 |
|---|---|---|
| 后端 controller | 37 | **42** |
| Prisma model | 45 / 47 | **51** |
| 管理后台页面 | 21 | **26** |
| 小程序页面 | — | 15 |
| 官网页面 | — | 9 |

新增模块：`vision`（课堂视觉事件）、`wearable`（眼镜/手表协议适配）、`realtime`（Socket.IO 实时课堂）、`media-stream`（WebRTC→RTMP 推流）、`lesson-agent`（LangGraph 课堂 Agent）、`subjects`（科目字典）、`site-config`（官网配置）、`tracking`（转化埋点）。

### 0.2 已修复（原报告 §一 / §六 指出的问题）

- ✅ **teacher 角色**：已补 seed 账号 `GZ001_teacher/123456`，前端菜单已收敛，后端已加 `@Roles('teacher')` 边界（原 §1.5-2、§六）。
- ✅ **后端角色装饰器覆盖不足**：`schoolOnly` 相关模块已补 `@Roles()`，年级/学科管理员直接调接口越权返回 403（原 §1.5-1）。
- ✅ **6 个公司级页面 school_admin 全 403**：已修，`leads`/`work-orders`/`subscriptions` 按本校过滤（原 §2.2）。

### 0.3 5 张"孤岛表"已全部接线（原报告 §2 的孤岛表结论已作废）

| 表 | 现状 | 写入/读取位置 |
|---|---|---|
| `Subject` | ✅ 已接线 | `subjects.service.ts` 提供科目字典 `GET /subjects` |
| `Warning` | ✅ 已接线 | `lesson-records.service.ts:77` 违纪事件写入；`evaluations.service.ts` 读取并计入纪律分 |
| `MyopiaReminder` | ✅ 已接线 | `tutoring.service.ts:174` 辅导超 40 分钟写入 |
| `UsageLog` | ✅ 已接线 | `llm.service.ts:116` 按 `usage_metadata` 写 token 用量；`dashboard.service.ts` 聚合统计 |
| `PracticeRecord` | ✅ 已接线 | `tutoring.service.ts:249/281` 答题写入与查询 |

### 0.4 仍未解决（截至 2026-09-30）

- 调课整体顺延 / 临时停课（§3.15、§3.23）
- 学生学科薄弱画像计算（§3.25，`StudentProfile.weaknesses` 字段仍在但无计算逻辑）
- 集团管理员角色（§3.32）—— 注：`group_admin` **已在 `RolesGuard`、前端路由守卫、`User.role` 注释中支持**（等同 `super_admin`），缺的是 **seed 账号与跨校区汇总报表**
- 全表软删除/审计字段、接口限流（§21.2、§17）

### 0.5 新增：LangGraph 课堂 Agent（PRD 未覆盖）

`backend/src/lesson-agent/` 引入 `@langchain/langgraph`，实现「开场→点名→讲授→互动→答疑→评估→下课」七节点状态机 + `interrupt()/Command(resume)` 断点恢复 + `PostgresSaver` 持久化。详见 `docs/development/lesson-agent.md`。

> **2026-09-30 更新**：业务节点已接通真实数据（原为占位），见下方 0.8 节。

### 0.6 本次补全（2026-09-30 实施，已编译通过）

| 功能 | 实现方式 |
|---|---|
| **学生预警引擎 §3.10** | 新增 `alerts` 模块 + `StudentAlert` 表；四条规则：成绩下滑（近 N 节均分降幅 ≥ 阈值）、连续缺课（连续 absent ≥ 3）、纪律频发（窗口期扣分累计 ≥ 10）、出勤异常（非正常出勤占比 ≥ 40%）；命中后落库并向家长推送 `Notification`；同一学生同类型 7 天内去重；支持定时扫描（默认 6 小时，`ALERT_SCAN_ENABLED=false` 可关）与手动触发。前端新增「预警中心」页（`/alerts`）。阈值均可用 `ALERT_*` 环境变量调整 |
| **成本 ROI 报表 §3.11** | `GET /dashboard/roi`：节省人工成本 = 已完成 AI 课时数 × 单课时人工成本（`ROI_TEACHER_COST_PER_LESSON`，默认 80 元）；输出净节省、ROI%、生均订阅成本，按校汇总。前端新增「成本效益」页（`/roi`） |
| **县城排名 §3.27** | `School.county` 字段；`GET /rankings/cross-school/:studentId?scope=county\|city\|province\|national` 按行政区划**真实筛选**（原实现完全忽略 scope 参数，返回的是全国数据）；省市县缺失时自动降级为全国 |
| **学生情绪字段 §3.28** | `Evaluation.emotion` 字段（`positive`/`neutral`/`negative`）；课后打分时按违纪事件、纪律扣分、参与度推断；学情报告 `GET /evaluations/student/:id/report` 返回情绪分布与最近情绪 |

> 剩余 3 项（调课顺延、薄弱画像、集团管理员 seed + 跨校区报表）仍待实现。

### 0.7 数据地基修复（2026-09-30）

修复了课后打分函数（`backend/src/evaluations/evaluations.service.ts`）的三个缺陷。设计文档见 `docs/plans/2026-09-30-foundation-repair-design.md`。

| 缺陷 | 原状 | 修复后 |
|---|---|---|
| participation 随机数 | `80 + Math.random()*20` | 由 `BehaviorEvent(type=hand_raise)` 计数推导 |
| homework 随机数 | `85 + Math.random()*15` | 由 `Submission.score`（同科最近 5 次已批改）均分推导；无数据用中性分 80 |
| **discipline 反向扣分** | 用**全部**行为事件扣分，`focus`/`hand_raise` 等正常行为也扣 —— 学生越专注纪律分越低 | 仅 `category === 'violation'` 的事件与 `Warning` 扣分参与计算 |

此外发现并修复：`scoreAfterLesson` 只写 `Evaluation`、**不更新 `StudentProfile`**，而班级/年级/跨校排名读的是 `StudentProfile.overallScore` —— 导致上完课排名恒为 0、预警「成绩下滑」规则永远读不到新分。现已在打分后调用 `refreshProfiles()` 按 `Evaluation` 均分刷新画像总分。

**工程化**：
- 打分逻辑抽为纯函数 `backend/src/evaluations/lesson-scoring.ts`（无副作用、无随机），附 15 个单测
- 新增端到端验证脚本 `backend/scripts/verify-evaluation-chain.ts`：造课（考勤/正常+违纪行为/警告/作业）→ 打分 → 情绪 → 预警 → 排名，14 项断言
- `Evaluation.dimensions` 新增 `_sources` 键标记每个维度的数据来源（`behavior` / `submission` / `default`），不再"假装有数据"

> **影响面**：`Evaluation.score` 是学生报告、班级/年级/跨校排名（含县城排名）、`StudentProfile`、家长端成绩、预警引擎「成绩下滑」规则的共同输入源。本次修复后这些功能才真正建立在真实数据上。

### 0.8 课堂 Agent 业务节点接线（2026-09-30）

原报告 0.5 节所述「业务节点仍为占位」已解决。四个占位节点全部接通真实数据：

| 节点 | 原状 | 现状 |
|---|---|---|
| 点名 | 写死全员 `present` | 优先采用设备（vision-service / 人脸）已上报考勤；无上报才兜底全勤，并标记 `attendanceSource=fallback`，避免兜底数据被当成真实考勤 |
| 讲授 | 讲稿为调用方传入的固定文本 | 三级优先：调用方传入 → 教案 `LessonPlan.content` 解析 → 空。新增纯函数 `lesson-plan-transcript.ts` 从结构化教案里提取「教学过程」段落 |
| 答疑 | 直接把问题丢给 LLM | 先用 `lesson-context.ts`（中文 2-gram 相关度）检索本课讲稿 + 学科知识点组装上下文，system prompt 要求「只依据资料作答，不编造」 |
| 评估 | 只写 `LessonRecord.summary` | 额外复用 `EvaluationsService.scoreAfterLesson` 生成课后评估（与 `lesson-records` 流程同一套打分口径，含画像刷新） |

新增能力：
- **实时事件缓冲**：`pushEvent()` 写入 `pendingEvents`，互动节点消费违纪事件并点名提醒，消费后清空
- **灰度开关**：`LESSON_AGENT_ENABLED`，默认关闭，防止误调导致与老流程双写 `LessonRecord`

**新发现并修复的 bug**：`lectureNode` 返回 `phase='lecture'` 本意是循环逐段讲，但图里用的是 `addEdge('lecture','interaction')` **无条件边**，导致永远只讲第一段就跳去互动。已改为 `addConditionalEdges`；实测 4 段讲稿由 `stepsCovered=1` 修正为 `4`。

验证脚本：`backend/scripts/verify-lesson-agent-chain.ts`（25 项断言）。

> **仍未做**：答疑需配 `DEEPSEEK_API_KEY` 才能验证效果（当前 mock）；点名 `device` 分支需真机才能覆盖。~~生产切换需先定去重/灰度策略~~ → 已在 0.9 节落地。

### 0.9 剩余 PRD 缺口补全 + 两处新断链 + 一次越权修复（2026-09-30）

#### 0.9.1 学生学科薄弱画像（PRD §3.25）

**又发现一处断链**：作业批改生成错题时**丢弃了题目的 `knowledgePoint` / `subjectId`** ——
而作业生成的 prompt 本来就要求 LLM 输出 `knowledgePoint`，是批改环节把它丢的。
导致错题本永远无法按知识点聚合，薄弱画像无从谈起。已修复（`WrongQuestion` 新增两列 + 索引）。

| 项 | 说明 |
|---|---|
| 纯函数 | `wrong-questions/weakness.ts` 的 `computeWeaknesses()`：按知识点聚合，薄弱分 = 错题数 + 近 30 天错题数 × 0.5 |
| 口径 | **基于错题数，不是错误率** —— 系统未记录「某知识点共练了多少题」，算不出分母。已在代码注释与前端页面明示 |
| 接口 | `GET /wrong-questions/weaknesses/:studentId?subjectId=&topN=` |
| 落库 | `studentReport()` 同步刷新并写入 `StudentProfile.weaknesses`（摘要） |
| 顺带修复 | `findByStudent/stats` 的 `subjectId` 参数此前被**完全忽略**（传了也不生效） |
| 前端 | 新增「学生学情」页 `/student-report`（此前没有任何页面用过 `studentReport` API） |

#### 0.9.2 调课整体顺延 / 临时停课（PRD §3.15、§3.23）

| 能力 | 接口 | 说明 |
|---|---|---|
| 整体顺延 | `POST /schedules/postpone` | 班级/年级/学校三个范围，事务执行；只挪「未开始且未取消」的课 |
| 临时停课 | `POST /schedules/:id/cancel` | 置 `cancelled` 并记录原因；可选同时安排补课 |
| 单节改时间 | `PUT /schedules/:id/reschedule` | 同班冲突检测（半开区间语义：背靠背不算冲突） |
| 补课查询 | `GET /schedules/:id/makeups` | 补课通过 `originalScheduleId` 溯源到被停的原课 |

纯函数 `schedules/schedule-time.ts`：`shiftByDays` / `isOverlapping` / `buildPostponePlan`（14 项单测）。
课表页原先的班级选项是**硬编码的 1 班/2 班占位**，已重写并接入调课操作。

#### 0.9.3 集团管理员与跨校区汇总（PRD §3.32）

**越权修复（本批最重要）**：`RolesGuard` 把 `group_admin` 自动提权为 `super_admin`，
导致集团管理员能调用所有平台级接口（学校 CRUD / 官网设置 / 咨询留资 / 设备总览 / 预警扫描），
并读到**其他集团**的数据。而 PRD §8.7 规定集团管理员的数据范围是「所有校区」（本集团），不是「所有学校」。

- 移除自动提权，改为**显式授权**：53 处含 `school_admin` 的 `@Roles` 补上 `group_admin`（17 个文件）；
  仅列 `super_admin` 的平台接口保持集团管理员不可达
- `dashboard/global`、`dashboard/health`、`dashboard/usage`、`boxes/all`、`alerts/scan` 按 JWT 里的
  `schoolId` 收窄，**伪造 query 参数无效**；未绑定学校时**失败关闭**（拒绝而非放行全量）
- 新增权限矩阵回归测试 `roles.guard.spec.ts`（21 项），含「group_admin 不得访问平台级接口」的回归断言

跨校区汇总：`GET /campuses/group-overview`，按校区统计学生/班级/年级/平均成绩/课堂评估均分/出勤率/已完成课时
（归属路径 `Student → Class → Grade → Campus`）。前端新增 `/group-overview` 页与集团管理员独立菜单。

> **满意度未纳入汇总**，并已在接口返回的 `notImplemented` 里显式声明：
> `SurveyResponse.answers` 是自由 Json、没有评分口径，且当前无问卷数据，无法计算。

seed 变更：每校 2 个校区、年级按校区分配、新增 `group_admin` 账号（`GZ001_group` 等，密码 123456）；
`prisma.seed` 命令改为 `node ./node_modules/ts-node/dist/bin.js`（Windows 下 `ts-node` / `npx` 均不可用）。

#### 0.9.4 视觉事件自动转发 + 防双写

- **第三处断链**：`addBehaviorEvent`（边缘设备真实上报走的 HTTP 路径）把 `category` 丢掉了 →
  违纪事件永远不带 `violation` 标记、**纪律分永远不扣**。
  数据地基那轮（0.7）修的是「算得对」，这次修的是「喂得到」。
- `LessonAgentService` 维护运行中会话登记表（`lessonRecordId → 会话元数据`），新增 `forwardEvent()`；
  `addBehaviorEvent` 落库后自动转发进 `pendingEvents`，违纪事件由互动节点点名提醒
- **防双写**：同一课次同一时刻只允许一节进行中的 `LessonRecord`，
  老流程 `lesson-records.startLesson` 与课堂 Agent `startLesson` 共用此约束（重复开课返回 409）
- ⚠️ 会话登记表是**单实例内存表**，多副本部署需换成 Redis/DB 共享映射（代码已标注）

#### 0.9.5 验收

| 项 | 结果 |
|---|---|
| 后端 `tsc --noEmit` | 0 错误 |
| `vitest run` | **91 项通过**（含 21 项权限矩阵） |
| 5 条端到端链路 | **95 项断言全通过**（调课 21 / 打分 15 / 课堂 Agent 25 / 薄弱画像 15 / 集团汇总 19） |
| 前端 `vue-tsc` + `vite build` | 0 错误，构建成功 |

> **模型假设需确认**：按 `Campus.schoolId` 的现有结构，把「一个 School = 一个集团（下辖多校区）」。
> 若本意是「一个集团 = 多所 School」，需新增 `Group` 模型并重做 `group_admin` 的范围。

---

## 一、角色与权限对照

### 1.1 PRD 定义的角色（PRD §2、§8.7）

| 角色 | PRD 定位 | 数据范围 |
|---|---|---|
| Super 管理员（总部） | 开通/关闭学校订阅、看全校用量、管所有学校 | 所有学校 |
| 学校管理员 | 本校排课、传教材、管教师、看本校数据 | 本校 |
| 年级×科目代表老师 | 管本年级本科的教室、Agent、作业审批 | 本年级本科 |
| 学生 | 交作业、看自己成绩、请假 | 自己 |
| 家长 | 看绑定孩子上课/成绩 | 绑定的孩子 |
| 集团管理员（§3.32） | 跨校区汇总，不改教学内容 | 所有校区 |

### 1.2 代码中的角色枚举

`User.role`（schema.prisma 第 125 行注释）：

```
super_admin, school_admin, grade_admin, subject_admin, teacher
```

| PRD 角色 | 代码对应值 | 说明 |
|---|---|---|
| Super 管理员 | `super_admin` | ✅ 一致 |
| 学校管理员 | `school_admin` | ✅ 一致 |
| 年级×科目代表老师 | `grade_admin` / `subject_admin` | ✅ 拆成两个细粒度角色 |
| 教师（普通授课教师） | `teacher` | ⚠️ 枚举存在，但见 1.5 |
| 集团管理员 | 无 | ❌ PRD §3.32 要求，代码未单独建模（校区靠 `Campus` 表区分） |
| 学生 / 家长 | 不走 User 表 | ✅ 学生用 `Student`，家长用 `Parent`（微信 openid 登录） |

### 1.3 前端路由守卫（router/index.ts）

- 登录态判断：`localStorage.admin_token` 缺失则跳 `/login`（第 46-50 行）。
- 数据边界：`grade_admin` / `subject_admin` 访问带 `meta.schoolOnly: true` 的页面时重定向到 `/dashboard`（第 51-60 行）。
- 被标记 `schoolOnly` 的页面共 4 个：
  - `/organization`（组织架构）
  - `/devices`（设备管理）
  - `/tutoring`（辅导管理）
  - `/leave-approval`（请假审批）

### 1.4 后端角色装饰器（@Roles）

后端仅在以下 controller 的写操作上声明了 `@Roles`，其余接口仅校验登录态（`JwtAuthGuard`），不校验角色：

| Controller | 受保护端点 | 允许角色 |
|---|---|---|
| `schools` | 增/改/删/列表 | `super_admin` |
| `users` | 建用户、删用户 | `super_admin`, `school_admin` |
| `subscriptions` | 续期/配置/启停/列表 | `super_admin` |
| `work-orders` | 全部工单接口 | `super_admin` |
| `leads` | 列表/详情/删除 | `super_admin` |
| `boxes` | `GET /boxes/all`（公司级全量设备） | `super_admin` |
| `dashboard` | `global`、`health`（全局/学校健康） | `super_admin` |

### 1.5 权限不一致项（重点）

1. **前端拦截 ≠ 后端鉴权（越权风险）**
   前端对 `grade_admin` / `subject_admin` 隐藏了组织架构、设备、辅导、请假审批 4 个页面，但后端这些模块（`grades`/`classes`/`students`/`lesson-plans`/`schedules`/`assignments`/`exams`/`leaves`/`tutoring`/`boxes`）的绝大多数端点**没有任何 `@Roles` 装饰器**，仅凭 JWT 登录即可调用。也就是说年级/学科管理员若直接调接口，仍能拿到跨年级、跨学科数据。前端只是 UI 层隐藏，未形成真正的服务端数据边界。
2. **`teacher` 角色空挂**
   schema 注释里列了 `teacher`，但：
   - 后端没有任何 `@Roles('teacher')`；
   - 前端路由守卫也不识别 `teacher`；
   - **`seed.ts` 没有创建任何 `teacher` 账号**（只创建了 `super_admin`、`school_admin`、`grade_admin`、`subject_admin` 四类）。
   PRD §24.2 users.role 明确含 `teacher`（授课教师），PRD §3.7 也定义了"教师/管理员模式"小程序端。当前 seed 缺一个 `teacher` 角色的演示账号，也缺对应的权限策略。
3. **集团管理员未建模**
   PRD §3.32 要求集团管理员跨校区汇总、不能改单校区教学内容。代码有 `Campus` 表和 `campuses` controller，但 User 表没有 `group_admin`/`campus_admin` 角色，也没有跨校区汇总权限分支。
4. **`schoolOnly` 语义模糊**
   前端把"请假审批/设备/辅导/组织架构"都标成 `schoolOnly`，按 PRD §8.7 这些本来就该是学校管理员权限；但 `tutoring`（辅导管理）PRD §3.36 是跨学生的，学校管理员管合理，却把 `subject_admin` 挡在外面，与"学科老师管本科教室/Agent"的 PRD 描述存在出入。

---

## 二、PRD 功能清单 vs 前端 28 页面 / 后端路由

### 2.1 前端 21 个页面与 PRD 映射

| # | 路由 | 页面 | 对应 PRD 章节 | 后端 API |
|---|---|---|---|---|
| 1 | `/dashboard` | 首页概览 | §3.8 校级驾驶舱 | `dashboard/*`、`dashboard/global` |
| 2 | `/schools` | 学校管理 | §8.5 Super 后台 | `schools/*` |
| 3 | `/organization` | 组织架构 | §8.5 学校管理员后台 | `grades`/`classes`/`students`/`users`/`campuses` |
| 4 | `/textbooks` | 教材教案 | §3.5、§3.33 AI 备课 | `textbooks/*`、`lesson-plans/*` |
| 5 | `/schedules` | 课表管理 | §3.5、§3.15、§3.23 | `schedules/*` |
| 6 | `/assignments` | 作业复核 | §3.4、§3.18、§3.34 | `assignments/*` |
| 7 | `/exams` | 考试管理 | §3.9、§3.22、§3.35 | `exams/*`、`papers`、`scores`、`exam_cheats` |
| 8 | `/live` | 巡课旁听 | §3.24 巡课旁听 | `live/push/room/*`、`live/pull/*` |
| 9 | `/reports` | 报表驾驶舱 | §3.6、§3.26、§3.20 | `evaluations/*`、`rankings/*`、`dashboard/*` |
| 10 | `/devices` | 设备管理 | §3.12 设备运维 | `rooms/*`、`boxes/*` |
| 11 | `/tutoring` | 辅导管理 | §3.3、§3.36、§26.6 | `tutoring/*` |
| 12 | `/leave-approval` | 请假审批 | §3.2 请假管理 | `leaves/*` |
| 13 | `/question-bank` | 学科题库 | §3.17 题库命题 | `question-bank/*` |
| 14 | `/agents` | AI 教师管理 | §3.1 多 Agent、§3.21 风格 | `agents/*` |
| 15 | `/avatars` | 数字人形象 | §3.13 品牌定制、§7 数字人加购 | `avatars/*` |
| 16 | `/surveys` | 满意度问卷 | §3.31 家长满意度 | `surveys/*` |
| 17 | `/leads` | 咨询留资 | §5.2 官网留资、§8.5 | `leads/*`、`shares/leads/list` |
| 18 | `/subscription` | 订阅管理 | §5.1、§8.5 Super 订阅 | `subscriptions/*` |
| 19 | `/work-orders` | 售后工单 | §3.12 设备运维告警（落地为工单） | `work-orders/*` |
| 20 | `/device-monitor` | 设备监控 | §3.30 Super 用量/设备健康 | `boxes/all` |
| 21 | `/health` | 学校健康 | §3.30 学校健康度防流失 | `dashboard/health` |

### 2.2 后端 controller 模块清单（37 个）

按业务域分组：

- **认证/组织**：`auth`、`users`、`schools`、`campuses`、`grades`、`classes`、`students`、`parents`、`wechat`
- **教学**：`textbooks`、`lesson-plans`、`schedules`、`agents`、`rooms`、`boxes`、`lesson-records`、`face-library`
- **作业/考试**：`assignments`、`question-bank`、`wrong-questions`、`exams`
- **课堂/考勤**：`leaves`、`evaluations`、`rankings`、`live`
- **辅导**：`tutoring`、`preferences`
- **家校互动**：`parent-messages`、`notifications`、`shares`
- **商务/运营**：`subscriptions`、`leads`、`surveys`、`work-orders`、`dashboard`、`avatars`
- **基础设施**：`app`（健康检查）

---

## 三、PRD 有但代码缺失的功能

| PRD 章节 | PRD 要求 | 代码现状 | 缺口 |
|---|---|---|---|
| §3.10 学生预警 | 成绩骤降/连续缺课自动标红并推送老师家长 | 仅有 `evaluations/warnings` 查纪律警告列表 | 无预警规则引擎、无自动标红、无推送通道（`notifications` 表存在但无预警生成逻辑） |
| §3.11 成本 ROI 报表 | 统计节省人力成本、生均成本 | 无对应 controller/页面 | 完全缺失 |
| §3.14 真人老师工作量 | 复核量、审批时效、绩效考核 | 无聚合接口 | 可由 submissions/leaves 推导，但未实现 |
| §3.15 / §3.23 临时调课与进度顺延 | 调课/补课/整体后挪 N 天 | `schedules` 只有增删改查和 `auto` | 无"整体顺延""临时停课"动作 |
| §3.16 家校主动通知 | 月考复习提醒、表现下滑自动推送 | `notifications` 表 + controller 存在 | 无自动触发规则，仅手动/占位 |
| §3.19 学科专项练习 | 朗读打卡/默写/口语跟读/单词听写 | schema 有 `PracticeRecord` 表，无 controller、无前端页面 | 表已建，功能未做 |
| §3.25 学生学科薄弱画像 | 知识点薄弱自动标记、全班薄弱分布 | `StudentProfile.weaknesses` 字段存在 | 无计算/查询接口 |
| §3.27 排名体系 | 班/年级/县城/城市/省/全国排名 + 参与学校地图 | `rankings/cross-school/:studentId` 已做跨校；`StudentProfile` 无 county_rank 字段 | 县城排名字段缺，参与学校地图/开关未做 |
| §3.28 家长端增强 | 课堂互动详情、孩子情绪状态、AI 评语原文、完整成长档案 | `Evaluation.emotion` 字段未在 schema 中（schema 只有 score/dimensions/comment） | 情绪字段未落地；成长档案聚合未做 |
| §3.29 分享传播数据看板 | 本校被分享次数/外部访客/留资数 | `ShareSnapshot.visitorCount` 有；`shares/leads/list` 有 | 无"按学校聚合的传播看板"页面 |
| §3.30 官网留资管理 | Super 后台看留资 | `leads` controller + 前端 `/leads` 已做 | ✅ 已实现 |
| §3.32 多校区管理 | 集团总部跨校区汇总 | `Campus` 表 + `campuses` controller 有增改查 | 无跨校区汇总报表、无集团管理员角色 |
| §3.37 近视提醒 | 40 分钟提醒、家长看是否休息 | `MyopiaReminder` 表存在 | 无"是否按提醒休息"字段（PRD §24.7 要求 rested 字段），无触发逻辑 |
| §3.37 桌位求助键 | USB HID 求助键上报 | `Box.type` 含 `help_key` | 无求助键事件接收/课堂响应逻辑 |
| §4.4.1 客户端升级 | 自动更新/强制更新/回滚/灰度 | `boxes/ota/latest`、`boxes/ota/report` 接口已留 | 无灰度分组、无版本回滚记录 |
| §17 接口防刷/限流 | Redis 限流 60 次/分 | 未见 ThrottlerModule 配置 | 未实现 |

---

## 四、代码有但 PRD 未明确提及/超出 PRD 的功能

| 模块 | 代码实现 | 与 PRD 关系 |
|---|---|---|
| `work-orders` 售后工单 | 完整工单 CRUD + 状态流转 + 故障编码 + 统计页 `/work-orders` | PRD §3.12 只说"自动通知后勤维修"，未要求工单系统；属增强实现 |
| `device-monitor` `/boxes/all` 公司级设备监控页 | 全公司盒子在线/故障总览 | PRD §3.30 Super"设备运维告警"的落地，合理 |
| `health` `/dashboard/health` 学校健康度 | 按学校活跃度预警 | PRD §3.30"学校健康度防流失"，已落地 |
| `face-library` 人脸库 | 人脸上传/特征提取/下发盒子/按学生班级学校查询 | PRD §8.1 face_embedding、§6 人脸采集，已细化实现 |
| `avatars` 数字人形象 + 学校定制 | 通用形象 + `custom/:schoolId` 定制 | PRD §3.13、§7 加购项，已落地 |
| `parent-messages` 家长留言审批流 | 待审/通过/驳回/已转达 | PRD §3.28 家长留言与课堂转达，已落地 |
| `preferences` 学生个性化偏好 | 风格/语速/近视提醒开关 | PRD §3.37③④，已落地（但缺 repeat_count/question_difficulty 字段） |
| `TutoringSubscription` 学生辅导订阅 | 按学生开通、配发眼镜/手表 | PRD §26.6 辅导设备与服务开通，已落地 |
| `DigitalAvatar` 表 | 数字人形象模型（含价格、是否定制） | PRD §7 数字人加购收费，已落地 |
| `infra/pi/` 树莓派 systemd 服务、OTA 脚本 | `ait-vision.service`、`ait-classroom.service`、`ota-update.sh` | PRD §25 教室端部署/升级，已落地脚本 |

---

## 五、数据模型差异（schema.prisma vs PRD §24）

PRD §24 设计 45 张表，实际 prisma schema 模型数对照：

| 业务域 | PRD 设计 | 实际 model | 差异 |
|---|---|---|---|
| 组织架构 | schools/campuses/grades/classes/subjects/users（6） | School/Campus/Grade/Class/Subject/User（6） | ✅ |
| 学生家长 | students/parents/parent_messages（3） | Student/Parent/ParentMessage（3） | ✅ |
| 教学 | textbooks/lesson_plans/agents/schedules/rooms/boxes（6） | Textbook/LessonPlan/Agent/Schedule/Room/Box（6） | ✅ |
| 作业 | assignments/submissions/question_banks/wrong_questions（4） | Assignment/Submission/QuestionBank/WrongQuestion（4） | ✅ |
| 考试 | exams/papers/scores/exam_cheats（4） | Exam/Paper/Score/ExamCheat（4） | ✅ |
| 课堂 | lesson_records/behavior_events/attendance/leaves/warnings/myopia_reminders（6） | LessonRecord/BehaviorEvent/Attendance/Leave/Warning/MyopiaReminder（6） | ✅ |
| 评估 | evaluations/student_profiles/student_preferences（3） | Evaluation/StudentProfile/StudentPreference（3） | ⚠️ Evaluation 缺 emotion 字段；StudentProfile 缺 county_rank；StudentPreference 缺 repeat_count/question_difficulty |
| 商务 | subscriptions/usage_logs（2） | Subscription/UsageLog（2） | ✅ |
| 分享 | share_snapshots/leads（2） | ShareSnapshot/Lead（2） | ✅ |
| 问卷 | surveys/survey_responses（2） | Survey/SurveyResponse（2） | ✅ |
| 通知 | notifications（1） | Notification（1） | ✅ |
| 辅导 | tutoring_sessions/tutoring_messages/practice_records（3） | TutoringSession/TutoringMessage/PracticeRecord（3） | ✅ |
| 设备 | devices + tutoring_devices/tutoring_subscriptions（3） | Device/TutoringSubscription（2） | ⚠️ PRD 拆出 `tutoring_devices` 表，代码并入 `Device`（type=glasses/watch）+ `TutoringSubscription.glassesDeviceId/watchDeviceId` |
| **额外** | — | **WorkOrder / DigitalAvatar / FacePhoto** | 代码新增 3 张表（工单、数字人形象、人脸库），PRD §24 未列 |

**合计**：PRD 设计 45 表，实际 model 数 = 6+3+6+4+4+6+3+2+2+2+1+3+2 + 3 新增 = **47 个 model**。

字段级主要偏差：
- `User` 缺 PRD §24.2 的 `campus_id`、`avatar`、`last_login_at`、`deleted_at`、软删除字段；
- `School` 缺 `type`（小学/初中/高中）、`address`、`plan` 字段（plan 挪到 Subscription）；
- `Student` 缺 `birth`、`face_embedding`、`face_photo_url`（人脸走独立 `FacePhoto` 表）、`enrollment_date`；
- `Assignment` 缺 `class_id`、`subject_id`、`created_by`、`confirmed_by`（靠 lessonPlan 间接关联）；
- `Submission` 未区分 `ai_score`/`teacher_score`（合并成 `score`）、缺 `reviewed_at`；
- `MyopiaReminder` 缺 `rested` 字段；
- 全表未统一加 `deleted_at` 软删除与 `created_by/updated_by` 审计字段（PRD §21.2 强制要求）。

---

## 六、seed 数据与 teacher 角色专项核查

`seed.ts` 实际创建的账号角色：

| 角色 | 是否有 seed | 示例账号 |
|---|---|---|
| `super_admin` | ✅ | `superadmin` / 123456 |
| `school_admin` | ✅ | `GZ001_admin` / 123456 |
| `grade_admin` | ✅ | `GZ001_grade1`（绑定高一） |
| `subject_admin` | ✅ | `GZ001_math`（绑定数学） |
| **`teacher`** | ❌ **缺失** | 无 |

**结论：PRD §24.2 users.role 明确包含 `teacher`（普通授课教师），schema 枚举里也写了 `teacher`，但 seed.ts 没有为任何学校创建 `teacher` 角色账号，后端也没有针对 `teacher` 的 `@Roles` 策略。** 建议在 seed 中为每所学校补一个 `{code}_teacher`（如 `GZ001_teacher`）账号，并在 users controller 的建用户白名单与前端组织架构页角色下拉中放开 `teacher`。

其余 seed 已覆盖：5 所学校、每校 3 年级 × 3 班 × 8 学生、3 教室 + 3 盒子、设备故障演示数据、8 条工单、家长/家长留言/辅导会话演示、8 条官网留资、每校 1 条订阅。

---

## 七、结论与建议优先级

**P0（权限安全）**
1. 后端给组织/教学/作业/考试/请假/辅导等模块补 `@Roles`，按 school_admin / grade_admin / subject_admin / teacher 收敛数据范围，不能只靠前端路由隐藏。
2. 补 `teacher` 角色的 seed 账号与权限策略。

**P1（PRD 核心缺口）**
3. 学生预警引擎（§3.10）与家校主动通知（§3.16）的自动触发。
4. 成本 ROI 报表（§3.11）页面与接口。
5. 多校区跨校区汇总报表与集团管理员角色（§3.32）。
6. 学生薄弱画像（§3.25）、县城排名（§3.27）、情绪字段（§3.28）。

**P2（完善项）**
7. 学科专项练习（§3.19）前端页面落地（表已建）。
8. 近视提醒 `rested` 字段、桌位求助键事件接入。
9. 全表补软删除与审计字段、补接口限流。
10. `User` 表补 campus_id / avatar / last_login_at。
