# C 工程增强项 设计方案

> 版本：v1.0（2026-10-09）
> 上游方案：[2026-10-08-cross-platform-migration.md](./2026-10-08-cross-platform-migration.md)（跨平台迁移 v1.1，阶段 0~4 已完成）
> 范围：该方案验收记录中「C. 工程增强项」四条的收口 —— 图表双写、旧工程下线与 CI 固化、`focusCount` 口径统一、后端聚合口径

---

## 1. 背景与目标

跨平台迁移五阶段（阶段 0~4）已全部完成并提交，H5 / 微信小程序 / Tauri 桌面三端可构建。当时把四件事留在了「工程增强」清单里，本文档是这四件事的设计。

### 1.1 目标（可核查）

1. 图表在 H5、小程序、App、桌面四端**同一套代码**渲染，不再有「只在一端存在」的图表。
2. `admin-web` / `website` / `miniprogram` 三个过渡工程归档，仓库与文档**无失效引用**；生产部署改由 uni-app H5 承载。
3. 专注率指标语义正确（`0 ≤ 专注率 ≤ 100`），且指标在真实链路中**确实被采集**。
4. 一条命令产出多端构建产物；push/PR 自动跑构建与后端测试。

### 1.2 约束

- 不改动业务行为与既有接口契约（仅新增可选字段 / 新增接口）。
- H5 与 Tauri 桌面复用同一份产物（Tauri `frontendDist` 指向 `apps/mobile/dist/build/h5`）。
- 不执行破坏性删除；归档采用 `git mv`，工作区未跟踪的 `node_modules`/`dist` 单独处理。
- 任何改动不得让既有 91 项单测 / 5 条 E2E 链路失效。

---

## 2. 现状勘误（勘察发现，修正上游记录的表述）

上游验收记录中的三条表述经核查需要修正，本文档的设计以修正后的事实为准。

### 2.1 「图表双写未做」是记录把两件事混为一谈

记录原文：*「复杂图表页（reports/roi/dashboard）当前以自绘 progress/条形 + 表格呈现，方案约定的『H5 ECharts / App·小程序 uCharts 双写』作为后续增强」*。

核查事实：

- `apps/mobile/src/pages.json` 中官网页以 `#ifdef H5` 条件注册，**H5 落地首页为 `pages-site/index`，非 H5 首页仍为 `pages/login/index`**。因此「小程序端缺官网图表」不成立——小程序端根本没有官网页面，这是设计使然。
- `dashboard` 那张唯一的柱状图（LLM 用量近 7 天）位于 super_admin 分支，按角色渲染。
- 所以「双写」被记录的缺口，实质是**同一页面内图表表现力偏弱**（只有 DOM 自绘），而非「某些端没有图表」。

### 2.2 `focusCount` 不是「口径不一致」，是**彻底未被采集**

记录原文：*「专注率显示 215% —— seed 的 aggregates 中 focusCount（专注人次）与 totalDetected（检测人数）口径不一致；已按业务定义夹取上限 100%，并记录后端聚合口径需后续统一（focusCount 应表示人数而非累计人次）」*。

核查事实（真实链路）：

```
edge-vision/src/main.py:83    bucket["totalDetected"] = len(tracks)          ← 只写这个
edge-vision/src/main.py:94    key = f"{t.behavior}Count"                      ← 各类行为计数
edge-vision/src/main.py:133   "focusCount": b.get("focusCount", 0),           ← 只读，从不写
```

- `_aggregate_per_minute()` 从不递增 `focusCount`。`behaviors.yaml` 确实定义了 `focus` 类（`label_id: 0`，`description: 专注听课`），但聚合逻辑没有把它计入 bucket。
- 全仓（含 `prisma/`、`scripts/`、`migrations/`）**不存在任何 `ClassMinuteAggregate` 种子数据**，`focusCount` 的唯一写入方是 `vision.service.ts::ingestMinuteAggregate`，数据源只有边缘端这一个生产者。
- 结论：真实链路中 `focusCount ≡ 0`，专注率恒为 0%；演示时显示的 215% 来自手工构造的请求体（28 / 13），前端 `Math.min(100, …)` 掩盖了根因。

因此本项的定性从「统一口径」升级为「**修复采集缺失 + 明确口径**」。

