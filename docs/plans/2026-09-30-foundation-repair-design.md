# 地基修复 · 设计文档

> 日期：2026-09-30
> 状态：已确认（范围与两项决策均经用户拍板）
> 关联计划：`docs/plans/2026-09-30-foundation-repair.md`

## 一、背景

AI Teacher 项目软件侧功能已基本完整（42 个 controller / 51 张 model / QA 50 项回归通过），但**数据地基不可信**。经代码核实，`backend/src/evaluations/evaluations.service.ts` 的课后打分函数存在三个缺陷，而该函数产出的 `Evaluation.score` 是所有下游功能的输入源：

```
Evaluation.score
  ├─ 学生综合报告 studentReport
  ├─ 班级排名 / 年级排名 / 跨校排名（含县城排名）
  ├─ StudentProfile.overallScore
  ├─ 家长端成绩展示
  └─ 学生预警引擎「成绩下滑」规则（2026-09-30 新增）
```

## 二、问题清单（已核实）

### 缺陷 1：participation 是随机数
`evaluations.service.ts:36`
```ts
const participationScore = 80 + Math.floor(Math.random() * 20); // TODO: 接入举手/回答数据
```

### 缺陷 2：homework 是随机数
`evaluations.service.ts:37`
```ts
const homeworkScore = 85 + Math.floor(Math.random() * 15); // TODO: 接入作业数据
```

两项合计占 `overall` 权重 **50%**（各 25%），即总分有一半是噪声。

### 缺陷 3：disciplineScore 反向扣分（比随机数更严重）
`evaluations.service.ts:35`
```ts
const events = record.behaviorEvents.filter((e) => e.studentId === student.id);
const disciplineScore = Math.max(0, 100 - events.length * 10 - warnings.reduce(...));
```

`events` 是**全部**行为事件。而 `BehaviorEvent.type` 含 10 类，其中 `focus`（专注）、`hand_raise`（举手）、`writing`（写字）、`standing`（起立）属于**正常行为**。按此公式，**学生越专注、举手越多，纪律分反而越低**——逻辑方向反了。

（注：`realtime.gateway.ts` 的事件处理目前多为日志桩，`BehaviorEvent` 实际由边缘端 `POST /lesson-records/:id/behavior` 写入，按视觉设计文档会上报全部 10 类。）

## 三、范围（用户已确认）

**包含**：
1. **数据可信度** —— 修复上述三个缺陷，接真实数据源
2. **端到端验证** —— 中间件就绪 + `prisma db push` + 可重复运行的验证脚本
3. **架构收敛** —— 两套视觉代码、两套上课逻辑的归属与文档修正

**明确排除**：
- PRD 剩余 3 项缺口（调课整体顺延、学生薄弱画像、集团管理员 seed + 跨校区报表）
- 多 Agent 编排
- `lesson-agent` 真正转正（前置工程：补业务节点，独立立项）

## 四、决策记录

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 视觉代码收敛 | **以 `classroom-client/vision-service/` 为主**，`edge-vision/` 降级为「YOLO26 模型训练实验仓库」 | vision-service 已完整（face/behavior/audio/network/ocr）；edge-vision 缺 `behavior_classifier.py` 且需训练模型，短期不可用。但 YOLO26 是长期方向，故保留为实验仓库而非删除 |
| 上课逻辑处理 | **只标注 + 修文档**，不动主流程 | `lesson-agent` 业务节点仍为占位（点名写死全员到齐、讲稿为固定文本），现在切换是功能退化。真正切换需先补业务节点，独立立项 |
| 本次范围 | 只含地基三项 | 先修地基，不加功能 |

## 五、技术方案

### 5.1 抽取纯函数（可测试）

把打分逻辑从 `EvaluationsService` 私有方法中抽到独立模块 `src/evaluations/lesson-scoring.ts`，成为**无副作用的纯函数**，便于单元测试：

- `computeLessonScores(input): { overall, dimensions }`
- `inferEmotion(input): 'positive' | 'neutral' | 'negative'`

### 5.2 真实数据源映射

| 维度 | 数据源 | 公式 | 无数据时 |
|---|---|---|---|
| attendance | `Attendance.status` | present=100 / late=70 / 其他=0 | 0 |
| discipline | `BehaviorEvent`(category=violation) + `Warning.scoreDeduction` | `max(0, 100 - 违纪数×10 - 扣分)` | 100 |
| participation | `BehaviorEvent`(type=hand_raise) 计数 | `min(100, 70 + 举手数×10)` | 70 |
| homework | `Submission.score`（同科最近 5 次已批改） | 均分 | 80（中性分） |

### 5.3 数据来源透明化

不假装有数据。在 `dimensions` 内新增保留键 `_sources` 记录每个维度的来源（`behavior` / `submission` / `default`）。前端只读 `attendance`/`discipline`/`participation`/`homework` 四个键，新增键不影响现有页面。

## 六、验收标准

1. `src/evaluations/lesson-scoring.spec.ts` 全部通过，且**同一输入多次调用结果完全一致**（证明无随机性）
2. 边界用例通过：无违纪事件 → discipline=100；有正常行为（focus/hand_raise）但无违纪 → discipline 不下降
3. 端到端脚本跑通「造课 → 打分 → 情绪 → 预警 → 排名」并打印可读结果
4. 后端 `tsc --noEmit` 0 错误
5. 文档中不再出现 `behavior_classifier.py` 等不存在的文件声明

## 七、风险

| 风险 | 应对 |
|---|---|
| 中间件启动失败（历史上有 MinIO 镜像拉取失败） | 阶段 0 允许降级：Postgres 必须起，MinIO 起不来不阻塞打分链路验证 |
| 现有 seed 数据缺少 `Submission` 记录，homework 全走默认分 | 端到端脚本会**主动创建**带分数的 Submission，确保覆盖真实路径 |
| `dimensions` 增加 `_sources` 键影响前端 | 已确认前端按具体键读取，不遍历；且 `Evaluation.dimensions` 为 Json 类型，无 schema 约束 |
