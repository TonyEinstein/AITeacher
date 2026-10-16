<template>
  <AdminLayout title="成本效益 ROI">
    <!-- 核心指标 -->
    <view class="stat-row">
      <view v-for="c in coreCards" :key="c.label" class="stat-card">
        <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
        <view class="stat-info">
          <view class="stat-value">{{ c.value }}</view>
          <view class="stat-label">{{ c.label }}</view>
        </view>
      </view>
    </view>

    <!-- 成本对比 -->
    <view class="panel">
      <view class="panel-title">成本对比（全集团）</view>
      <view v-for="b in compareBars" :key="b.label" class="cmp-row">
        <text class="cmp-label">{{ b.label }}</text>
        <ProportionBar :value="b.percent" :color="b.color" :height="22" />
        <text class="cmp-val" :style="{ color: b.color }">¥{{ fmtNum(b.value) }}</text>
      </view>
      <view class="net-line">
        净节省 = 人力成本节省 − 订阅成本 =
        <text :class="summary.totalNetSaving >= 0 ? 'pos' : 'neg'">¥{{ fmtNum(summary.totalNetSaving) }}</text>
      </view>
      <view class="note">口径：人力成本节省 = 累计 AI 课次 × 单课教师成本（¥{{ summary.teacherCostPerLesson }}/课，可在后端配置）；当前系统处于试用/推广早期，累计课次尚少（{{ summary.totalLessons }} 节），订阅成本一次性计入，故净节省为负属正常，随课次增长转正。</view>
    </view>

    <!-- 各校 ROI -->
    <view class="panel">
      <view class="panel-title">各校投入产出</view>
      <SimpleTable :columns="cols" :rows="schools">
        <template #cell-schoolName="{ value }">{{ value }}</template>
        <template #cell-status="{ value }"><text class="tag info">{{ value }}</text></template>
        <template #cell-studentCount="{ value }">{{ value }}</template>
        <template #cell-lessonCount="{ value }">{{ value }}</template>
        <template #cell-laborCostSaved="{ value }">¥{{ fmtNum(value) }}</template>
        <template #cell-subscriptionCost="{ value }">¥{{ fmtNum(value) }}</template>
        <template #cell-netSaving="{ row }">
          <text :class="row.netSaving >= 0 ? 'pos' : 'neg'">¥{{ fmtNum(row.netSaving) }}</text>
        </template>
        <template #cell-roiPercent="{ value }">{{ value == null ? '-' : value + '%' }}</template>
        <template #cell-perStudentCost="{ value }">¥{{ fmtNum(value) }}</template>
      </SimpleTable>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import ProportionBar from '@/components/ProportionBar.vue'
import { http } from '@/utils/request'

const report = ref<any>({ summary: {}, schools: [] })

const summary = computed(() => report.value.summary || {})
const schools = computed(() => report.value.schools || [])

function fmtNum(n: any) {
  if (n == null) return '0'
  return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const coreCards = computed(() => {
  const s = summary.value
  return [
    { label: '合作学校', value: s.schoolCount ?? 0, icon: '校', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
    { label: '覆盖学生', value: s.totalStudents ?? 0, icon: '生', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
    { label: '累计课次', value: s.totalLessons ?? 0, icon: '课', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
    { label: '人力成本节省', value: '¥' + fmtNum(s.totalLaborCostSaved), icon: '省', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
    { label: '订阅成本', value: '¥' + fmtNum(s.totalSubscriptionCost), icon: '投', color: 'linear-gradient(135deg,#7a8a96,#5f6d78)' },
    { label: '净节省', value: '¥' + fmtNum(s.totalNetSaving), icon: '净', color: s.totalNetSaving >= 0 ? 'linear-gradient(135deg,#4a6b5a,#3a5548)' : 'linear-gradient(135deg,#b32323,#8e1b1b)' },
    { label: '生均成本', value: '¥' + fmtNum(s.avgPerStudentCost), icon: '均', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  ]
})

const compareBars = computed(() => {
  const s = summary.value
  const max = Math.max(s.totalLaborCostSaved || 0, s.totalSubscriptionCost || 0, 1)
  return [
    { label: '人力成本节省', value: s.totalLaborCostSaved || 0, percent: Math.round(((s.totalLaborCostSaved || 0) / max) * 100), color: '#4a6b5a' },
    { label: '订阅成本', value: s.totalSubscriptionCost || 0, percent: Math.round(((s.totalSubscriptionCost || 0) / max) * 100), color: '#7a8a96' },
  ]
})

const cols = [
  { key: 'schoolName', title: '学校', minWidth: '170px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'studentCount', title: '学生', width: '70px' },
  { key: 'lessonCount', title: '课次', width: '70px' },
  { key: 'laborCostSaved', title: '人力节省', width: '110px' },
  { key: 'subscriptionCost', title: '订阅成本', width: '110px' },
  { key: 'netSaving', title: '净节省', width: '110px' },
  { key: 'roiPercent', title: 'ROI', width: '80px' },
  { key: 'perStudentCost', title: '生均成本', width: '100px' },
]

async function load() {
  try {
    report.value = await http.get('/dashboard/roi')
  } catch (e) { report.value = { summary: {}, schools: [] } }
}

onShow(() => load())
</script>

<style>
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 12px; padding: 13px 15px;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 150px;
}
.stat-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px;
}
.stat-value { font-size: 18px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); margin-bottom: 16px; }
.panel-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
.cmp-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.cmp-label { width: 110px; font-size: 13px; color: #4a4a4a; }
.cmp-val { width: 110px; font-size: 14px; font-weight: 600; text-align: right; }
.net-line { font-size: 14px; color: #3a3a3a; margin: 14px 0 10px; }
.pos { color: #0f8a5f; font-weight: 700; }
.neg { color: #c0392b; font-weight: 700; }
.note { font-size: 12px; color: #7a8a96; line-height: 1.7; background: #f6f8fa; border-radius: 8px; padding: 10px 12px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.info { background: #dbeafe; color: #2563a8; }
</style>
