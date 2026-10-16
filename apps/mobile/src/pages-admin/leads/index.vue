<template>
  <AdminLayout title="咨询留资">
    <view class="seg">
      <view class="seg-item" :class="{ on: tab === 'leads' }" @click="switchTab('leads')">留资列表</view>
      <view class="seg-item" :class="{ on: tab === 'board' }" @click="switchTab('board')">传播看板</view>
    </view>

    <!-- 留资列表 -->
    <template v-if="tab === 'leads'">
      <view class="stat-row">
        <view v-for="c in statCards" :key="c.label" class="stat-card">
          <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
          <view class="stat-info">
            <view class="stat-value">{{ c.value }}</view>
            <view class="stat-label">{{ c.label }}</view>
          </view>
        </view>
      </view>

      <view class="panel">
        <view class="panel-head">
          <text class="panel-title">咨询留资列表</text>
          <text class="subtitle">官网「联系我们」及分享页 CTA 收集</text>
        </view>
        <SimpleTable :columns="cols" :rows="list">
          <template #cell-name="{ row }">
            <view class="name-cell">
              <view class="name-avatar">{{ (row.name || '?').charAt(0) }}</view>
              <text>{{ row.name || '未填写' }}</text>
            </view>
          </template>
          <template #cell-phone="{ value }">{{ value || '-' }}</template>
          <template #cell-company="{ value }">{{ value || '-' }}</template>
          <template #cell-message="{ value }">{{ value || '-' }}</template>
          <template #cell-source="{ row }">
            <text class="tag" :class="row.shareSnapshotId ? 'share' : 'site'">
              {{ row.shareSnapshotId ? '分享页 #' + row.shareSnapshotId : '官网表单' }}
            </text>
          </template>
          <template #cell-createdAt="{ value }">{{ fmtTime(value) }}</template>
          <template #cell-op="{ row }">
            <text class="op no" @click="handleDelete(row)">删除</text>
          </template>
        </SimpleTable>
        <view v-if="!list.length" class="empty">暂无留资记录</view>
      </view>
    </template>

    <!-- 传播看板 -->
    <template v-else>
      <!-- 时间窗口切换 -->
      <view class="panel">
        <view class="panel-head board-head">
          <view>
            <text class="panel-title">分享传播看板</text>
            <text class="subtitle">近 {{ dash.windowDays }} 天分享快照的浏览、留资与转化</text>
          </view>
          <view class="win-seg">
            <view
              v-for="d in [7, 30, 90]"
              :key="d"
              class="win-item"
              :class="{ on: dashDays === d }"
              @click="switchDays(d)"
            >{{ d }}天</view>
          </view>
        </view>

        <!-- 四个统计卡 -->
        <view class="stat-row">
          <view v-for="c in boardCards" :key="c.label" class="stat-card">
            <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
            <view class="stat-info">
              <view class="stat-value">{{ c.value }}</view>
              <view class="stat-label">{{ c.label }}</view>
            </view>
          </view>
        </view>

        <!-- 按类型分布 -->
        <view class="board-block">
          <text class="block-title">按类型分布</text>
          <view v-for="t in typeRows" :key="t.key" class="type-row">
            <text class="type-name">{{ t.name }}</text>
            <text class="type-num">{{ t.count }} 个快照</text>
            <text class="type-num">{{ t.visits }} 次浏览</text>
          </view>
          <view v-if="!typeRows.length" class="empty">暂无分享快照</view>
        </view>

        <!-- 按天浏览趋势（纯 CSS 柱状图） -->
        <view class="board-block">
          <text class="block-title">每日浏览趋势</text>
          <view v-if="trendMax > 0" class="chart">
            <view v-for="(t, i) in dash.trend" :key="t.date" class="bar-col">
              <text class="bar-val">{{ t.visits }}</text>
              <view class="bar" :style="{ height: barHeight(t.visits) + '%' }"></view>
              <text class="bar-date">{{ barLabel(t.date, i) }}</text>
            </view>
          </view>
          <view v-else class="empty">暂无浏览数据</view>
        </view>
      </view>
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

// 学校归属：遵循现有管理页取法（active_school_id 优先，其次用户信息，兜底 1）
const schoolId = Number(uni.getStorageSync('active_school_id')) || getUser()?.schoolId || 1

/** 当前 tab：leads=留资列表（默认） board=传播看板 */
const tab = ref<'leads' | 'board'>('leads')

/* ==================== 留资列表 ==================== */
const list = ref<any[]>([])

