# C 工程增强项 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收口跨平台迁移遗留的四项工程增强 —— 图表跨端一致、旧工程归档并切换生产、`focusCount` 采集修复与口径统一、一键构建与 CI 固化。

**Architecture:** 前端在 uni-app 内引入 uCharts 单库（多值趋势图）并以 DOM 组件收敛单值比例条；后端在 `vision` 模块加 Redis 聚合快照以打通「边缘端上报 → 数据库可见」的可观测链路；边缘端修 `focusCount` 采集缺失；部署侧用 uni-app H5 产物替换 `admin-web` 容器，旧三工程 `git mv` 归档。

**Tech Stack:** uni-app（Vue3 + Vite + TS）、uCharts 2.5、NestJS 12 + Prisma 5 + Redis（BullMQ 连接）、Python（edge-vision）、Docker/nginx、PowerShell、GitHub Actions

**Spec:** [docs/plans/2026-10-09-engineering-enhancements-design.md](./2026-10-09-engineering-enhancements-design.md)

## Global Constraints

- 不改动业务行为与既有接口契约；后端仅**新增可选响应字段**，不删不改既有字段。
- H5 与 Tauri 桌面复用同一份产物（Tauri `frontendDist` = `apps/mobile/dist/build/h5`）—— 改 H5 产物结构即等同改桌面端。
- **不执行破坏性删除**；归档一律 `git mv`。项目内任何大范围删除需先人工确认。
- 所有文件读写严格限制在 `E:\AITeacher` 及其子目录内；不访问项目外任何路径。
- 任何改动不得让既有 91 项后端单测 / 5 条 E2E 链路失效。
- 依赖版本锁定：`@qiun/ucharts@2.5.0`。Node 22（对齐 `admin-web/Dockerfile` 的 `node:22-bookworm-slim`）。
- 前端**无单测框架**（`apps/mobile/package.json` 无 vitest/jest）。前端验证 = `npm run type-check`（vue-tsc）+ H5 浏览器实测 + 三端构建。**不为此引入测试框架**（超出范围）。
- Tauri 版本、`apps/desktop` 配置本次**不改**。

## Review Focus

以下 5 类输入/条件是 spec 隐含要求但不会被单测自然覆盖的，各自在归属任务的步骤里被验证：

1. `ProportionBar` 收到 `null` / `undefined` / `NaN`（接口字段缺失）→ 应渲染 0 宽度条，**不得**出现 `NaN%` 或满条。→ Task 1
2. `ChartBar` 在 `categories` 为空、或 `series` 全为 0 时 → 不得抛错、不得白屏。→ Task 2
3. 同一页面出现两个 `ChartBar`（`canvas-id` 冲突）→ 两张图各自独立渲染，不串图。→ Task 2
4. `lesson-report` 专注率在 `Σ totalDetected === 0`（无检测数据）时 → 显示 `—`，不得显示 `NaN%`。→ Task 4
5. `edge-vision` 某一分钟 `tracks` 为空 → `focusCount` 与 `totalDetected` 均为 0，不抛错。→ Task 6

---

## 文件结构

**新增**

| 文件 | 职责 |
|---|---|
| `apps/mobile/src/components/ProportionBar.vue` | 单值百分比条（唯一职责：把一个 0~100 的数值画成一条带兜底的进度条） |
| `apps/mobile/src/components/chart/ChartBar.vue` | uCharts canvas 封装（唯一职责：多值类别柱/折线图的生命周期与配置） |
| `apps/mobile/Dockerfile` | uni-app H5 多阶段构建 → nginx 托管 |
| `apps/mobile/nginx.conf` | H5 静态托管 + `/api/`、`/ws`、`/wearable` 反代 |
| `scripts/build-all.ps1` | 一键多端构建编排 |
| `.github/workflows/build.yml` | CI：三端构建 + 后端单测 |
| `archive/README.md` + `archive/{admin-web,website,miniprogram}/ARCHIVED.md` | 归档说明 |

**修改**

| 文件 | 改动 |
|---|---|
| `apps/mobile/package.json` | 增 `@qiun/ucharts@2.5.0` |
| `apps/mobile/src/config/env.ts` | `apiBase` 生产读 `VITE_API_BASE`，缺省 `/api/v1` |
| `apps/mobile/src/pages-admin/dashboard/index.vue` | LLM 用量 → `ChartBar` |
| `apps/mobile/src/pages-admin/vision/lesson-report.vue` | 行为趋势 → `ChartBar`；删误导性归一化与 `Math.min(100,…)` |
| `apps/mobile/src/pages-admin/roi/index.vue` | 成本对比 → `ProportionBar` |
| `apps/mobile/src/pages-admin/health/index.vue` | 在线率 → `ProportionBar` |
| `apps/mobile/src/pages-admin/student-report/index.vue` | 维度/情绪/知识点 → `ProportionBar` ×3 |
| `backend/src/vision/vision.service.ts` | 聚合快照写 Redis；`getEdgeConfig` 暴露 `lastAggregates` |
| `backend/src/vision/vision.service.spec.ts` | **新增**：快照与兜底单测 |
| `edge-vision/src/main.py` | `focusCount` 采集修复 |
| `edge-vision/scripts/test_logic.py` | 增 `_aggregate_per_minute` 用例 |
| `infra/docker/docker-compose.prod.yml` | `admin-web` 服务 → `mobile-web` |
| `scripts/start-all.ps1` / `stop-all.ps1` | 端口 5173/5174 → 5175 |
| `README.md` / `docs/development/README.md` / `docs/development/vision-deploy.md` / `docs/deploy/README.md` | 路径与端口同步 |

**移动**：`admin-web/`、`website/`、`miniprogram/` → `archive/`

---

## Task 1: ProportionBar 组件与 4 处比例条替换

**Files:**
- Create: `apps/mobile/src/components/ProportionBar.vue`
- Modify: `apps/mobile/src/pages-admin/roi/index.vue:17-22`（模板）、`apps/mobile/src/pages-admin/roi/index.vue:130-132`（删 CSS）
- Modify: `apps/mobile/src/pages-admin/health/index.vue:31-33`（模板）、`apps/mobile/src/pages-admin/health/index.vue:123-124`（删 CSS）
- Modify: `apps/mobile/src/pages-admin/student-report/index.vue:38-41,54-57,73-77`（模板）、`apps/mobile/src/pages-admin/student-report/index.vue:290-291`（删 CSS）

**Interfaces:**
- Produces: `ProportionBar.vue`，props `{ value: number | null | undefined; color?: string = '#8b2e2e'; height?: number = 12; radius?: number = 6 }`。根元素 `flex: 1; width: 100%`，在 flex 父容器中自适应、在块级父容器中占满整行。

- [ ] **Step 1: 创建组件**

创建 `apps/mobile/src/components/ProportionBar.vue`：

```vue
<template>
  <view class="pb-track" :style="{ height: height + 'px', borderRadius: radius + 'px' }">
    <view
      class="pb-inner"
      :style="{ width: pct + '%', background: color, borderRadius: radius + 'px' }"
    ></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 百分比，0~100；null/undefined/NaN 一律按 0 处理 */
    value: number | null | undefined
    color?: string
    height?: number
    radius?: number
  }>(),
  { color: '#8b2e2e', height: 12, radius: 6 },
)

// 兜底：非有限数按 0；同时夹取到 0~100，避免出现 NaN% 或溢出条（Review Focus #1）
const pct = computed(() => {
  const n = Number(props.value)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
})
</script>

<style>
.pb-track {
  flex: 1;
  width: 100%;
  background: rgba(43, 43, 43, 0.07);
  overflow: hidden;
}
.pb-inner {
  height: 100%;
}
</style>
```

- [ ] **Step 2: 替换 roi 成本对比**

`apps/mobile/src/pages-admin/roi/index.vue` 中把（约 17-22 行）：

```html
        <view class="bar-track big">
          <view class="bar-inner" :style="{ width: b.percent + '%', background: b.color }"></view>
        </view>
```

替换为：

```html
        <ProportionBar :value="b.percent" :color="b.color" :height="22" />
```

并在 `<script setup>` 的 import 区加入：

```ts
import ProportionBar from '@/components/ProportionBar.vue'
```

随后删除该文件 CSS 中的 `.bar-track`、`.bar-track.big`、`.bar-inner` 三条规则（约 130-132 行）。

- [ ] **Step 3: 替换 health 在线率**

`apps/mobile/src/pages-admin/health/index.vue` 中把（约 31-33 行）：

```html
          <view class="bar-track">
            <view class="bar-inner" :style="{ width: s.devices.onlineRate + '%', background: rateColor(s.devices.onlineRate) }"></view>
          </view>
```

替换为：

```html
          <ProportionBar :value="s.devices.onlineRate" :color="rateColor(s.devices.onlineRate)" :height="10" :radius="5" />
```