### 2.3 自绘图表分布在 4 个文件、共 3 类形态

| 文件 | 图表内容 | 数据点 | 形态 |
|---|---|---|---|
| `pages-admin/dashboard/index.vue` | LLM 用量近 7 天（`class="bars"` + `bar` + `barH()` 归一化） | 7 | 多值趋势柱状 |
| `pages-admin/vision/lesson-report.vue` | 每分钟行为分布（`h(a.*)` 归一化，含图例） | N（每分钟×行为） | 多值分布柱状 |
| `pages-admin/roi/index.vue` | 成本对比（`b.percent` 由 `max` 归一化，2 条） | 2 | 单值比例条 |
| `pages-admin/health/index.vue` | 设备在线率（`s.devices.onlineRate` 单值 %） | 1 | 单值比例条 |
| `pages-admin/student-report/index.vue` | 维度分(`d.value`) / 情绪占比(`e.percent`) / 知识点占比(`row.sharePercent`)，3 处 | 各 N | 单值比例条 |

注：`reports/index` 与 `reports/exams` 为表格与卡片，**无图表**；上游记录提到「reports」属概括。

---

## 3. 范围

### 3.1 做

| 编号 | 事项 |
|---|---|
| E1 | 图表：引入 uCharts，新增 `ChartBar` 通用组件；新增 `ProportionBar` 收敛重复的比例条 |
| E2 | 归档 `admin-web` / `website` / `miniprogram` → `archive/`；生产编排与启动脚本切到 uni-app H5；修 `apiBase` 生产写死问题 |
| E3 | `focusCount`：修复 edge-vision 采集；后端聚合快照可观测；前端移除夹取并写明口径 |
| E4 | CI：`scripts/build-all.ps1` 一键多端 + `.github/workflows/build.yml` |

### 3.2 明确不做（避免范围蔓延）

1. **不引入 ECharts**。方案文档字面的「H5 ECharts / 小程序·App uCharts 双写」被否决，理由见 4.1。此为**有意的方案偏离**，已在此记录存档。
2. **不把单值比例条改成 canvas 图表**。理由见 4.1。
3. **不动 `reports/*` 的表格**。表格是数据展示主体，非图表缺口。
4. **不改写历史文档**。迁移方案、官网实施方案、QA 审计报告、`admin-menus.ts` 的「迁移自 admin-web」出处注释，均为历史记录，保留原样（详见 5.2.4）。
5. **不做 HBuilderX 云打包 / 真机验收 / 各应用市场上架**。属外部依赖，非本次范围。
6. **不删除任何已跟踪文件**。归档用移动。
7. **不清理工作区未跟踪的 `node_modules`/`dist`**（约 508M）。如需，单独确认后执行。

---

## 4. 决策与备选

### 4.1 图表：uCharts 单库跨端 + 按形态选型

**决定**：

- 引入 `@qiun/ucharts@2.5.0`（npm 依赖，与项目现有「无 `uni_modules`、走 npm」的依赖方式一致）。
- 新增 `src/components/chart/ChartBar.vue`，封装 canvas + uCharts 实例生命周期（`onReady` 初始化、`canvas-id` 唯一化、props 变化重绘）。
- **只给「多数据点趋势 / 分布」上 canvas 图表**：`dashboard`（7 点趋势）、`lesson-report`（N 点分布）。
- **「单值比例条」保留 DOM 自绘**，抽为 `src/components/ProportionBar.vue`：`roi`、`health`、`student-report`（3 处）。

**理由**：

- uni-app 的条件编译是**编译期**的。若按原方案双写 ECharts/uCharts，每个图表要维护两套实现 + 两套配置，长期成本翻倍；而跨平台迁移方案自己就把「ECharts 双写」列为**高风险**条目（影响：中）。uCharts 单库正是为消除这个风险而存在。
- 单值比例条（1~2 个数据点、纯展示百分比）用 canvas 在小程序端有层级（canvas 原生组件同层渲染）与尺寸适配的坑，而 DOM 自绘零依赖体积、五端行为一致、可访问性更好。**混合方案比「全 canvas」和「全双写」都更稳、体积更小、维护面更小。**
- 该混合方案满足 1.1 的目标 1（同一套代码四端一致），且让 `dashboard`/`lesson-report` 获得真正的图表能力（坐标轴、tooltip、图例）。

