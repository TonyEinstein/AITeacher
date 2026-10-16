<template>
  <AdminLayout title="设备监控">
    <!-- 统计卡片 -->
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
      <!-- 筛选 -->
      <view class="toolbar">
        <picker :range="statusOptions" :value="statusIdx" @change="pickStatus">
          <view class="picker-box small">{{ statusOptions[statusIdx] }}</view>
        </picker>
        <view class="switch-row">
          <text class="f-label" style="margin:0">仅看故障</text>
          <switch :checked="faultOnly" @change="onFaultSwitch" />
        </view>
        <button class="mini-btn ghost" @click="loadData">刷新</button>
      </view>

      <SimpleTable :columns="cols" :rows="list">
        <template #cell-school="{ row }">{{ row.school?.name || '-' }}</template>
        <template #cell-room="{ row }">{{ row.room?.name || '未分配' }}</template>
        <template #cell-serialNumber="{ value }"><text class="serial">{{ value }}</text></template>
        <template #cell-type="{ value }">{{ typeText(value) }}</template>
        <template #cell-status="{ value }">
          <text class="tag" :class="statusClass(value)">{{ statusText(value) }}</text>
        </template>
        <template #cell-fault="{ row }">
          <text v-if="row.faultCode" class="fault">{{ row.faultCode }} {{ row.faultMessage || '' }}</text>
          <text v-else class="muted">-</text>
        </template>
        <template #cell-firmwareVersion="{ value }">{{ value || '-' }}</template>
        <template #cell-op="{ row }">
          <text class="op" @click="pushUpgrade(row)">推送升级</text>
        </template>
        <template #cell-lastHeartbeat="{ row }">
          <text :class="{ stale: isStale(row.lastHeartbeat) }">{{ fmtTime(row.lastHeartbeat) }}</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无设备</view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const user = getUser()
const isSuperAdmin = user?.role === 'super_admin'
const schoolId = Number(uni.getStorageSync('active_school_id')) || user?.schoolId || 1

const list = ref<any[]>([])
const statusIdx = ref(0)
const statusVal = ref('')
const faultOnly = ref(false)

const statusOptions = ['全部状态', '在线', '离线', '故障']

const statCards = computed(() => {
  const total = list.value.length
  const online = list.value.filter((b) => b.status === 'online').length
  const offline = list.value.filter((b) => b.status === 'offline').length
  const error = list.value.filter((b) => b.status === 'error').length
  return [
    { label: '当前设备', value: total, icon: '机', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
    { label: '在线', value: online, icon: '✓', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
    { label: '离线', value: offline, icon: '铃', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
    { label: '故障', value: error, icon: '!', color: 'linear-gradient(135deg,#8b4513,#6e3710)' },
  ]
})

const cols = [
  { key: 'school', title: '学校', minWidth: '140px' },
  { key: 'room', title: '教室', width: '100px' },
  { key: 'serialNumber', title: '序列号', minWidth: '140px' },
  { key: 'type', title: '类型', width: '90px' },
  { key: 'status', title: '状态', width: '80px' },
  { key: 'fault', title: '故障信息', minWidth: '180px' },
  { key: 'firmwareVersion', title: '固件', width: '90px' },
  { key: 'op', title: '操作', width: '90px' },
  { key: 'lastHeartbeat', title: '最近心跳', minWidth: '130px' },
]

function typeText(t: string) {
  return ({ classroom: '教室盒子', camera: '摄像头', microphone: '麦克风', '4g': '4G模块' } as any)[t] || t
}
function statusText(s: string) {
  return ({ online: '在线', offline: '离线', error: '故障' } as any)[s] || s
}
function statusClass(s: string) {
  return ({ online: 'ok', offline: 'info', error: 'err' } as any)[s] || 'info'
}
function fmtTime(d: string) {
  if (!d) return '从未上报'
  const x = new Date(d)
  return String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}
function isStale(d: string) {
  if (!d) return true
  return Date.now() - new Date(d).getTime() > 10 * 60 * 1000
}

function pickStatus(e: any) {
  statusIdx.value = Number(e.detail.value)
  statusVal.value = ['', 'online', 'offline', 'error'][statusIdx.value]
  loadData()
}
function onFaultSwitch(e: any) {
  faultOnly.value = e.detail.value
  loadData()
}

async function loadData() {
  try {
    let arr: any[] = []
    if (isSuperAdmin) {
      const params: any = { page: 1, pageSize: 100 }
      if (statusVal.value) params.status = statusVal.value
      if (faultOnly.value) params.faultOnly = 'true'
      const res: any = await http.get('/boxes/all', params)
      arr = res?.list || []
    } else {
      const params: any = { schoolId }
      if (statusVal.value) params.status = statusVal.value
      const res: any = await http.get('/boxes', params)
      arr = res?.list || res || []
      if (faultOnly.value) arr = arr.filter((b) => b.status === 'error')
    }
    list.value = arr
  } catch (e) {
    list.value = []
  }
}

async function pushUpgrade(row: any) {
  try {
    const info: any = await http.get('/boxes/ota/latest', { serial: row.serialNumber })
    const d = info?.data || info || {}
    if (d.upToDate || !d.packageUrl) {
      uni.showToast({ title: '已是最新版本', icon: 'none' })
      return
    }
    uni.showModal({
      title: '推送 OTA 升级',
      content: '将升级到 V' + (d.version || '最新') + '，确认推送？',
      success: (r) => {
        if (r.confirm) uni.showToast({ title: '已推送，联网后安装', icon: 'none' })
      },
    })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '查询失败', icon: 'none' })
  }
}

onShow(() => loadData())
</script>

<style>
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06);
  flex: 1; min-width: 170px;
}
.stat-icon {
  width: 44px; height: 44px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px;
}
.stat-value { font-size: 22px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.toolbar { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 16px; font-size: 14px; color: #4a4a4a; }
.picker-box.small { min-width: 110px; padding: 9px 12px; }
.switch-row { display: flex; align-items: center; gap: 8px; }
.mini-btn { background: #f0f0f0; color: #4a4a4a; font-size: 13px; border-radius: 8px; margin: 0; }
.serial { font-family: Consolas, monospace; color: #4a4a4a; font-size: 13px; }
.op { font-size: 13px; color: #1e3a5f; }
.fault { color: #b32323; font-size: 13px; }
.muted { color: #aaa; font-size: 13px; }
.stale { color: #b8860b; font-size: 13px; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.info { background: #dbeafe; color: #2563a8; }
</style>