在 `<script setup>` import 区加入 `import ProportionBar from '@/components/ProportionBar.vue'`，并删除 CSS 中 `.bar-track`、`.bar-inner`（约 123-124 行）。

- [ ] **Step 4: 替换 student-report 三处**

`apps/mobile/src/pages-admin/student-report/index.vue`：

维度条（约 39-41 行）：

```html
            <view class="bar-track">
              <view class="bar-inner" :style="{ width: Math.min(100, Math.round(d.value)) + '%', background: dimColor(d.value) }"></view>
            </view>
```

→

```html
            <ProportionBar :value="Math.round(d.value)" :color="dimColor(d.value)" />
```

情绪条（约 55-57 行）：

```html
            <view class="bar-track">
              <view class="bar-inner" :style="{ width: e.percent + '%', background: e.color }"></view>
            </view>
```

→

```html
            <ProportionBar :value="e.percent" :color="e.color" />
```

知识点占比条（约 74-76 行，在 `SimpleTable` 插槽内）：

```html
            <view class="bar-track">
              <view class="bar-inner" style="background:#8b2e2e" :style="{ width: Math.min(100, row.sharePercent || 0) + '%' }"></view>
            </view>
```

→

```html
            <ProportionBar :value="row.sharePercent" />
```

在 `<script setup>` import 区加入 `import ProportionBar from '@/components/ProportionBar.vue'`，删除 CSS 中 `.bar-track`、`.bar-inner`（约 290-291 行）。

- [ ] **Step 5: 类型检查**

Run: `cd apps/mobile && npm run type-check`
Expected: 0 error。若报 `ProportionBar` 未使用或路径解析失败，检查 import 路径大小写（`@/components/ProportionBar.vue`）。

- [ ] **Step 6: H5 浏览器实测（含 Review Focus #1）**

Run: `cd apps/mobile && npm run dev:h5`（默认 5175；若被占用以终端输出端口为准）
打开 roi、health、student-report 三页，确认：
- 比例条宽度与数值相符、四条 CSS 复用后视觉与替换前一致；
- console 0 错误。
**Review Focus #1 验证**：在浏览器 DevTools 里把某一页数据置为缺字段（或临时把模板某处 `:value` 改为 `undefined`），确认该条形宽度为 0 且**不出现 `NaN%`**；验证后还原。

- [ ] **Step 7: 提交**

```bash
git add apps/mobile/src/components/ProportionBar.vue \
        apps/mobile/src/pages-admin/roi/index.vue \
        apps/mobile/src/pages-admin/health/index.vue \
        apps/mobile/src/pages-admin/student-report/index.vue
git commit -m "refactor(mobile): 抽出 ProportionBar 统一单值比例条（roi/health/student-report 4 处复用）"
```

---

## Task 2: uCharts ChartBar 组件

**Files:**
- Modify: `apps/mobile/package.json`（新增依赖）
- Create: `apps/mobile/src/components/chart/ChartBar.vue`

**Interfaces:**
- Consumes: 无。
- Produces: `ChartBar.vue`，props `{ categories: string[]; series: { name: string; data: number[] }[]; height?: number = 240; unit?: string = ''; type?: 'column' | 'line' = 'column' }`。

- [ ] **Step 1: 安装依赖并核对真实 API**

Run:
```bash
cd apps/mobile
npm install @qiun/ucharts@2.5.0 --save
```

安装成功后**先读包内文档/类型确认构造签名**（uCharts 各版本构造函数参数不同，必须先核对再写代码）：

```bash
cat node_modules/@qiun/ucharts/package.json
ls node_modules/@qiun/ucharts
# 找到入口文件与类型声明，确认：默认导出是什么、new uCharts({...}) 需要哪些必填字段
```

记录 `main`/`module`/`types` 字段与实际导出形态。**若该包无法通过 `import uCharts from '@qiun/ucharts'` 引入，或缺少 uni-app 的 `context` 参数支持，停止并在 Task 完成说明中报告，改走 Task 2 备选（见 Step 6）。**

- [ ] **Step 2: 创建组件**

按 Step 1 核对到的真实签名，创建 `apps/mobile/src/components/chart/ChartBar.vue`。以下为 v2.5 通用形态（**若与 Step 1 核对结果不符，以核对结果为准修正**）：

```vue
<template>
  <view class="cb">
    <canvas
      class="cb-canvas"
      :canvas-id="cid"
      :id="cid"
      :style="{ width: '100%', height: height + 'px' }"
    />
    <view v-if="!hasData" class="cb-empty">暂无数据</view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted } from 'vue'
import uCharts from '@qiun/ucharts'

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: { name: string; data: number[] }[]
    height?: number
    unit?: string
    type?: 'column' | 'line'
  }>(),
  { height: 240, unit: '', type: 'column' },
)

const instance = getCurrentInstance()
// canvas-id 必须全局唯一，否则同页多图会串图（Review Focus #3）
const cid = `cb-${Math.random().toString(36).slice(2, 9)}`
let chart: any = null

const hasData = computed(
  () => props.categories.length > 0 && props.series.some((s) => s.data.some((v) => Number(v) > 0)),
)

function render() {
  if (!hasData.value) return
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select(`#${cid}`)
    .boundingClientRect((rect: any) => {
      if (!rect || !rect.width) return
      const context = uni.createCanvasContext(cid, instance?.proxy)
      const cfg: any = {
        type: props.type,
        context,
        canvasId: cid,
        width: rect.width,
        height: props.height,
        categories: props.categories,
        series: props.series.map((s) => ({ ...s, data: s.data.map((v) => Number(v) || 0) })),
        padding: [15, 15, 0, 8],
        legend: { show: props.series.length > 1, position: 'bottom', fontSize: 11 },
        yAxis: { gridType: 'dash', dashLength: 2, data: [{ title: props.unit, min: 0 }] },
        xAxis: { disableGrid: true, itemCount: props.categories.length > 8 ? 6 : props.categories.length },
        extra: { column: { width: props.series.length > 2 ? 8 : 20 } },
      }
      if (!chart) {
        chart = new uCharts(cfg)
      } else {
        chart.updateData(cfg)
      }
    })
    .exec()
}

onMounted(() => {
  // 等 canvas 完成布局后再绘制
  setTimeout(render, 50)
})
</script>

<style>
.cb {
  position: relative;
  width: 100%;
}
.cb-canvas {
  display: block;
}
.cb-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #999;
}
</style>
```

- [ ] **Step 3: 类型检查**

Run: `cd apps/mobile && npm run type-check`
Expected: 0 error。若 `@qiun/ucharts` 无类型声明导致 `TS7016`，在 `apps/mobile/shims-uni.d.ts`（已存在）追加声明：

```ts
declare module '@qiun/ucharts'
```

- [ ] **Step 4: 用临时页面验证渲染（含 Review Focus #2、#3）**

在 `apps/mobile/src/pages-admin/dashboard/index.vue` 中临时插入两个 `ChartBar`（一个 7 类 1 序列、一个 3 类 2 序列）并启动 `npm run dev:h5`，确认：
- 两张图各自渲染且互不串图（Review Focus #3）；
- 传空 `categories: []` 的第三个实例显示「暂无数据」且不抛错（Review Focus #2）；
- console 0 错误。
验证后**移除临时插入内容**（不要提交）。

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json \
        apps/mobile/src/components/chart/ChartBar.vue apps/mobile/shims-uni.d.ts
git commit -m "feat(mobile): 引入 uCharts，新增跨端 ChartBar 图表组件"
```

- [ ] **Step 6: 备选（仅当 Step 1 判定 uCharts npm 包不可用）**

若 npm 包无法按预期引入：停止 uCharts 路线，改为在 `ChartBar.vue` 内实现**纯 DOM 柱状图**（共享最大值 + 真实刻度 + 图例），并保留同名 props 契约不变，使 Task 3/4 不受影响。此时在 Task 完成说明中明确记录「uCharts 未落地，已降级为 DOM 实现」，并同步更新 spec 的 4.1 节。

---

## Task 3: dashboard 接入 ChartBar

**Files:**
- Modify: `apps/mobile/src/pages-admin/dashboard/index.vue`（模板 37-42 行、脚本 115-118 行、CSS 236-263 行）

**Interfaces:**
- Consumes: `ChartBar`（Task 2）的 `categories` / `series` / `height` / `unit` props。
- Produces: 无（终端页面）。

- [ ] **Step 1: 替换模板中的自绘柱状**

`apps/mobile/src/pages-admin/dashboard/index.vue` 约 36-43 行，把：