**被否决的备选**：

| 备选 | 否决理由 |
|---|---|
| H5 ECharts + 其余 uCharts 双写（方案原文） | 每图表两套实现，长期维护翻倍；uni-app 条件编译为编译期，无法在运行时切换；正是上游自列的高风险项 |
| 统一改为 canvas | 单值比例条在小程序端有原生组件层级/尺寸坑，且 DOM 自绘已满足需求、零体积 |
| 不引入库，全部自绘封装（`ChartBar` 手写 DOM 柱状） | 零依赖、体积最小，但无坐标轴/刻度/tooltip，多值趋势的读图能力明显不足；放弃真实图表能力 |
| uni_modules 形式引入 uCharts | 项目无 `uni_modules` 先例；npm 依赖可被 lockfile 锁定版本，更可控 |

### 4.2 旧工程下线：归档 + 生产编排切到 uni-app H5

**决定**：

**前置修复（真正的上线阻塞项）**

`apps/mobile/src/config/env.ts` 当前把 `apiBase` 写死为 `http://127.0.0.1:3000/api/v1`（`env.ts:11-14`，标注 `TODO(上线前)`），生产不可用。改为：

```ts
const apiBase =
  (import.meta as any).env?.VITE_API_BASE ||
  (isProd ? '/api/v1' : 'http://127.0.0.1:3000/api/v1');
```

生产缺省 `/api/v1` 走同域反向代理（与既有 `admin-web/nginx.conf` 的 `/api/` 反代约定一致）。

**新增**

| 文件 | 内容 |
|---|---|
| `apps/mobile/Dockerfile` | 多阶段：`node:22-bookworm-slim` 构建（`ARG VITE_API_BASE=/api/v1`）→ `nginx:1.27-alpine` 托管 |
| `apps/mobile/nginx.conf` | 改自 `admin-web/nginx.conf`：gzip、`/assets/` 缓存、SPA `try_files` 回退、`/api/` 反代、`~ ^/(ws|wearable)/` WebSocket 反代（`client_max_body_size 100m`） |
| `archive/README.md` | 归档说明：原因、迁移对照基线、取回方式 |

**修改**

| 文件 | 改动 |
|---|---|
| `infra/docker/docker-compose.prod.yml` | 服务 `admin-web` → `mobile-web`；`context: ../../admin-web` → `../../apps/mobile`；`container_name: ait-admin` → `ait-web`；端口 `80:80` 不变 |
| `scripts/start-all.ps1` | 移除 admin-web(5173) 与 website(5174) 启动段，改为单个 uni-app H5 `5175`（与 Tauri `devUrl` 对齐） |
| `README.md` | 目录树、端口、启动步骤、「常用地址」、链接 |
| `docs/development/README.md` | 启动步骤（:46）、目录树（:94） |
| `docs/development/vision-deploy.md` | admin-web 端口/启动路径（:9、:25） |
| `docs/deploy/README.md` | 官网接口前缀指向（:59） |

**移动（非删除）**

`admin-web/` → `archive/admin-web/`、`website/` → `archive/website/`、`miniprogram/` → `archive/miniprogram/`，各自新增 `ARCHIVED.md`（归档日期、迁移去向、如何取回）。

**生产 H5 路由模式待实测确认**：uni-app H5 默认 hash 模式，若为 hash 则 `try_files` 回退实际不生效（但无害）；若非 hash 则必需。实施时实测后据此定稿 `nginx.conf` 的注释说明。

### 4.3 `focusCount`：修复生产端 + 明确口径 + 可观测

**决定**：

> ⚠️ **本节前提已于实施阶段（2026-10-09）被证伪，请以下方修正为准。原判断：`_aggregate_per_minute` 从不递增 `focusCount`（恒 0）。实际：`focusCount ≡ totalDetected`。完整证据与处理见 [验证报告](./2026-10-09-engineering-enhancements-verification.md) 第四节第 3 条。**

#### 4.3.1 原设计（已废弃的根因判断）

1. ~~**生产端根因修复**：`edge-vision/src/main.py::_aggregate_per_minute` 增加 `focus` 行为计数。~~ 该函数**本就按行为归类计数**，无需修改。

#### 4.3.2 修正后的真实情况

