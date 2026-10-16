<template>
  <AdminLayout title="课堂行为分析">
    <view class="panel filter-panel">
      <view class="filter-row">
        <text class="filter-label">课次记录 ID</text>
        <input class="id-input" type="number" v-model="lessonRecordId" />
        <button class="mini-btn" @click="loadData">查询</button>
      </view>
    </view>

    <template v-if="aggregates.length">
      <!-- 统计卡片 -->
      <view class="stat-row">
        <view v-for="c in statCards" :key="c.label" class="stat-card" :style="{ borderLeftColor: c.color }">
          <view class="stat-value" :style="{ color: c.color }">{{ c.value }}</view>
          <view class="stat-label">{{ c.label }}</view>
        </view>
      </view>

      <!-- 柱状图 -->
      <view class="panel">
        <view class="panel-title">每分钟行为分布</view>
        <ChartBar :categories="chartCategories" :series="chartSeries" :height="260" unit="人次" />
      </view>
    </template>

    <view v-else-if="!loading" class="panel empty-panel">
      <text class="empty">暂无数据，请输入课次 ID 查询</text>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ChartBar from '@/components/chart/ChartBar.vue'
import { http } from '@/utils/request'

const lessonRecordId = ref<any>(1)
const loading = ref(false)
const aggregates = ref<any[]>([])
const events = ref<any[]>([])

const colors: any = {
  focus: '#67c23a', hand_raise: '#409eff', talking: '#e6a23c',
  sleeping: '#f56c6c', phone: '#909399', eating: '#9c27b0', leaving: '#ff5722',
}

const totalViolations = computed(() => events.value.filter((e) => e.category === 'violation').length)
const totalHandRaises = computed(() => events.value.filter((e) => e.type === 'hand_raise').length)
const avgDetected = computed(() => {
  if (!aggregates.value.length) return 0
  return Math.round(aggregates.value.reduce((s, a) => s + (a.totalDetected || 0), 0) / aggregates.value.length)
})
const focusRate = computed(() => {
  const total = aggregates.value.reduce((s, a) => s + (Number(a.totalDetected) || 0), 0)
  const focus = aggregates.value.reduce((s, a) => s + (Number(a.focusCount) || 0), 0)
  // 口径：每分钟「专注听课」人次 / 每分钟检测人次（见 docs/plans/2026-10-09-engineering-enhancements-design.md 4.3）
  if (!total) return '—' // 无检测数据时不显示 NaN%
  return Math.round((focus / total) * 100) + '%'
})

const statCards = computed(() => [
  { label: '违纪事件', value: totalViolations.value, color: '#f56c6c' },
  { label: '举手次数', value: totalHandRaises.value, color: '#409eff' },
  { label: '专注率', value: focusRate.value, color: '#67c23a' },
  { label: '平均检测人数', value: avgDetected.value, color: '#e6a23c' },
])

const chartCategories = computed(() =>
  aggregates.value.slice(-20).map((a) => {
    const raw = String(a.minuteStart || '')
    const m = raw.match(/T(\d{2}:\d{2})/)
    return m ? m[1] : raw.slice(-5)
  }),
)

/** 7 条行为序列，值为真实人次，由 ChartBar 统一按最大值定轴。
 *  显式传 color：uCharts 用它画柱与内置图例，避免其默认调色板与页面语义色不一致。 */
const chartSeries = computed(() => {
  const rows = aggregates.value.slice(-20)
  const pick = (key: string) => rows.map((a) => Number(a[key]) || 0)
  return [
    { name: '专注', color: colors.focus, data: pick('focusCount') },
    { name: '举手', color: colors.hand_raise, data: pick('handRaiseCount') },
    { name: '说话', color: colors.talking, data: pick('talkingCount') },
    { name: '睡觉', color: colors.sleeping, data: pick('sleepingCount') },
    { name: '手机', color: colors.phone, data: pick('phoneCount') },
    { name: '吃东西', color: colors.eating, data: pick('eatingCount') },
    { name: '离开', color: colors.leaving, data: pick('leavingCount') },
  ]
})

async function loadData() {
  if (!lessonRecordId.value) return
  loading.value = true
  try {
    const [ag, ev]: any = await Promise.all([
      http.get('/vision/lessons/' + lessonRecordId.value + '/aggregates'),
      http.get('/vision/lessons/' + lessonRecordId.value + '/events', { limit: 100 }),
    ])
    aggregates.value = ag?.data || ag || []
    events.value = ev?.data || ev || []
  } catch (e) {
    aggregates.value = []
    events.value = []
  } finally {
    loading.value = false
  }
}

onShow(() => loadData())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); margin-bottom: 16px; }
.filter-panel { padding: 14px 16px; }
.filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-label { font-size: 14px; color: #606266; }
.id-input { width: 150px; background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.panel-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }

.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  background: #fff; border-left: 4px solid #409eff; border-radius: 8px;
  padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  flex: 1; min-width: 140px;
}
.stat-value { font-size: 26px; font-weight: 700; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

.empty-panel { text-align: center; }
.empty { color: #999; font-size: 13px; }
</style>