```html
      <view class="panel">
        <view class="panel-title">LLM 用量（近7天，总 {{ usage.totalTokens || 0 }} tokens）</view>
        <view class="bars">
          <view v-for="d in last7" :key="d.date" class="bar-col">
            <view class="bar" :style="{ height: barH(d.tokens) }"></view>
            <view class="bar-lab">{{ d.date.slice(5) }}</view>
          </view>
        </view>
      </view>
```

替换为：

```html
      <view class="panel">
        <view class="panel-title">LLM 用量（近7天，总 {{ usage.totalTokens || 0 }} tokens）</view>
        <ChartBar :categories="usageCategories" :series="usageSeries" :height="220" unit="tokens" />
      </view>
```

- [ ] **Step 2: 改脚本**

在 `<script setup>` import 区加入：

```ts
import ChartBar from '@/components/chart/ChartBar.vue'
```

把原来的 `last7` / `barH` 两个定义（约 115-118 行）：

```ts
const last7 = computed(() => (usage.value.daily || []).slice(-7))
function barH(t: number) {
  const max = Math.max(1, ...last7.value.map((d: any) => d.tokens))
  return Math.max(4, (t / max) * 120) + 'px'
}
```

替换为：

```ts
const last7 = computed(() => (usage.value.daily || []).slice(-7))
/** X 轴：MM-DD（去掉年份，避免标签过密） */
const usageCategories = computed(() => last7.value.map((d: any) => String(d.date || '').slice(5)))
/** 单序列：每日 token 用量（真实值，由图表自行定轴） */
const usageSeries = computed(() => [
  { name: 'tokens', data: last7.value.map((d: any) => Number(d.tokens) || 0) },
])
```

- [ ] **Step 3: 删废弃 CSS**

删除该文件中已不再使用的 `.bars`、`.bar-col`、`.bar`、`.bar-lab` 四条规则（约 236-263 行）。

- [ ] **Step 4: 类型检查 + H5 实测**

Run: `cd apps/mobile && npm run type-check`
Expected: 0 error。
Run: `cd apps/mobile && npm run dev:h5`，以 super_admin 登录看 dashboard，确认 LLM 用量图渲染出 7 根柱、X 轴为 `MM-DD`、无 console 错误。**若 `usage.daily` 为空**（接口无数据），确认显示「暂无数据」占位而非白屏。

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/src/pages-admin/dashboard/index.vue
git commit -m "feat(mobile): dashboard LLM 用量改用 ChartBar 真实定轴图表"
```

---

## Task 4: lesson-report 换 ChartBar + 修误导性归一化 + 移除专注率夹取

**Files:**
- Modify: `apps/mobile/src/pages-admin/vision/lesson-report.vue`（模板 20-41 行、脚本 61-117 行、CSS 158-171 行）

**Interfaces:**
- Consumes: `ChartBar`（Task 2）的 `categories` / `series` / `unit` props。
- Produces: 无。

**背景（必须理解再改）**：现图 Y 轴刻度写死 `[20,15,10,5,0]`（真实人次），但柱高用 `h(v) = Math.round((v / 该分钟最大值) × 100)` —— **每分钟各自归一化**，导致 `focusCount=20` 与 `focusCount=1` 都顶到 100%，Y 轴数字与柱高不对应，图表会误导人；X 轴标签还是完整 ISO 时间串。换 ChartBar 后由图表按真实值定轴，两个问题一并消除。

- [ ] **Step 1: 替换模板柱状图与图例**

`apps/mobile/src/pages-admin/vision/lesson-report.vue` 约 20-41 行，把整个「柱状图」`<view class="panel">…</view>`（含 `.chart`、`.y-axis`、`.plot`、`.legend`）替换为：

```html
      <!-- 柱状图 -->
      <view class="panel">
        <view class="panel-title">每分钟行为分布</view>
        <ChartBar :categories="chartCategories" :series="chartSeries" :height="260" unit="人次" />
        <view class="legend">
          <view v-for="l in legend" :key="l.label" class="legend-item">
            <view class="dot" :style="{ background: l.color }"></view>
            <text class="legend-text">{{ l.label }}</text>
          </view>
        </view>
      </view>
```

（`.legend` 相关 CSS 保留；`.chart`、`.y-axis`、`.y-tick`、`.plot`、`.bar-group`、`.bar`、`.x-label` 后续删除。）

- [ ] **Step 2: 改脚本**

在 import 区加入：

```ts
import ChartBar from '@/components/chart/ChartBar.vue'
```

删除 `yTicks` 常量（约 75 行 `const yTicks = [20, 15, 10, 5, 0]`）与 `chartPoints` 计算属性（约 97-117 行），替换为：

```ts
/** X 轴：分钟序号（HH:mm），取最近 20 分钟 */
const chartCategories = computed(() =>
  aggregates.value.slice(-20).map((a) => {
    const raw = String(a.minuteStart || '')
    const m = raw.match(/T(\d{2}:\d{2})/)
    return m ? m[1] : raw.slice(-5)
  }),
)

/** 7 条行为序列，值为真实人次，由 ChartBar 统一按最大值定轴 */
const chartSeries = computed(() => {
  const rows = aggregates.value.slice(-20)
  const pick = (key: string) => rows.map((a) => Number(a[key]) || 0)
  return [
    { name: '专注', data: pick('focusCount') },
    { name: '举手', data: pick('handRaiseCount') },
    { name: '说话', data: pick('talkingCount') },
    { name: '睡觉', data: pick('sleepingCount') },
    { name: '手机', data: pick('phoneCount') },
    { name: '吃东西', data: pick('eatingCount') },
    { name: '离开', data: pick('leavingCount') },
  ]
})
```

- [ ] **Step 3: 移除专注率夹取并补零除兜底（含 Review Focus #4）**

把 `focusRate` 计算属性（约 83-88 行）：

```ts
const focusRate = computed(() => {
  const total = aggregates.value.reduce((s, a) => s + (a.totalDetected || 0), 0)
  const focus = aggregates.value.reduce((s, a) => s + (a.focusCount || 0), 0)
  // 专注率物理上限 100%；focusCount 与 totalDetected 口径不一致时夹取，后端聚合口径待统一（见验收记录）
  return total ? Math.min(100, Math.round((focus / total) * 100)) + '%' : '—'
})
```

替换为：

```ts
const focusRate = computed(() => {
  const total = aggregates.value.reduce((s, a) => s + (Number(a.totalDetected) || 0), 0)
  const focus = aggregates.value.reduce((s, a) => s + (Number(a.focusCount) || 0), 0)
  // 口径：每分钟「专注听课」人次 / 每分钟检测人次（见 docs/plans/2026-10-09-...-design.md 4.3）
  if (!total) return '—' // 无检测数据时不显示 NaN%（Review Focus #4）
  return Math.round((focus / total) * 100) + '%'
})
```

- [ ] **Step 4: 删废弃 CSS**

删除 `.chart`、`.y-axis`、`.y-tick`、`.plot`、`.bar-group`、`.bar`、`.x-label` 七条规则（约 158-167 行）。保留 `.legend`、`.legend-item`、`.dot`、`.legend-text`。

- [ ] **Step 5: 专注率口径注释同步**

在该文件顶部 `<style>` 之前的 script 内不加额外注释；口径说明已内联在 `focusRate` 上方。确认注释中的 spec 路径拼写与真实文件名一致：`docs/plans/2026-10-09-engineering-enhancements-design.md`。

- [ ] **Step 6: 类型检查 + H5 实测**

Run: `cd apps/mobile && npm run type-check`
Expected: 0 error。
Run: `cd apps/mobile && npm run dev:h5`，进入「课堂行为分析」，输入一个存在的课次 ID 查询：
- 柱状图 7 序列按真实人次渲染，X 轴为 `HH:mm`；
- 图例显示 7 项；
- **Review Focus #4 验证**：把 `lessonRecordId` 换成无聚合数据的课次（如 999999），确认卡片专注率显示 `—`（不出现 `NaN%`）；
- console 0 错误。

- [ ] **Step 7: 提交**

```bash
git add apps/mobile/src/pages-admin/vision/lesson-report.vue
git commit -m "fix(mobile): 课堂行为图改 ChartBar 真实定轴，消除每分钟归一化误导；专注率去夹取并补零除兜底"
```

---

## Task 5: env.ts 生产 apiBase 修复

**Files:**
- Modify: `apps/mobile/src/config/env.ts:6-19`

**Interfaces:**
- Produces: `ENV.apiBase` —— 生产优先 `import.meta.env.VITE_API_BASE`，缺省 `/api/v1`（同域反代）。Task 8/9 的 Dockerfile `ARG VITE_API_BASE` 依赖此项。

- [ ] **Step 1: 改写 resolveEnv**

`apps/mobile/src/config/env.ts` 全文替换为：

```ts
/**
 * 多环境配置
 * - dev：本地开发（后端默认 3000）
 * - prod：生产环境走同域反向代理 `/api/v1`，或用构建期 VITE_API_BASE 覆盖为正式 HTTPS 域名
 */
