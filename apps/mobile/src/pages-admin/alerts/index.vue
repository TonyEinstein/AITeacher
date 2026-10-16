<template>
  <AdminLayout title="预警中心">
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
      <view class="toolbar">
        <picker :range="levelOptions" :value="levelIdx" @change="pickLevel">
          <view class="picker-box small">{{ levelOptions[levelIdx] }}</view>
        </picker>
        <picker :range="typeOptions" :value="typeIdx" @change="pickType">
          <view class="picker-box small">{{ typeOptions[typeIdx] }}</view>
        </picker>
        <button class="mini-btn" @click="runScan">立即扫描</button>
      </view>

      <SimpleTable :columns="cols" :rows="list">
        <template #cell-level="{ value }">
          <text class="tag" :class="levelClass(value)">{{ levelText(value) }}</text>
        </template>
        <template #cell-type="{ value }">
          <text class="tag info">{{ typeText(value) }}</text>
        </template>
        <template #cell-student="{ row }">{{ row.studentName }}（{{ row.className }}）</template>
        <template #cell-title="{ row }">
          <view class="title-cell">
            <text>{{ row.title }}</text>
            <text class="content-v">{{ row.content }}</text>
          </view>
        </template>
        <template #cell-status="{ value }">
          <text class="tag" :class="value === 'open' ? 'warn' : (value === 'ignored' ? 'info' : 'ok')">
            {{ statusText(value) }}
          </text>
        </template>
        <template #cell-createdAt="{ value }">{{ fmtTime(value) }}</template>
        <template #cell-op="{ row }">
          <template v-if="row.status === 'open'">
            <text class="op ok" @click="handle(row, 'handled')">处理</text>
            <text class="op" @click="handle(row, 'ignored')">忽略</text>
          </template>
          <text v-else class="muted">已完结</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无预警</view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'

const list = ref<any[]>([])
const stats = ref<any>({})
const levelOptions = ['全部级别', '提示', '警告', '严重']
const levelValues = ['', 'info', 'warning', 'critical']
const levelIdx = ref(0)
const typeOptions = ['全部类型', '出勤', '纪律', '作业', '情绪', '成绩']
const typeValues = ['', 'attendance', 'discipline', 'homework', 'emotion', 'grade']
const typeIdx = ref(0)

const statCards = computed(() => [
  { label: '预警总数', value: stats.value.total || 0, icon: '警', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '待处理', value: stats.value.open || 0, icon: '待', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '已处理', value: stats.value.handled || 0, icon: '处', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '已忽略', value: stats.value.ignored || 0, icon: '忽', color: 'linear-gradient(135deg,#7a8a96,#5f6d78)' },
])

const cols = [
  { key: 'level', title: '级别', width: '80px' },
  { key: 'type', title: '类型', width: '80px' },
  { key: 'student', title: '学生', minWidth: '130px' },
  { key: 'title', title: '预警内容', minWidth: '280px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'createdAt', title: '时间', minWidth: '130px' },
  { key: 'op', title: '操作', width: '120px' },
]

function levelText(l: string) { return ({ info: '提示', warning: '警告', critical: '严重' } as any)[l] || l }
function levelClass(l: string) { return ({ critical: 'err', warning: 'warn' } as any)[l] || 'info' }
function typeText(t: string) { return ({ attendance: '出勤', discipline: '纪律', homework: '作业', emotion: '情绪', grade: '成绩' } as any)[t] || t }
function statusText(s: string) { return ({ open: '待处理', handled: '已处理', ignored: '已忽略' } as any)[s] || s }
function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

function pickLevel(e: any) { levelIdx.value = Number(e.detail.value); load() }
function pickType(e: any) { typeIdx.value = Number(e.detail.value); load() }

async function loadStats() {
  try { stats.value = await http.get('/alerts/stats') } catch (e) { stats.value = {} }
}
async function load() {
  try {
    const params: any = { page: 1, pageSize: 50 }
    if (levelValues[levelIdx.value]) params.level = levelValues[levelIdx.value]
    if (typeValues[typeIdx.value]) params.type = typeValues[typeIdx.value]
    const res: any = await http.get('/alerts', params)
    list.value = res?.list || []
  } catch (e) { list.value = [] }
}

async function runScan() {
  try {
    await http.post('/alerts/scan')
    uni.showToast({ title: '扫描完成', icon: 'success' })
    load()
    loadStats()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '扫描失败', icon: 'none' })
  }
}

function handle(row: any, status: 'handled' | 'ignored') {
  uni.showModal({
    title: status === 'handled' ? '处理预警' : '忽略预警',
    content: '确认' + (status === 'handled' ? '处理' : '忽略') + '该预警？',
    success: async (r) => {
      if (!r.confirm) return
      await http.post('/alerts/' + row.id + '/handle', { status })
      uni.showToast({ title: '操作成功', icon: 'success' })
      load()
      loadStats()
    },
  })
}

onShow(() => {
  load()
  loadStats()
})
</script>

<style>
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 150px;
}
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 17px;
}
.stat-value { font-size: 20px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 14px; font-size: 13px; color: #4a4a4a; min-width: 96px; text-align: center; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.title-cell { display: flex; flex-direction: column; gap: 4px; }
.content-v { font-size: 12px; color: #7a8a96; line-height: 1.5; }
.op { font-size: 13px; color: #1e3a5f; margin-right: 12px; }
.op.ok { color: #0f8a5f; }
.muted { font-size: 13px; color: #aaa; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.warn { background: #fef3c7; color: #b8860b; }
.tag.info { background: #dbeafe; color: #2563a8; }
</style>
