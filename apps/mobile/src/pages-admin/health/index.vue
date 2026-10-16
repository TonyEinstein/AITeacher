<template>
  <AdminLayout title="学校健康">
    <!-- 总览 -->
    <view class="stat-row">
      <view v-for="c in topCards" :key="c.label" class="stat-card">
        <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
        <view class="stat-info">
          <view class="stat-value">{{ c.value }}</view>
          <view class="stat-label">{{ c.label }}</view>
        </view>
      </view>
    </view>

    <!-- 各校健康卡 -->
    <view class="school-grid">
      <view v-for="s in schools" :key="s.school.id" class="school-card">
        <view class="sc-head">
          <view class="sc-name">{{ s.school.name }}</view>
          <text class="tag" :class="levelClass(s.healthLevel)">{{ levelText(s.healthLevel) }}</text>
        </view>
        <view class="sc-score-row">
          <view class="sc-score" :class="s.healthLevel">{{ s.healthScore }}</view>
          <view class="sc-meta">
            <view class="meta-line">套餐：{{ planText(s.subscription?.plan) }}（{{ s.subscription?.status === 'active' ? '生效' : '停用' }}）</view>
            <view class="meta-line">联系人：{{ s.school.contactName || '-' }} {{ s.school.contactPhone || '' }}</view>
          </view>
        </view>

        <view class="sc-section">
          <view class="sec-label">设备在线率（{{ s.devices.online }}/{{ s.devices.total }}）</view>
          <ProportionBar :value="s.devices.onlineRate" :color="rateColor(s.devices.onlineRate)" :height="10" :radius="5" />
          <view class="device-detail">离线 {{ s.devices.offline }} · 故障 {{ s.devices.error }}</view>
        </view>

        <view v-if="s.faults && s.faults.length" class="sc-section">
          <view class="sec-label">故障（{{ s.faults.length }}）</view>
          <view v-for="(f, i) in s.faults" :key="i" class="fault-item">
            <text class="tag err">{{ f.faultCode }}</text>
            <text class="fault-text">{{ f.roomName }} · {{ f.faultMessage }}</text>
          </view>
        </view>

        <view class="sc-section wo">
          <text>工单：待处理 {{ s.workOrders.pending }} · 处理中 {{ s.workOrders.processing }} · 已解决 {{ s.workOrders.resolved }}</text>
        </view>
      </view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ProportionBar from '@/components/ProportionBar.vue'
import { http } from '@/utils/request'

const data = ref<any>({ summary: {}, schools: [] })

const topCards = computed(() => {
  const s = data.value.summary || {}
  return [
    { label: '学校总数', value: s.totalSchools ?? 0, icon: '校', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
    { label: '健康', value: s.healthy ?? 0, icon: '康', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
    { label: '预警', value: s.warning ?? 0, icon: '警', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
    { label: '严重', value: s.critical ?? 0, icon: '危', color: 'linear-gradient(135deg,#b32323,#8e1b1b)' },
    { label: '设备总数', value: s.totalDevices ?? 0, icon: '备', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
    { label: '故障数', value: s.totalFaults ?? 0, icon: '障', color: 'linear-gradient(135deg,#7a8a96,#5f6d78)' },
  ]
})
const schools = computed(() => data.value.schools || [])

function levelText(l: string) { return ({ healthy: '健康', warning: '预警', critical: '严重' } as any)[l] || l }
function levelClass(l: string) { return ({ healthy: 'ok', warning: 'warn', critical: 'err' } as any)[l] || 'info' }
function planText(p?: string) { if (!p) return '-'; return ({ basic: '基础版', pro: '专业版', enterprise: '企业版' } as any)[p] || '-' }
function rateColor(r: number) { if (r >= 80) return '#4a6b5a'; if (r >= 50) return '#b8860b'; return '#b32323' }

async function load() {
  try {
    data.value = await http.get('/dashboard/health')
  } catch (e) { data.value = { summary: {}, schools: [] } }
}

onShow(() => load())
</script>

<style>
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 140px;
}
.stat-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px;
}
.stat-value { font-size: 20px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.school-grid { display: flex; flex-wrap: wrap; gap: 16px; }
.school-card {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  flex: 1; min-width: 340px; max-width: calc(50% - 8px);
}
.sc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.sc-name { font-size: 15px; font-weight: 600; }
.sc-score-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.sc-score {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #fff;
}
.sc-score.healthy { background: #4a6b5a; }
.sc-score.warning { background: #b8860b; }
.sc-score.critical { background: #b32323; }
.meta-line { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.sc-section { margin-bottom: 12px; }
.sec-label { font-size: 13px; color: #4a4a4a; margin-bottom: 6px; }
.device-detail { font-size: 12px; color: #7a8a96; margin-top: 5px; }
.fault-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.fault-text { font-size: 12px; color: #6b7280; line-height: 1.5; flex: 1; }
.sc-section.wo { font-size: 12px; color: #6b7280; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.warn { background: #fef3c7; color: #b8860b; }
.tag.info { background: #dbeafe; color: #2563a8; }
</style>