function resolveEnv() {
  // uni-app 各端编译时均注入 import.meta.env：dev=h5 开发 / build=production
  const viteEnv: any = (import.meta as any)?.env || {}
  const mode = viteEnv.MODE || 'development'
  const isProd = mode === 'production'
  // 小程序端无同域概念，需显式配置 VITE_API_BASE；缺失时回退本地地址避免 undefined 拼接（Review Focus #4）
  const apiBase = viteEnv.VITE_API_BASE || (isProd ? '/api/v1' : 'http://127.0.0.1:3000/api/v1')
  return { apiBase, mode }
}

export const ENV = resolveEnv()

export const APP_INFO = {
  name: 'AI Teacher',
  version: '1.0.0',
} as const;
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/mobile && npm run type-check`
Expected: 0 error。

- [ ] **Step 3: 验证 dev 与 prod 两种取值**

Run:
```bash
cd apps/mobile
npx cross-env VITE_API_BASE= node -e "console.log('dev 用默认')" || true
npm run dev:h5
```
在 dev 下确认请求仍打到 `http://127.0.0.1:3000/api/v1`（登录页能连上后端）。
再构建一次生产产物并检查注入：

```bash
npm run build:h5
grep -ro "http://127.0.0.1:3000" dist/build/h5/assets | head
```
Expected: **生产产物中不出现** `http://127.0.0.1:3000` 字样（说明走了 `/api/v1`）。若出现，回到 Step 1 检查 mode 判定。

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/src/config/env.ts
git commit -m "fix(mobile): 生产 apiBase 改读 VITE_API_BASE，缺省同域 /api/v1（修死写 127.0.0.1）"
```

---

## Task 6: edge-vision focusCount 采集修复

**Files:**
- Modify: `edge-vision/src/main.py:79-87`（`_aggregate_per_minute`）
- Modify: `edge-vision/scripts/test_logic.py`（增用例）

**Interfaces:**
- Produces: `_aggregate_per_minute(tracks)` 使 `bucket["focusCount"]` 与 `totalDetected` 同口径递增（每分钟人次）。`main.py:133` 的 `b.get("focusCount", 0)` 依赖此键。

- [ ] **Step 1: 写失败测试**

在 `edge-vision/scripts/test_logic.py` 的函数区内（`test_minute_aggregate_keys` 之后、`if __name__` 之前）加入：

```python
def test_aggregate_counts_focus():
    """_aggregate_per_minute 必须把 focus 行为计入 focusCount（此前只计 totalDetected，专注率恒 0）。"""
    from collections import defaultdict
    import time as _time

    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.minute_buckets = defaultdict(lambda: defaultdict(int))

    tracks = [
        TrackedPerson(track_id=1, bbox=(0, 0, 10, 10), confidence=0.9, center=(5, 5), behavior="focus"),
        TrackedPerson(track_id=2, bbox=(0, 0, 10, 10), confidence=0.9, center=(5, 5), behavior="focus"),
        TrackedPerson(track_id=3, bbox=(0, 0, 10, 10), confidence=0.9, center=(5, 5), behavior="talking"),
    ]
    p._aggregate_per_minute(tracks)

    bucket = p.minute_buckets[int(_time.time() // 60)]
    assert bucket["totalDetected"] == 3, "检测人数应为 3"
    assert bucket["focusCount"] == 2, "专注人次应为 2（本轮修复前恒为 0）"
    assert bucket["talkingCount"] == 1, "说话人次应为 1"
    print("✓ focusCount 采集正确")


def test_aggregate_empty_tracks():
    """空检测帧：所有计数为 0，不抛错（Review Focus #5）。"""
    from collections import defaultdict
    import time as _time

    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.minute_buckets = defaultdict(lambda: defaultdict(int))
    p._aggregate_per_minute([])

    bucket = p.minute_buckets[int(_time.time() // 60)]
    assert bucket["totalDetected"] == 0
    assert bucket["focusCount"] == 0
    print("✓ 空帧聚合安全")
```

并在文件底部 `if __name__ == "__main__":` 的调用清单里追加：

```python
    test_aggregate_counts_focus()
    test_aggregate_empty_tracks()
```

- [ ] **Step 2: 运行确认失败**

Run:
```bash
cd edge-vision && python scripts/test_logic.py
```
Expected: FAIL —— `AssertionError: 专注人次应为 2（本轮修复前恒为 0）`（当前 `_aggregate_per_minute` 产生 `focusCount` 缺省 0）。

- [ ] **Step 3: 修实现**

`edge-vision/src/main.py` 中 `_aggregate_per_minute`（约 79-87 行）当前为：

```python
    def _aggregate_per_minute(self, tracks: list[TrackedPerson]):
        minute = int(time.time() // 60)
        bucket = self.minute_buckets[minute]
        bucket["totalDetected"] = len(tracks)
        for t in tracks:
            key = f"{t.behavior}Count"
            bucket[key] = bucket.get(key, 0) + 1
```

该循环本就会对 `behavior="focus"` 产出 `focusCount`（`configs/behaviors.yaml` 定义 `focus` 为正常行为且列入 `aggregate_behaviors`）。**若测试失败**，说明 `t.behavior` 的取值与 `focus` 不一致，按模型实际输出修正映射：

```python
    def _aggregate_per_minute(self, tracks: list[TrackedPerson]):
        minute = int(time.time() // 60)
        bucket = self.minute_buckets[minute]
        bucket["totalDetected"] = len(tracks)
        for t in tracks:
            # 行为名到聚合字段的统一映射（focus → focusCount）
            behavior = (t.behavior or "").strip() or "focus"
            key = f"{behavior}Count"
            bucket[key] = bucket.get(key, 0) + 1
```

同时确认 `main.py:133` 的 `"focusCount": b.get("focusCount", 0)` 与 `configs/behaviors.yaml` 的 `focus` 类目一致；若模型输出为 `focusing` 等别名，在 `behaviors.yaml` 的 `aggregate_behaviors` 与该映射间二选一对齐（**不要两处各写一份**）。

- [ ] **Step 4: 运行确认通过**

Run:
```bash
cd edge-vision && python scripts/test_logic.py
```
Expected: PASS，全部用例通过并打印「全部通过 ✓」。

- [ ] **Step 5: 提交**

```bash
git add edge-vision/src/main.py edge-vision/scripts/test_logic.py
git commit -m "fix(edge-vision): 补齐 focusCount 采集（原只计 totalDetected，专注率恒 0）+ 空帧用例"
```

---

## Task 7: 后端聚合快照与 config 暴露

**Files:**
- Modify: `backend/src/vision/vision.service.ts`（constructor 附近、`ingestMinuteAggregate`、`getEdgeConfig`）
- Create: `backend/src/vision/vision.service.spec.ts`

**Interfaces:**
- Consumes: `MinuteAggregateDto`（既有）。
- Produces:
  - `VisionService.getLastAggregate(lessonRecordId: number): Promise<MinuteAggregateDto | null>`
  - `VisionService.getEdgeConfig()` 返回值新增 `lastAggregates: Record<string, any> | null`（**仅新增字段**，既有字段不变）

- [ ] **Step 1: 写失败测试**

创建 `backend/src/vision/vision.service.spec.ts`：

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { VisionService } from './vision.service';
import { PrismaService } from '../prisma/prisma.service';

/** 最小 Redis 桩：只实现快照所需能力，避免测试连真实 Redis */
class RedisStub {
  store = new Map<string, string>();
  async set(k: string, v: string) {
    this.store.set(k, v);
    return 'OK';
  }
  async get(k: string) {
    return this.store.get(k) ?? null;
  }
  async quit() {
    return 'OK';
  }
  on() {
    return this;
  }
}

describe('VisionService 聚合快照', () => {
  let service: VisionService;
  let redis: RedisStub;

  const dto: any = {
    schoolId: 1, gradeId: 1, classId: 1, lessonRecordId: 42,
    minuteStart: new Date('2026-10-09T10:00:00Z').toISOString(),
    focusCount: 2, handRaiseCount: 0, writingCount: 1, talkingCount: 1,
    sleepingCount: 0, phoneCount: 0, eatingCount: 0, leavingCount: 0,
    totalDetected: 3,
  };

  beforeEach(async () => {
    redis = new RedisStub();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        { provide: PrismaService, useValue: { classMinuteAggregate: { upsert: async () => ({}) } } },
      ],
    }).compile();
    service = module.get(VisionService);
    // 注入桩，避免真实 Redis 连接
    service.setRedisForTest(redis as any);
  });

  it('上报聚合后写入 Redis 快照，可按 lessonRecordId 读回', async () => {
    await service.ingestMinuteAggregate(dto);
    const got = await service.getLastAggregate(42);
    expect(got).not.toBeNull();
    expect(got!.lessonRecordId).toBe(42);
    expect(got!.focusCount).toBe(2);
    expect(got!.totalDetected).toBe(3);
  });

  it('未上报过的课次返回 null 而不是抛错', async () => {
    const got = await service.getLastAggregate(999999);
    expect(got).toBeNull();
  });

  it('getEdgeConfig 暴露 lastAggregates 且不破坏既有字段', async () => {
    await service.ingestMinuteAggregate(dto);
    const cfg: any = await service.getEdgeConfig();
    expect(cfg.version).toBe('v1');
    expect(cfg.model.name).toBe('yolo26n');
    expect(cfg.lastAggregates).not.toBeNull();
    expect(cfg.lastAggregates.focusCount).toBe(2);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run src/vision/vision.service.spec.ts`
Expected: FAIL —— `service.setRedisForTest is not a function`（方法尚不存在）。

- [ ] **Step 3: 实现 Redis 快照**

`backend/src/vision/vision.service.ts`：

1) 头部 import 增补：

```ts
import Redis from 'ioredis';
```

2) 类内新增字段与初始化（`private readonly RETENTION_DAYS = 90;` 之后）：

```ts
  /** 用于暴露最近一次聚合快照，便于本地/线上排查（不参与业务判断） */
  private redis: Redis | null = null;
  private readonly AGG_SNAPSHOT_TTL_SEC = 7 * 24 * 60 * 60;
  private readonly AGG_SNAPSHOT_KEY = (lessonRecordId: number) => `vision:agg:last:${lessonRecordId}`;

  /** 测试注入桩用；生产走 onModuleInit 懒连接 */
  setRedisForTest(client: any) {
    this.redis = client;
  }

  private getRedis(): Redis | null {
    if (this.redis) return this.redis;
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', (e: any) => this.logger.warn(`聚合快照 Redis 不可用: ${e?.message || e}`));
    } catch (e: any) {
      this.logger.warn(`聚合快照 Redis 初始化失败: ${e?.message || e}`);
      this.redis = null;
    }
    return this.redis;
  }
```

3) `ingestMinuteAggregate` 在 `await this.prisma.classMinuteAggregate.upsert({...})` 之后、`return { ok: true };` 之前插入：

```ts
    // 写一份快照：ClassMinuteAggregate 无对外直查接口，快照用于打通「上报 → 可见」
    try {
      const redis = this.getRedis();
      if (redis) {
        await redis.set(
          this.AGG_SNAPSHOT_KEY(dto.lessonRecordId),
          JSON.stringify(dto),
          'EX',
          this.AGG_SNAPSHOT_TTL_SEC,
        );
      }
    } catch (e: any) {
      // 快照失败不影响入库主流程
      this.logger.warn(`聚合快照写入失败: ${e?.message || e}`);
    }
```

4) 新增按课次读快照的方法（放在 `listAggregates` 之后）：

```ts
  /** 读取某节课最近一次聚合快照（可观测性用，不参与业务判断） */
  async getLastAggregate(lessonRecordId: number): Promise<MinuteAggregateDto | null> {
    try {
      const redis = this.getRedis();
      if (!redis) return null;
      const raw = await redis.get(this.AGG_SNAPSHOT_KEY(lessonRecordId));
      return raw ? (JSON.parse(raw) as MinuteAggregateDto) : null;
    } catch (e: any) {
      this.logger.warn(`聚合快照读取失败: ${e?.message || e}`);
      return null;
    }
  }
```

5) `getEdgeConfig` 改为 `async` 并追加 `lastAggregates`：

```ts
  /** 边缘端拉取远程配置（阈值/白名单/模型版本），附带最近聚合快照便于排查 */
  async getEdgeConfig() {
    const lastAggregates = await this.getLastAggregate(
      parseInt(process.env.EDGE_DEBUG_LESSON_RECORD_ID || '0', 10),
    );
    return {
      version: 'v1',
      model: { name: 'yolo26n', confidence: 0.5, iou: 0.45 },
      debounce: { sameStudentSameTypeWindowSec: 300, firstAlwaysRecord: true },
      triggerBehaviors: ['sleeping', 'using_phone', 'talking', 'eating', 'leaving_seat'],
      walkingGracePeriodSec: 900,
      evidence: { clipBeforeSec: 10, clipAfterSec: 20, snapshotCount: 3, retentionDays: 90 },
      pushIntervalSec: 1,
      aggregateIntervalSec: 60,
      lastAggregates,
    };
  }
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && npx vitest run src/vision/vision.service.spec.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 回归既有测试**

Run: `cd backend && npx vitest run`
Expected: 既有用例 + 新增 3 个用例全部通过（`vision.service.spec.ts` 的 Redis 走桩，不连真实 Redis）。

- [ ] **Step 6: 提交**

```bash
git add backend/src/vision/vision.service.ts backend/src/vision/vision.service.spec.ts
git commit -m "feat(vision): 聚合上报写 Redis 快照并在 /vision/config 暴露，打通上报→可见"
```

---

## Task 8: apps/mobile Dockerfile 与 nginx.conf

**Files:**
- Create: `apps/mobile/Dockerfile`
- Create: `apps/mobile/nginx.conf`
- Read（改造依据）: `admin-web/Dockerfile`、`admin-web/nginx.conf`

**Interfaces:**
- Produces: 镜像构建产物 `dist/build/h5` 经 nginx 托管于 80 端口；`/api/` 反代 `http://backend:3000`。Task 9 的 compose 服务依赖本镜像。

- [ ] **Step 1: 创建 Dockerfile**

创建 `apps/mobile/Dockerfile`（改造自 `admin-web/Dockerfile`，仅换构建命令与产物路径）：

```dockerfile
# ===== uni-app H5 构建 =====
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install --legacy-peer-deps
COPY . .
# 构建期注入后端 API 地址（生产默认同域 /api/v1，由部署环境覆盖）
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build:h5

# ===== Nginx 托管静态资源 =====
FROM nginx:1.27-alpine
COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: 创建 nginx.conf**

创建 `apps/mobile/nginx.conf`（逐条照搬 `admin-web/nginx.conf` 的运维约定）：

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # 静态资源缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 反向代理到后端服务
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100m;
        proxy_read_timeout 120s;
    }

    # WebSocket 反向代理（/ws 教室、/wearable 穿戴设备）
    location ~ ^/(ws|wearable)/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: 静态校验 nginx 配置语法**

若本机有 nginx 可执行文件，Run: `nginx -t -c apps/mobile/nginx.conf`（相对路径按其安装目录解析，失败则跳过）。
若无 nginx，改为逐行比对：确认 `proxy_pass`、`try_files`、`client_max_body_size` 三处与 `admin-web/nginx.conf` 完全一致，仅注释与 `root` 不同。

- [ ] **Step 4: 校验 Dockerfile 与构建产物路径一致**

Run:
```bash
cd apps/mobile && npm run build:h5 && ls dist/build/h5/index.html && ls dist/build/h5/assets | head -3
```
Expected: `index.html` 与 `assets/` 存在 —— 与 Dockerfile 中 `COPY --from=builder /app/dist/build/h5` 一致。

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/Dockerfile apps/mobile/nginx.conf
git commit -m "feat(deploy): uni-app H5 容器化（Dockerfile + nginx 反代，替代 admin-web 镜像）"
```

---

## Task 9: 生产编排切换到 mobile-web

**Files:**
- Modify: `infra/docker/docker-compose.prod.yml:103-115`

**Interfaces:**
- Consumes: `apps/mobile/Dockerfile`（Task 8）。
- Produces: compose 服务名 `mobile-web`（容器 `ait-web`），供部署文档引用。

- [ ] **Step 1: 替换服务段**

`infra/docker/docker-compose.prod.yml` 中把（约 103-115 行）：

```yaml
  admin-web:
    build:
      context: ../../admin-web
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: /api/v1
    container_name: ait-admin
    restart: always
    depends_on:
      - backend
    ports:
      - "80:80"
```

替换为：

```yaml
  mobile-web:
    build:
      context: ../../apps/mobile
      dockerfile: Dockerfile
      args:
        # 生产同域反代；若前后端不同域，改为正式 HTTPS 地址
        VITE_API_BASE: /api/v1
    container_name: ait-web
    restart: always
    depends_on:
      - backend
    ports:
      - "80:80"
```

- [ ] **Step 2: 校验 compose 语法**

Run: `cd infra/docker && docker compose -f docker-compose.prod.yml config > /dev/null && echo OK`
Expected: `OK`（若因缺 `.env.prod` 变量报错，改用 `docker compose -f docker-compose.prod.yml config 2>&1 | head -20` 确认错误仅来自缺失环境变量而非 YAML 结构）。

- [ ] **Step 3: 确认无遗留旧服务名**

Run:
```bash
cd e:/AITeacher && grep -n "admin-web\|ait-admin" infra/docker/docker-compose.prod.yml
```
Expected: 无输出（已无旧服务名）。

- [ ] **Step 4: 提交**

```bash
git add infra/docker/docker-compose.prod.yml
git commit -m "feat(deploy): 生产编排前端服务 admin-web → mobile-web（uni-app H5 产物）"
```

---

## Task 10: 启动/停止脚本切到 5175

**Files:**
- Modify: `scripts/start-all.ps1:11-13`（变量）、`scripts/start-all.ps1:108-160`（前端与官网段、汇总）
- Modify: `scripts/stop-all.ps1`（端口清理段）

**Interfaces:**
- Produces: 一键启动改为「Docker 中间件 → 后端 3000 → uni-app H5 5175」，与 Tauri `devUrl`（5175）一致。

- [ ] **Step 1: 修变量**

`scripts/start-all.ps1` 约 11-13 行，把：

```powershell
$FrontendDir = Join-Path $Root "admin-web"
```

改为：

```powershell
$FrontendDir = Join-Path $Root "apps\mobile"
```

删除（或改为注释保留说明）`$WebsiteDir` 定义（约 13 行）。

- [ ] **Step 2: 修前端启动段**

把 `# ---------- 3. 前端 ----------` 到 `# ---------- 3.5 官网 ... ----------` 段结束（约 108-152 行）整体替换为：

```powershell
# ---------- 3. 前端（uni-app H5：管理后台 + 官网同一产物） ----------
Say "[4/4] 启动前端 (http://localhost:5175)..."
Set-Location $FrontendDir

$old5175 = Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if ($old5175) { $old5175 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1 }

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Say "首次运行：安装前端依赖 (npm install)..." "Yellow"
    npm install
}

New-Item -ItemType Directory -Force (Join-Path $FrontendDir "logs") | Out-Null
$fe = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev:h5" -WorkingDirectory $FrontendDir -WindowStyle Hidden `
     -RedirectStandardOutput (Join-Path $FrontendDir "logs\dev-h5.log") `
     -RedirectStandardError  (Join-Path $FrontendDir "logs\dev-h5.err.log") -PassThru
Say ("前端进程 PID=" + $fe.Id)

$feUp = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    try { $r = Invoke-WebRequest -Uri "http://localhost:5175" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $feUp = $true; break } } catch {}
}
if ($feUp) { Say "前端启动成功。" "Green" } else { Say "前端启动较慢，请稍后手动刷新 http://localhost:5175 确认" "Yellow" }
```

（uni-app H5 首次编译较慢，轮询上限由 60 提到 90 秒。）

- [ ] **Step 3: 修汇总文案**

把汇总段的：

```powershell
Say "  管理后台 : http://localhost:5173"
Say "  官网     : http://localhost:5174"
```

替换为：

```powershell
Say "  前端（管理后台 + 官网）: http://localhost:5175"
```

- [ ] **Step 4: 修 stop-all.ps1**

Run: `cd e:/AITeacher && grep -n "5173\|5174" scripts/stop-all.ps1`
把查到的 5173/5174 端口清理项替换为 5175（保持该脚本既有的清理写法与变量名不变）。

- [ ] **Step 5: 校验脚本语法**

Run:
```powershell
powershell -NoProfile -Command "$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw 'scripts\start-all.ps1'), [ref]$null); $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw 'scripts\stop-all.ps1'), [ref]$null); '语法 OK'"
```
Expected: `语法 OK`（无解析错误）。

- [ ] **Step 6: 确认无遗留端口**

Run: `cd e:/AITeacher && grep -n "5173\|5174" scripts/start-all.ps1 scripts/stop-all.ps1`
Expected: 无输出。

- [ ] **Step 7: 提交**

```bash
git add scripts/start-all.ps1 scripts/stop-all.ps1
git commit -m "chore(scripts): 一键启动改为 uni-app H5 单端口 5175（下线 admin-web 5173 / website 5174）"
```

---

## Task 11: 归档三个旧工程

**Files:**
- Move: `admin-web/` → `archive/admin-web/`
- Move: `website/` → `archive/website/`
- Move: `miniprogram/` → `archive/miniprogram/`
- Create: `archive/README.md`、`archive/admin-web/ARCHIVED.md`、`archive/website/ARCHIVED.md`、`archive/miniprogram/ARCHIVED.md`

**Interfaces:**
- Produces: 仓库根目录不再有这三个工程；`archive/` 作为历史对照基线。Task 12 的文档路径同步以此为准。

- [ ] **Step 1: 确认移动前状态**

Run:
```bash
cd e:/AITeacher
git status --short | head -20
git ls-files admin-web website miniprogram | wc -l
```
Expected: 约 138 个已跟踪文件。记录当前 `git status` 作为对照。

> ⚠️ 三个目录内含未跟踪的 `node_modules`/`dist`（约 508M）。`git mv` 会连同它们一起移动（移动非复制，磁盘占用不变，且仍被 `.gitignore` 排除）。**执行前再次确认该操作仅做移动、不删除任何文件。**

- [ ] **Step 2: 执行移动**

Run:
```bash
cd e:/AITeacher
mkdir -p archive
git mv admin-web archive/admin-web
git mv website archive/website
git mv miniprogram archive/miniprogram
```

若 `git mv` 因未跟踪文件报错，改用等效的两步（先 `git mv` 已跟踪内容的父目录不成立时）：保持目录名，用 `git mv` 对每个已跟踪子项迁移；**不得使用 `rm -rf` 或任何删除命令**。

- [ ] **Step 3: 写归档说明**

创建 `archive/README.md`：

```markdown
# 归档区（archive）

本目录存放**已下线**的历史工程，仅作迁移对照与历史参考，不参与构建与部署。

| 目录 | 原位置 | 下线日期 | 迁移去向 |
| --- | --- | --- | --- |
| `admin-web/` | 仓库根 `admin-web/` | 2026-10-09 | 管理后台 30 页 → `apps/mobile/src/pages-admin/` |
| `website/` | 仓库根 `website/` | 2026-10-09 | 官网 8 页 → `apps/mobile/src/pages-site/`（仅 H5） |
| `miniprogram/` | 仓库根 `miniprogram/` | 2026-10-09 | 小程序 15 页 → `apps/mobile/src/pages/` |

## 为什么归档而不是直接删除

这三个工程是跨平台迁移的**对照基线**（逐页功能点对照曾在验收中反复使用），保留可回溯「哪一页迁移自哪个文件」。删除后该信息仅存在于 git 历史。

## 取回方式

`git mv archive/<工程> <原位置>`，并按 `ARCHIVED.md` 恢复依赖（`npm install`）。注意：生产编排已切换为 `apps/mobile`，取回后需同步调整 `infra/docker/docker-compose.prod.yml` 与 `scripts/start-all.ps1`。

## 删除计划

确认不再需要对照（建议至少保留到 App / 小程序真机验收完成）后，可另行评估删除。**删除属破坏性操作，需显式确认。**
```

创建 `archive/admin-web/ARCHIVED.md`：

```markdown
# 已归档：admin-web（管理后台前端）

- **归档日期**：2026-10-09
- **下线原因**：管理后台 30 个视图已全量迁移至 uni-app（`apps/mobile/src/pages-admin/`），H5 与桌面端复用同一产物，本工程不再参与运行。
- **迁移去向**：`apps/mobile/src/pages-admin/`（30 页）；菜单配置见 `apps/mobile/src/config/admin-menus.ts`。
- **替代者**：`apps/mobile`（H5 产物经 `apps/mobile/Dockerfile` 的 nginx 托管，服务名 `mobile-web`）。
- **取回**：`git mv archive/admin-web admin-web` 后 `npm install && npm run dev`（原端口 5173）。
```

创建 `archive/website/ARCHIVED.md`：

```markdown
# 已归档：website（企业官网前端）

- **归档日期**：2026-10-09
- **下线原因**：官网 8 页已迁入 uni-app 的 `pages-site/`（`#ifdef H5` 条件注册），随主站同一 H5 产物发布。
- **迁移去向**：`apps/mobile/src/pages-site/`（index/features/cases/about/contact/faq/privacy/terms）+ `apps/mobile/src/components/site/`。
- **替代者**：`apps/mobile` H5 产物（H5 落地首页为 `pages-site/index`）。
- **取回**：`git mv archive/website website` 后 `npm install && npm run dev`（原端口 5174）。
```

创建 `archive/miniprogram/ARCHIVED.md`：

```markdown
# 已归档：miniprogram（原生微信小程序）

- **归档日期**：2026-10-09
- **下线原因**：15 个页面的能力已并入 uni-app，小程序端由 `apps/mobile` 经 `build:mp-weixin` 统一产出。
- **迁移去向**：`apps/mobile/src/pages/`（登录/首页/作业/请假/成绩/错题本/辅导/我的等 9 页 MVP + 其余）。
- **替代者**：`apps/mobile` 小程序产物（`npm run build:mp-weixin`，导入微信开发者工具）。
- **注意**：后端 `POST /wechat/miniprogram-login` 是**接口名**，与本目录无关，勿一并删除。
- **取回**：`git mv archive/miniprogram miniprogram` 后导入微信开发者工具。
```

- [ ] **Step 4: 校验移动结果**

Run:
```bash
cd e:/AITeacher
ls -d archive/admin-web archive/website archive/miniprogram
ls -d admin-web website miniprogram 2>&1 | head
git status --short | grep -c "^R" || echo "renames: 0"
```
Expected: 三个 `archive/*` 存在；根目录三个旧目录不存在；`git status` 显示为 rename（R）而非 delete+add。

- [ ] **Step 5: 提交**

```bash
cd e:/AITeacher
git add archive/README.md archive/admin-web/ARCHIVED.md archive/website/ARCHIVED.md archive/miniprogram/ARCHIVED.md
git commit -m "chore(repo): 归档 admin-web/website/miniprogram 至 archive/（迁移完成下线，保留对照基线）"
```

---

## Task 12: 文档同步（操作性文档）

**Files:**
- Modify: `README.md`（目录树、端口、启动步骤、常用地址、链接）
- Modify: `docs/development/README.md:46,94`
- Modify: `docs/development/vision-deploy.md:9,25`
- Modify: `docs/deploy/README.md:59`

**Interfaces:**
- Consumes: Task 9（服务名 `mobile-web`）、Task 10（端口 5175）、Task 11（归档路径）。
- Produces: 无。

**不修改（历史记录，保留原样）**：`docs/plans/2026-10-08-cross-platform-migration.md`、`docs/product/官网正式工程实施方案.md`、`docs/qa/*`、`apps/mobile/src/config/admin-menus.ts` 的出处注释、`backend/src/wechat/*`。

- [ ] **Step 1: 同步 README 目录树与端口**

`README.md` 中：
- 目录树（约 75、81 行）把 `admin-web\` 与 `website\` 两条改为指向新位置：`apps\mobile\`（uni-app，五端业务代码）与 `archive\`（已下线工程）；
- 「管理后台（admin-web，5173）」「企业官网（website，5174）」两节（约 60、64 行）改为说明均由 `apps/mobile` 提供，H5 端口 5175；
- 「快速启动」手动分步段（约 177、185 行的 `cd ..\admin-web` / `cd ..\website`）改为 `cd ..\apps\mobile` + `npm run dev:h5`；
- 「常用地址」（约 212 行起）把 5173/5174 合并为 5175；
- 文末链接「管理后台前端 README」（约 369 行 `admin-web/README.md`）改为指向 `archive/admin-web/ARCHIVED.md`。

- [ ] **Step 2: 同步开发指南**

`docs/development/README.md`：
- 46 行 `cd E:\AITeacher\admin-web` → `cd E:\AITeacher\apps\mobile`，启动命令改 `npm run dev:h5`；
- 94 行目录树 `├── admin-web\        # Vue3 管理后台前端` → `├── apps\mobile\      # uni-app 五端业务代码（H5/小程序/App/桌面复用）`，并补 `├── archive\          # 已下线工程（admin-web / website / miniprogram）`。

- [ ] **Step 3: 同步视觉部署文档**

`docs/development/vision-deploy.md`：
- 9 行表格 `| admin-web | Vue3 + Element Plus | 5173 |` → `| apps/mobile（H5） | uni-app Vue3 | 5175 |`；
- 25 行 `cd E:\AITeacher\admin-web` → `cd E:\AITeacher\apps\mobile`。

- [ ] **Step 4: 同步部署文档**

`docs/deploy/README.md` 第 59 行提到 `website/src/api/index.ts` 的接口前缀 —— 官网已迁入 uni-app，改为指向 `apps/mobile/src/config/env.ts` 的 `VITE_API_BASE` / `/api/v1` 约定，并说明生产由 `mobile-web` 容器托管。

- [ ] **Step 5: 全仓操作性引用复查**

Run:
```bash
cd e:/AITeacher
grep -rnE "(admin-web|website/|miniprogram)" README.md docs/development docs/deploy scripts infra/docker 2>/dev/null
```
Expected: 仅剩**历史性**表述（如「迁移自 admin-web」的溯源说明）或本次有意保留的归档路径引用；**不得**再有指向根目录 `admin-web/`、`website/`、`miniprogram/` 的**操作路径或端口**。

- [ ] **Step 6: 提交**

```bash
git add README.md docs/development/README.md docs/development/vision-deploy.md docs/deploy/README.md
git commit -m "docs: 同步旧工程归档后的目录/端口/启动步骤（操作性文档）"
```

---

## Task 13: scripts/build-all.ps1 一键多端构建

**Files:**
- Create: `scripts/build-all.ps1`
- Read（复用）: `scripts/build-mobile.ps1`、`scripts/build-desktop.ps1`

**Interfaces:**
- Consumes: 既有 `build-mobile.ps1`（三端）与 `build-desktop.ps1`（Tauri）。
- Produces: `-SkipDesktop` 开关；失败即停（非零退出码）。

- [ ] **Step 1: 创建编排脚本**

创建 `scripts/build-all.ps1`：

```powershell
# ============================================================
# AI Teacher 一键多端构建
# 串联：uni-app 三端（H5 / 微信小程序 / App 资源）→ Tauri 桌面安装包
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1
#       加 -SkipDesktop 只构建 uni-app 三端（跳过 Tauri，速度快）
# ============================================================
param(
    [switch]$SkipDesktop
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Say($msg, $color = "Cyan") { Write-Host $msg -ForegroundColor $color }
function Step($n, $total, $msg) { Say ("[{0}/{1}] {2}" -f $n, $total, $msg) }

$total = if ($SkipDesktop) { 2 } else { 3 }
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Say "========== AI Teacher 一键多端构建 =========="

# ---------- 1. uni-app 三端 ----------
Step 1 $total "uni-app 三端（H5 / mp-weixin / app）"
& (Join-Path $PSScriptRoot "build-mobile.ps1")
if ($LASTEXITCODE -ne 0) { Say "uni-app 三端构建失败" "Red"; exit 1 }

# ---------- 2. 校验产物 ----------
Step 2 $total "校验 uni-app 产物"
$mobileDist = Join-Path $Root "apps\mobile\dist\build"
$expect = @(
    "h5\index.html",
    "mp-weixin\app.json",
    "app\manifest.json"
)
foreach ($e in $expect) {
    $p = Join-Path $mobileDist $e
    if (-not (Test-Path $p)) { Say "缺少产物: $e" "Red"; exit 1 }
    Say ("  ok  " + $e) "Green"
}

# ---------- 3. Tauri 桌面（可选） ----------
if ($SkipDesktop) {
    Say "已跳过桌面端（-SkipDesktop）" "Yellow"
} else {
    Step 3 $total "Tauri 桌面安装包（NSIS）"
    & (Join-Path $PSScriptRoot "build-desktop.ps1")
    if ($LASTEXITCODE -ne 0) { Say "桌面端构建失败" "Red"; exit 1 }
}

$sw.Stop()
Say ""
Say "========================================" "Cyan"
Say (" 全部构建完成，用时 {0:N1} 分钟" -f $sw.Elapsed.TotalMinutes) "Green"
Say "========================================" "Cyan"
Say "  H5       : apps\mobile\dist\build\h5"
Say "  微信小程序 : apps\mobile\dist\build\mp-weixin（微信开发者工具导入）"
Say "  App 资源  : apps\mobile\dist\build\app（HBuilderX 导入或云打包）"
if (-not $SkipDesktop) {
    Say "  桌面安装包 : apps\desktop\src-tauri\target\release\bundle\nsis"
}
```

- [ ] **Step 2: 校验脚本语法**

Run:
```powershell
powershell -NoProfile -Command "$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw 'scripts\build-all.ps1'), [ref]$null); '语法 OK'"
```
Expected: `语法 OK`。

- [ ] **Step 3: 实跑三端（跳过桌面）**

Run:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1 -SkipDesktop
```
Expected: 退出码 0；打印三端产物路径并逐项 `ok`。
（已知：uni-ui 的 sass `darken()` 弃用警告会让 `build-mobile.ps1` 内部 npm 以非零退出，但产物完整。**若因此中断**，在 `build-all.ps1` 中按产物存在性判定替代 `$LASTEXITCODE` 判定 —— 即把 Step 1 的失败判定改为「`h5\index.html` 等三产物是否齐全」，并在提交信息中说明该调整原因。）

- [ ] **Step 4: 提交**

```bash
git add scripts/build-all.ps1
git commit -m "chore(scripts): 新增 build-all 一键多端构建（-SkipDesktop 可选跳过 Tauri）"
```

---

## Task 14: GitHub Actions 构建与测试

**Files:**
- Create: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `apps/mobile` 的 npm scripts、`backend` 的 `vitest run`。
- Produces: push/PR 上的构建与测试门禁（不含 Tauri）。

- [ ] **Step 1: 创建工作流**

创建 `.github/workflows/build.yml`：

```yaml
name: build

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npx vitest run

  mobile-build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile
    strategy:
      fail-fast: false
      matrix:
        target: [h5, mp-weixin, app]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: apps/mobile/package-lock.json
      - run: npm ci --legacy-peer-deps
      - name: type-check
        if: matrix.target == 'h5'
        run: npm run type-check
      - name: build
        run: |
          if [ "${{ matrix.target }}" = "app" ]; then
            npx uni build -p app
          else
            npm run build:${{ matrix.target }}
          fi
      - name: verify artifacts
        run: |
          case "${{ matrix.target }}" in
            h5)        test -f dist/build/h5/index.html ;;
            mp-weixin) test -f dist/build/mp-weixin/app.json ;;
            app)       test -f dist/build/app/manifest.json ;;
          esac
```

- [ ] **Step 2: 静态校验 YAML**

Run:
```bash
cd e:/AITeacher && python -c "import sys,io,yaml" 2>/dev/null && python -c "
import io,yaml
d=yaml.safe_load(io.open('.github/workflows/build.yml',encoding='utf-8'))
print('jobs:', list(d['jobs'].keys()))
print('on:', list(d[True].keys()) if True in d else list(d.get('on',{}).keys()))
" || echo "本机无 pyyaml，改用文本核对缩进"
```
Expected: 打印 `jobs: ['backend-test', 'mobile-build']`。
（若无 pyyaml：人工核对缩进为 2 空格、`on:` 与 `jobs:` 同级、matrix 三值齐全。）

- [ ] **Step 3: 本地等效验证 backend 步骤**

Run:
```bash
cd e:/AITeacher/backend && npx prisma generate && npx vitest run 2>&1 | tail -5
```
Expected: 测试全部通过（等效 CI 的 backend-test job）。

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/build.yml
git commit -m "ci: 新增构建工作流（后端单测 + 三端构建，不含 Tauri）"
```

---

## Task 15: 全仓复查与交付验证

**Files:**
- Create: `docs/plans/2026-10-09-engineering-enhancements-verification.md`

**Interfaces:**
- Consumes: Task 1-14 的全部产出。
- Produces: 交付验证报告（未验证项如实列出）。

- [ ] **Step 1: 无失效引用复查**

Run:
```bash
cd e:/AITeacher
echo "--- 操作性引用（应为空或无旧路径/端口）---"
grep -rnE "admin-web|website/|miniprogram" README.md docs/development docs/deploy scripts infra 2>/dev/null | grep -vE "archive/|迁移自|ARCHIVED" || echo "(无遗留)"
echo "--- 端口 5173/5174 ---"
grep -rnE "5173|5174" README.md scripts docs/development docs/deploy infra 2>/dev/null || echo "(无遗留)"
```

- [ ] **Step 2: 类型检查与三端构建**

Run:
```bash
cd e:/AITeacher/apps/mobile && npm run type-check && npm run build:h5 && npm run build:mp-weixin && npx uni build -p app
ls dist/build/h5/index.html dist/build/mp-weixin/app.json dist/build/app/manifest.json
```
Expected: 三个产物路径均存在。

- [ ] **Step 3: 后端全量测试**

Run: `cd e:/AITeacher/backend && npx vitest run`
Expected: 全部通过（含新增 `vision.service.spec.ts` 3 用例）。

- [ ] **Step 4: 边缘端测试**

Run: `cd e:/AITeacher/edge-vision && python scripts/test_logic.py`
Expected: 全部用例通过（含新增 focusCount 与空帧用例）。

- [ ] **Step 5: H5 端到端实测（图表 + 归档后启动）**

Run: `powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1`
确认：后端 3000、前端 5175 起来；以 super_admin 登录，逐页确认：
- dashboard LLM 用量图为真实定轴柱状图；
- 课堂行为分析（lesson-report）7 序列按真实人次渲染、X 轴 `HH:mm`、专注率无 `NaN%`；
- roi / health / student-report 比例条正常；
- 各页 console 0 错误。

- [ ] **Step 6: 写验证报告**

创建 `docs/plans/2026-10-09-engineering-enhancements-verification.md`，内容必须包含：

```markdown
# C 工程增强项 验证报告

## 逐项验证

| 编号 | 事项 | 命令 | 结果 |
|---|---|---|---|
| E1 | 图表（ProportionBar ×4 / ChartBar ×2） | `npm run type-check`；H5 实测 | （填实测结果） |
| E2 | 归档 + 生产切换 | `grep` 复查；`docker compose config` | （填结果） |
| E3 | focusCount | `python scripts/test_logic.py`；`vitest run vision` | （填结果） |
| E4 | CI | `build-all.ps1 -SkipDesktop`；YAML 静态校验 | （填结果） |

## Review Focus 逐条

| # | 条件 | 验证方式 | 结果 |
|---|---|---|---|
| 1 | ProportionBar 收 null/NaN → 0 宽非 NaN% | Task 1 Step 6 | |
| 2 | ChartBar 空 categories / 全 0 → 不崩 | Task 2 Step 4 | |
| 3 | 同页两 ChartBar 不串图 | Task 2 Step 4 | |
| 4 | focusRate ΣtotalDetected=0 → '—' | Task 4 Step 6 | |
| 5 | edge-vision 空 tracks → 计数 0 不抛错 | Task 6 Step 4 | |

## 未验证项（本地无法闭环，如实列出）

1. 生产 `mobile-web` 容器 nginx 反代与 WebSocket 实跑 —— 需 Docker 环境与 `.env.prod`，本次仅做 compose/YAML 静态校验。
2. uCharts 在微信小程序端 canvas 真实渲染 —— 需微信开发者工具，本次仅 H5 实测 + 小程序编译产物存在性校验。
3. Tauri 桌面对新 H5 产物的目视确认 —— 本机桌面虚拟截图组件（PIP）初始化失败（上游已记录）。
4. `.github/workflows/build.yml` 在真实 CI runner 的执行 —— 本次仅 YAML 静态校验 + 本地等效步骤验证。
5. `scripts/build-all.ps1` 的 Tauri 段实跑 —— 依赖外网 NSIS 工具链下载。

## 与 spec 的偏离记录

（如有。例如 Task 2 Step 6 触发时：uCharts 未落地已降级 DOM 实现。）
```

- [ ] **Step 7: 提交**

```bash
git add docs/plans/2026-10-09-engineering-enhancements-verification.md
git commit -m "docs: C 工程增强项验证报告（含未验证项与偏离记录）"
```

---

## 自检记录（写计划时已核对）

**Spec 覆盖**

| spec 章节 | 覆盖任务 |
|---|---|
| 4.1 图表（uCharts + ProportionBar） | Task 1、2、3、4 |
| 4.2 归档 + 生产切换 + apiBase 修复 | Task 5、8、9、10、11、12 |
| 4.3 focusCount（生产端 + 可观测 + 前端口径） | Task 6、7、4（Step 3） |
| 4.4 CI | Task 13、14 |
| 6.1 验证边界 | Task 15 Step 6 |
| 8 交付物清单 | 全部覆盖；新增文件 10 个 + 修改 18 项对应 Task 1-14 |

**类型/命名一致性**：`ProportionBar` props（`value/color/height/radius`）在 Task 1 定义，Task 1、3、4 使用一致；`ChartBar` props（`categories/series/height/unit/type`）在 Task 2 定义，Task 3、4 使用一致（均只传 `categories/series/height/unit`）。`VisionService.getLastAggregate(lessonRecordId)` 在 Task 7 定义并与 spec 4.3 的 `lastAggregates` 对应。

**已修正的 spec 偏离**：spec 4.1 写「只给 dashboard、lesson-report 上 ChartBar」，与 spec 2.3 表格一致 —— 本计划新增发现（lesson-report 原有 Y 轴刻度与柱高不对应，属误导性图表），在 Task 4 明确记录并作为替换的附加理由，属对 spec 的**理由补充**而非范围变更。

**顺序依赖**：Task 2 → 3、4（组件）；Task 8 → 9（镜像）；Task 9、10、11 → 12（文档准确性）；Task 13 → 14（脚本/CI 一致性）。其余任务互相独立，可并行。