1. **`edge-vision` 不是生产端**：其 `README.md` 明写「本项目是模型训练/算法实验仓库，不是生产实现……行为分类头尚未训练」。生产推理由 `classroom-client/vision-service` 承担（其 README 亦声明「本目录是视觉能力的生产实现」）。
2. **`behavior` 从未被赋值**：`detector.py` 构造 `TrackedPerson` 时不传 `behavior`，恒取默认值 `"focus"`；模型 `yolo26n.pt` 是 COCO person 检测，不做行为分类。后果：`focusCount == totalDetected`（专注率恒 100%），`talkingCount`/`sleepingCount` 等恒 0，`_process_violations` 在真实数据上不触发。
3. **生产端不上报聚合**：`vision-service` 只发 WebSocket `/ws/box` 与 `POST /lesson-records/:id/behavior`，全仓无 `ClassMinuteAggregate` 生产写入方。故**没有任何生产组件产生该表**。
4. **本次处置**（不伪造结果）：在 `_aggregate_per_minute` 加显式限制注释；新增测试 `test_detector_leaves_behavior_at_default` 固定「behavior 缺省 focus」这一真实现状并提示分类头落地后更新；后端补 Redis 快照与 `/vision/config.lastAggregates` 打通「上报 → 可见」的可观测链路（已实测）；前端移除夹取并补零除兜底（如原设计第 3 点）。
5. **完整闭环的前置条件**：训练行为分类头 + 由生产端（`vision-service`）上报每分钟聚合。属产品级缺口，不在本次范围。

2. **后端可观测性**：`vision.service.ts::ingestMinuteAggregate` 在 upsert 后把该节课最新聚合快照写入 Redis（项目已有 `ioredis` 依赖），`GET /vision/config` 的响应增加 `lastAggregates`。解决「边缘端上报后因 `ClassMinuteAggregate` 无种子、无直连接口而数据库不可见、本地无法验证」的问题。仅新增响应字段，不破坏既有契约。

3. **前端**：`lesson-report.vue` 移除 `Math.min(100, …)`（:87），专注率回到「Σ focusCount / Σ totalDetected」，并在页面注明口径（每分钟平均专注人次 / 平均检测人数）。

4. **记录同步**：在 `docs/` 写明口径定义；更正上游验收记录中「专注率 215% / 夹取上限」的过时结论。

**已知边界（诚实记录）**：专注率以**每分钟人次**为分子分母。若模型输出 `focus` 的过滤宽严变化，数值会随之变化；该指标用于**同节课内的相对趋势比较**，不作跨课次绝对值比较。此限制写入文档而非隐藏。

### 4.4 CI：一键多端 + GitHub Actions

**决定**：

| 文件 | 内容 |
|---|---|
| `scripts/build-all.ps1` | 串联 H5 → mp-weixin → app → Tauri，复用已有 `scripts/build-mobile.ps1` 与 `scripts/build-desktop.ps1`，失败即停 |
| `.github/workflows/build.yml` | push/PR 触发；构建 h5 + mp-weixin + app，并跑 `backend` 的 `vitest run`；**不含 Tauri** |

**不含 Tauri 的理由**：Tauri 需 Windows runner + MSVC + NSIS 工具链（NSIS 二进制约 2.4MB 需外网下载，上游记录中曾因 GitHub 超时改为镜像断点续传），放进 CI 会显著拖慢且引入不稳定。桌面端保持本地脚本构建。

---

## 5. 逐项设计细节

### 5.1 E1 图表

**新增 `src/components/chart/ChartBar.vue`**

| prop | 类型 | 说明 |
|---|---|---|
| `type` | `'column' \| 'line'` | 图表类型，默认 `column` |
| `categories` | `string[]` | X 轴类别（如日期 `MM-DD`、分钟序号） |
| `series` | `{ name: string; data: number[] }[]` | 数据系列 |
| `height` | `number` | canvas 高度（px），默认 220 |
| `unit` | `string` | Y 轴/tooltip 单位（如 `tokens`、`人次`） |

实现要点：

- `canvas-id` 由 `Math.random()` 或注入的 `id` prop 保证唯一（同页多图必需）。
- 在 `onReady` 初始化 uCharts 实例；`watch` props 变化调用 `updateData` 重绘。
- 上下文通过 `uni.createCanvasContext(canvasId, instance)` 获取（组件内需传 `instance` 以正确定位 canvas）。
- `width` 由 `uni.createSelectorQuery()` 实测，避免硬编码。