const statCards = computed(() => [
  { label: '总留资数', value: list.value.length, icon: '电', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '有手机号', value: list.value.filter((l) => l.phone).length, icon: '人', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '有机构', value: list.value.filter((l) => l.company).length, icon: '校', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '有留言', value: list.value.filter((l) => l.message).length, icon: '言', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
])

const cols = [
  { key: 'name', title: '姓名', minWidth: '130px' },
  { key: 'phone', title: '手机号', minWidth: '130px' },
  { key: 'company', title: '学校/机构', minWidth: '160px' },
  { key: 'message', title: '留言', minWidth: '200px' },
  { key: 'source', title: '来源', width: '120px' },
  { key: 'createdAt', title: '提交时间', minWidth: '140px' },
  { key: 'op', title: '操作', width: '80px' },
]

function fmtTime(d: string) {
  if (!d) return ''
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

function handleDelete(row: any) {
  uni.showModal({
    title: '删除确认',
    content: '确定删除 ' + (row.name || '该留资') + ' 的记录吗？',
    confirmColor: '#c0392b',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.delete('/leads/' + row.id)
        uni.showToast({ title: '删除成功', icon: 'success' })
        load()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

async function load() {
  try {
    const res: any = await http.get('/leads', { page: 1, pageSize: 50 })
    list.value = res?.list || []
  } catch (e) {
    list.value = []
  }
}

/* ==================== 传播看板 ==================== */
/** 看板数据契约（GET /shares/dashboard/school/:schoolId?days=n） */
interface TypeStat { count: number; visits: number }
interface DashData {
  schoolId: number
  windowDays: number
  snapshotCount: number
  totalVisits: number
  totalLeads: number
  conversionRate: number | null
  byType: Record<string, TypeStat>
  trend: { date: string; visits: number }[]
}

const dashDays = ref(30)
const dash = ref<DashData>({
  schoolId, windowDays: 30, snapshotCount: 0, totalVisits: 0, totalLeads: 0,
  conversionRate: null, byType: {}, trend: [],
})

// 类型英文 → 中文名
const TYPE_NAME: Record<string, string> = {
  student: '学生成绩',
  class: '班级',
  grade: '年级',
  school: '学校',
}

// 看板顶部四个统计卡（转化率 null 显示「暂无」）
const boardCards = computed(() => [
  { label: '分享快照数', value: dash.value.snapshotCount, icon: '享', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '总浏览量', value: dash.value.totalVisits, icon: '览', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '总留资数', value: dash.value.totalLeads, icon: '资', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '转化率', value: dash.value.conversionRate == null ? '暂无' : dash.value.conversionRate + '%', icon: '化', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
])

// 按类型分布行（按固定顺序，缺失类型不显示）
const typeRows = computed(() => {
  const bt = dash.value.byType || {}
  return (['student', 'class', 'grade', 'school'] as const)
    .filter((k) => bt[k] && (bt[k].count > 0 || bt[k].visits > 0))
    .map((k) => ({ key: k, name: TYPE_NAME[k], ...bt[k] }))
})

// 趋势最大值（用于柱高归一化）
const trendMax = computed(() =>
  dash.value.trend.reduce((m, t) => Math.max(m, t.visits), 0))

// 柱高百分比：max 归一化，最小可见高度 6%，避免 0 高度不可见
function barHeight(visits: number) {
  if (!trendMax.value) return 0
  return Math.max(Math.round((visits / trendMax.value) * 94), visits > 0 ? 6 : 2)
}

// 柱底日期标签：按天数密度隔点显示，避免拥挤
function barLabel(date: string, i: number) {
  const n = dash.value.trend.length
  if (n <= 8 || i === 0 || i === n - 1) return date.slice(5)
  if (n <= 16 && i % 4 === 0) return date.slice(5)
  if (n <= 45 && i % 8 === 0) return date.slice(5)
  if (i % 15 === 0) return date.slice(5)
  return ''
}

async function loadDash() {
  try {
    const res = await http.get<DashData>('/shares/dashboard/school/' + schoolId, { days: dashDays.value })
    dash.value = res
  } catch (e) {
    // 失败保持默认空数据，不弹重复错误（request 层已提示）
  }
}

// 切换时间窗口：7/30/90 天
function switchDays(d: number) {
  if (dashDays.value === d) return
  dashDays.value = d
  loadDash()
}

// 切换 tab：首次进入看板才拉数据，避免默认 tab 多余请求
function switchTab(t: 'leads' | 'board') {
  if (tab.value === t) return
  tab.value = t
  if (t === 'board') loadDash()
}

onShow(() => load())
</script>

<style>
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; margin-bottom: 16px; }
.seg-item { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; color: #6b7280; border-radius: 6px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }

.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 160px;
}
.stat-icon {
  width: 44px; height: 44px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px;
}
.stat-value { font-size: 22px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; }
.subtitle { display: block; font-size: 12px; color: #7a8a96; margin-top: 4px; }
.name-cell { display: flex; align-items: center; gap: 8px; }
.name-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, #8b2e2e, #6e2222); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;
}
.op { font-size: 13px; }
.op.no { color: #c0392b; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.share { background: #fef3c7; color: #b8860b; }
.tag.site { background: #e6f4ea; color: #0f8a5f; }

/* ===== 传播看板 ===== */
.board-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 12px; flex-wrap: wrap;
}
.win-seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 3px; flex-shrink: 0; }
.win-item {
  padding: 6px 14px; font-size: 12px; color: #6b7280; border-radius: 6px;
}
.win-item.on { background: #fff; color: #8b2e2e; font-weight: 600; }

.board-block { margin-top: 18px; }
.block-title {
  display: block; font-size: 14px; font-weight: 600; color: #2b2b2b;
  margin-bottom: 12px; padding-left: 8px;
  border-left: 3px solid #8b2e2e;
}

.type-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 8px; background: #f8f9fb;
  margin-bottom: 8px; font-size: 13px;
}
.type-name { flex: 1; font-weight: 600; color: #2b2b2b; }
.type-num { color: #7a8a96; }

.chart {
  display: flex; align-items: flex-end; gap: 6px;
  height: 200px; padding: 8px 4px 0; overflow-x: auto;
}
.bar-col {
  flex: 1; min-width: 22px; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
}
.bar-val { font-size: 10px; color: #7a8a96; margin-bottom: 2px; }
.bar {
  width: 60%; max-width: 26px; border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #a84545, #8b2e2e);
}
.bar-date { font-size: 10px; color: #7a8a96; margin-top: 4px; height: 14px; }
</style>