**新增 `src/components/ProportionBar.vue`**

| prop | 类型 | 说明 |
|---|---|---|
| `value` | `number` | 百分比（0~100），内部 `Math.min(100, Math.max(0, value))` 兜底 |
| `color` | `string` | 填充色 |
| `height` | `number` | 条高，默认 10（`health`/`student-report`）或 22（`roi`） |
| `label` | `string?` | 左侧标签（`roi` 用） |

替换 4 个文件中的 `bar-track`/`bar-inner` 重复实现，并删除各文件内重复 CSS。

**测试**：H5 端浏览器实测两页渲染 + console 0 错误；`vue-tsc --noEmit` 0 错误；三端构建产物齐全。

### 5.2 E2 归档与生产

#### 5.2.1 归档前置检查

- `git mv` 保留历史；三个目录已跟踪 138 个文件（57/28/53），工作区另有约 508M 未跟踪 `node_modules`/`dist`。
- 移动前确认无「已跟踪文件依赖旧目录内相对路径」（已扫描，无）。
- 移动后 `git status` 应显示 `renamed`，无内容冲突。

#### 5.2.2 生产编排

`admin-web` 服务段整体改写为 `mobile-web`，`depends_on: backend` 与端口保留。`VITE_API_BASE` 由 build arg 注入（默认 `/api/v1`），与 `env.ts` 的前置修复配合。

#### 5.2.3 启动脚本

`start-all.ps1` 当前：Docker 中间件 → 后端 3000 → admin-web 5173 → website 5174。
改为：Docker 中间件 → 后端 3000 → uni-app H5 5175。同步 `stop-all.ps1` 的端口清理段与成功提示文案。

#### 5.2.4 文档：操作性 vs 历史性

**更新（操作性）**：`README.md`、`docs/development/README.md`、`docs/development/vision-deploy.md`、`docs/deploy/README.md`。

**保留（历史性，不改写）**：`docs/plans/2026-10-08-cross-platform-migration.md`（迁移方案本身）、`docs/product/官网正式工程实施方案.md`、`docs/qa/*`（审计报告为当时快照）、`apps/mobile/src/config/admin-menus.ts:1,77`（「迁移自 admin-web」出处注释，为有效溯源信息）、`backend/src/wechat/*`（`miniprogram-login` 是 API 名，与归档目录无关）。

`docs/plans/2026-10-08-*.md` 附录 A 已写「过渡期保留，全量迁移完成后下线（归档 docs）」，本次正是执行该条，不再改该文档。

### 5.3 E3 focusCount

见 4.3。实施顺序：先改 edge-vision 生产端 → 后端可观测 → 前端移除夹取 → 文档更新。

**验证**：`python edge-vision/scripts/test_logic.py`（已有用例，校验聚合字段集）；本地无法跑真实 RTSP，故用 `simulate_vision_event.py` 构造含 `focusCount` 的请求验证后端 upsert 与快照读取链路。

### 5.4 E4 CI

`build-all.ps1` 复用现有两个脚本，本身只做编排与错误传播，不重复构建逻辑。

---

## 6. 测试与验证策略

| 层 | 手段 | 可本地闭环 |
|---|---|---|
| 组件/渲染 | H5 浏览器实测（Playwright / 手动），console 0 错误 | ✅ |
| 类型 | `apps/mobile: npm run type-check`（vue-tsc） | ✅ |
| 构建 | `build:h5` / `build:mp-weixin` / `uni build -p app` | ✅（已有 sass 弃用警告，不影响产物） |
| 边缘端 | `python edge-vision/scripts/test_logic.py` | ✅ |
| 后端 | `cd backend && npx vitest run` | ✅ |
| 编排语法 | `docker compose -f infra/docker/docker-compose.prod.yml config` | ✅（需 `.env.prod`，缺失则仅做 YAML 解析） |
| 生产 nginx 反代实跑 | 需 Docker + 中间件 | ❌ |
| 小程序 canvas 真机渲染 | 需微信开发者工具 | ❌ |
| App 云打包 | 需 HBuilderX | ❌ |

### 6.1 验证边界（不假装通过）

以下项在本次环境**无法闭环**，将如实列入交付报告：

1. 生产 `mobile-web` 容器的 nginx 反代与 WebSocket 实跑（需 Docker 环境与 `.env.prod`）。
2. uCharts 在小程序端 canvas 的真实渲染效果（需微信开发者工具）。
3. Tauri 桌面对新 H5 产物的目视确认（本机桌面虚拟截图组件 PIP 初始化失败，上游已记录该限制）。
4. `build-all.ps1` 的 Tauri 段与 `.github/workflows/build.yml` 在真实 CI runner 的执行（本地无 CI）。workflow 语法做静态检查。

---

## 7. 风险与回退

| 风险 | 概率 | 影响 | 缓解 / 回退 |
|---|---|---|---|
| uCharts 在微信小程序 canvas 表现异常 | 中 | 中 | 组件隔离在 `chart/`；异常时该页回退 DOM 自绘（保留旧实现于 git 历史） |
| 同页多 canvas 时 `canvas-id` 冲突 | 中 | 中 | 强制唯一 id + 组件内传 `instance`；实测多图页面 |
| 归档后遗漏引用 | 中 | 低 | 实施后进行全仓引用扫描复查（见 5.2.4 分类清单） |
| 生产编排改动引入部署回归 | 中 | 高 | 端口与 `depends_on` 保持不变；`Dockerfile` 与 `nginx.conf` 从 admin-web 逐行改造而非重写 |
| `focusCount` 修复后与历史数据不可比 | 高 | 低 | 已在 4.3 声明指标为课内相对比较；历史聚合本就恒 0，无非可比性损失 |
| `build-all` 中 Tauri 段拖慢本地一键构建 | 中 | 低 | 提供 `-SkipDesktop` 开关 |

**整体回退**：四项互相独立（图表 / 归档 / focusCount / CI），任一失败可单独回退而不影响其余。

---

## 8. 交付物清单

**新增（10）**

```
apps/mobile/src/components/chart/ChartBar.vue
apps/mobile/src/components/ProportionBar.vue
apps/mobile/Dockerfile
apps/mobile/nginx.conf
scripts/build-all.ps1
.github/workflows/build.yml
archive/README.md
archive/admin-web/ARCHIVED.md
archive/website/ARCHIVED.md
archive/miniprogram/ARCHIVED.md
```

**修改（18）**

```
apps/mobile/src/config/env.ts                          # apiBase 生产修复
apps/mobile/package.json  /  package-lock.json          # @qiun/ucharts 依赖
apps/mobile/src/pages-admin/dashboard/index.vue        # → ChartBar
apps/mobile/src/pages-admin/vision/lesson-report.vue   # → ChartBar；移除 Math.min(100,…)
apps/mobile/src/pages-admin/roi/index.vue              # → ProportionBar
apps/mobile/src/pages-admin/health/index.vue           # → ProportionBar
apps/mobile/src/pages-admin/student-report/index.vue   # → ProportionBar ×3
backend/src/vision/vision.service.ts                   # 聚合快照写 Redis
backend/src/vision/vision.controller.ts / module       # GET /vision/config 增 lastAggregates
edge-vision/src/main.py                                # focusCount 采集修复
infra/docker/docker-compose.prod.yml                   # admin-web → mobile-web
scripts/start-all.ps1                                  # 端口 5173/5174 → 5175
scripts/stop-all.ps1                                   # 端口清理段同步
README.md                                              # 目录树/端口/启动/地址/链接
docs/development/README.md                             # 启动步骤 + 目录树
docs/development/vision-deploy.md                      # admin-web 端口/启动路径
docs/deploy/README.md                                  # 官网接口前缀指向
```

**移动（3）**：`admin-web/`、`website/`、`miniprogram/` → `archive/`

---

## 9. 遗留与后续（不在本次范围）

1. App（Android/iOS）云打包与真机验收 —— 需 HBuilderX。
2. 真实支付/推送闭环、桌面自动更新版本服务器、Windows 代码签名 —— 需外部账号与服务器。
3. 各应用市场上架材料 —— 需资质。
4. `focusCount` 若需表示「人数」而非「人次」，需边缘端按 track 去重（当前模型输出为逐帧行为，去重需额外跟踪状态）；本次先统一为分钟人次口径并记录该差异。