<template>
  <AdminLayout title="售后工单">
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
        <input class="kw-input" v-model="filters.keyword" placeholder="搜索标题/描述/故障码/联系人" @confirm="loadData" />
        <picker :range="statusOptions" :value="statusIdx" @change="pickStatus">
          <view class="picker-box small">{{ statusOptions[statusIdx] }}</view>
        </picker>
        <picker :range="typeOptions" :value="typeIdx" @change="pickType">
          <view class="picker-box small">{{ typeOptions[typeIdx] }}</view>
        </picker>
        <button class="mini-btn" @click="openCreate">新建工单</button>
      </view>

      <SimpleTable :columns="cols" :rows="list">
        <template #cell-wo="{ row }"><text class="wo-no">WO-{{ String(row.id).padStart(4, '0') }}</text></template>
        <template #cell-school="{ row }">{{ row.school?.name || '-' }}</template>
        <template #cell-type="{ value }">
          <text class="tag" :class="typeClass(value)">{{ typeText(value) }}</text>
        </template>
        <template #cell-title="{ row }">
          <view class="title-cell">
            <text>{{ row.title }}</text>
            <text v-if="row.faultCode" class="tag err">{{ row.faultCode }}</text>
          </view>
        </template>
        <template #cell-priority="{ value }">
          <text class="tag" :class="priorityClass(value)">{{ priorityText(value) }}</text>
        </template>
        <template #cell-status="{ value }">
          <text class="tag" :class="statusClass(value)">{{ statusText(value) }}</text>
        </template>
        <template #cell-assignee="{ value }">{{ value || '-' }}</template>
        <template #cell-createdAt="{ value }">{{ fmtTime(value) }}</template>
        <template #cell-op="{ row }">
          <text class="op" @click="openDetail(row)">详情</text>
          <text v-if="row.status === 'pending'" class="op warn" @click="startProcess(row)">处理</text>
          <text v-if="row.status === 'processing'" class="op ok" @click="openResolve(row)">解决</text>
          <text v-if="row.status === 'resolved'" class="op" @click="handleClose(row)">关闭</text>
          <text class="op no" @click="handleDelete(row)">删除</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无工单</view>
    </view>

    <!-- 新建工单 -->
    <uni-popup ref="createPopup" type="center">
      <scroll-view scroll-y class="dialog scroll">
        <view class="dialog-title">新建售后工单</view>
        <view class="dialog-body">
          <text class="f-label">所属学校</text>
          <picker :range="schoolLabels" :value="createSchoolIdx" @change="pickCreateSchool">
            <view class="picker-box">{{ createSchoolIdx >= 0 && schoolLabels.length ? schoolLabels[createSchoolIdx] : '选择学校' }}</view>
          </picker>
          <text class="f-label">工单标题</text>
          <uni-easyinput v-model="createForm.title" placeholder="简要描述问题" />
          <text class="f-label">类型</text>
          <picker :range="typeOptions.slice(1)" :value="createTypeIdx" @change="pickCreateType">
            <view class="picker-box">{{ typeOptions[createTypeIdx + 1] }}</view>
          </picker>
          <text class="f-label">优先级</text>
          <picker :range="priorityOptions" :value="createPriorityIdx" @change="pickCreatePriority">
            <view class="picker-box">{{ priorityOptions[createPriorityIdx] }}</view>
          </picker>
          <text class="f-label">故障编码（可选）</text>
          <uni-easyinput v-model="createForm.faultCode" placeholder="如 E1001" />
          <text class="f-label">问题描述</text>
          <uni-easyinput v-model="createForm.description" type="textarea" placeholder="详细描述问题现象" />
          <text class="f-label">联系人</text>
          <uni-easyinput v-model="createForm.contactName" placeholder="联系人姓名" />
          <text class="f-label">联系电话</text>
          <uni-easyinput v-model="createForm.contactPhone" placeholder="联系电话" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="createPopup.close()">取消</button>
          <button class="d-btn ok" @click="handleCreate">创建工单</button>
        </view>
      </scroll-view>
    </uni-popup>

    <!-- 处理 / 解决 -->
    <uni-popup ref="actionPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">{{ actionMode === 'resolve' ? '标记解决' : '开始处理' }}</view>
        <view class="dialog-body">
          <text v-if="actionMode === 'process'" class="f-label">处理人</text>
          <uni-easyinput v-if="actionMode === 'process'" v-model="actionAssignee" placeholder="指定处理人" />
          <text v-if="actionMode === 'resolve'" class="f-label">解决方案</text>
          <uni-easyinput v-if="actionMode === 'resolve'" v-model="actionResolution" type="textarea" placeholder="填写处理方案/结果" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="actionPopup.close()">取消</button>
          <button class="d-btn ok" @click="submitAction">{{ actionMode === 'resolve' ? '确认解决' : '开始处理' }}</button>
        </view>
      </view>
    </uni-popup>

    <!-- 详情 -->
    <uni-popup ref="detailPopup" type="center">
      <scroll-view scroll-y class="dialog scroll">
        <view class="dialog-title">工单详情</view>
        <view class="dialog-body" v-if="detailRow">
          <view class="detail-line"><text class="d-k">工单号</text><text class="wo-no">WO-{{ String(detailRow.id).padStart(4, '0') }}</text></view>
          <view class="detail-line"><text class="d-k">学校</text><text>{{ detailRow.school?.name }}</text></view>
          <view class="detail-line"><text class="d-k">类型</text><text>{{ typeText(detailRow.type) }}</text></view>
          <view class="detail-line"><text class="d-k">优先级</text><text>{{ priorityText(detailRow.priority) }}</text></view>
          <view class="detail-line"><text class="d-k">状态</text><text>{{ statusText(detailRow.status) }}</text></view>
          <view class="detail-line"><text class="d-k">故障编码</text><text>{{ detailRow.faultCode || '-' }}</text></view>
          <view class="detail-line"><text class="d-k">联系人</text><text>{{ detailRow.contactName || '-' }} {{ detailRow.contactPhone || '' }}</text></view>
          <view class="detail-line"><text class="d-k">处理人</text><text>{{ detailRow.assignee || '-' }}</text></view>
          <view class="detail-line"><text class="d-k">创建时间</text><text>{{ fmtTime(detailRow.createdAt) }}</text></view>
          <view class="detail-block"><text class="d-k">问题描述</text><text class="block-v">{{ detailRow.description || '-' }}</text></view>
          <view class="detail-block"><text class="d-k">解决方案</text><text class="block-v">{{ detailRow.resolution || '-' }}</text></view>
        </view>
        <view class="dialog-foot">
          <button class="d-btn ok" @click="detailPopup.close()">关闭</button>
        </view>
      </scroll-view>
    </uni-popup>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'

const list = ref<any[]>([])
const schools = ref<any[]>([])
const stats = ref<any>({})
const filters = ref({ keyword: '' })

const statusOptions = ['全部状态', '待处理', '处理中', '已解决', '已关闭']
const statusValues = ['', 'pending', 'processing', 'resolved', 'closed']
const statusIdx = ref(0)
const typeOptions = ['全部类型', '设备维修', '订阅/商务', '网络', '软件', '其他']
const typeValues = ['', 'device_repair', 'subscription', 'network', 'software', 'other']
const typeIdx = ref(0)
const priorityOptions = ['低', '中', '高', '紧急']
const priorityValues = ['low', 'medium', 'high', 'urgent']

const createPopup = ref<any>(null)
const actionPopup = ref<any>(null)
const detailPopup = ref<any>(null)
const schoolLabels = ref<string[]>([])
const createSchoolIdx = ref(-1)
const createForm = ref({ title: '', faultCode: '', description: '', contactName: '', contactPhone: '' })
const createTypeIdx = ref(0)
const createPriorityIdx = ref(1)
const actionMode = ref('process')
const actionId = ref<number>(0)
const actionAssignee = ref('')
const actionResolution = ref('')
const detailRow = ref<any>(null)

const statCards = computed(() => [
  { label: '工单总数', value: stats.value.total || 0, icon: '单', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '待处理', value: stats.value.pending || 0, icon: '待', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '处理中', value: stats.value.processing || 0, icon: '中', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
  { label: '已解决', value: stats.value.resolved || 0, icon: '决', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
])

const cols = [
  { key: 'wo', title: '工单号', width: '90px' },
  { key: 'school', title: '学校', minWidth: '140px' },
  { key: 'type', title: '类型', width: '100px' },
  { key: 'title', title: '标题', minWidth: '180px' },
  { key: 'priority', title: '优先级', width: '80px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'assignee', title: '处理人', width: '90px' },
  { key: 'createdAt', title: '创建时间', minWidth: '130px' },
  { key: 'op', title: '操作', minWidth: '200px' },
]

function typeText(t: string) {
  return ({ device_repair: '设备维修', subscription: '订阅/商务', network: '网络', software: '软件', other: '其他' } as any)[t] || t
}
function typeClass(t: string) {
  return ({ device_repair: 'err', subscription: 'warn', network: 'info', software: 'info' } as any)[t] || 'info'
}
function priorityText(p: string) {
  return ({ low: '低', medium: '中', high: '高', urgent: '紧急' } as any)[p] || p
}
function priorityClass(p: string) {
  return ({ high: 'warn', urgent: 'err' } as any)[p] || 'info'
}
function statusText(s: string) {
  return ({ pending: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭' } as any)[s] || s
}
function statusClass(s: string) {
  return ({ pending: 'warn', processing: 'info', resolved: 'ok', closed: 'info' } as any)[s] || 'info'
}
function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

function pickStatus(e: any) {
  statusIdx.value = Number(e.detail.value)
  loadData()
}
function pickType(e: any) {
  typeIdx.value = Number(e.detail.value)
  loadData()
}

async function loadSchools() {
  try {
    const res: any = await http.get('/schools', { page: 1, pageSize: 100 })
    schools.value = res?.list || res || []
    schoolLabels.value = schools.value.map((s) => s.name + ' (' + s.code + ')')
  } catch (e) {
    schools.value = []
  }
}
async function loadStats() {
  try {
    stats.value = await http.get('/work-orders/stats')
  } catch (e) {
    stats.value = {}
  }
}
async function loadData() {
  try {
    const params: any = { page: 1, pageSize: 50 }
    if (filters.value.keyword) params.keyword = filters.value.keyword
    if (statusValues[statusIdx.value]) params.status = statusValues[statusIdx.value]
    if (typeValues[typeIdx.value]) params.type = typeValues[typeIdx.value]
    const res: any = await http.get('/work-orders', params)
    list.value = res?.list || []
  } catch (e) {
    list.value = []
  }
}

function openCreate() {
  createForm.value = { title: '', faultCode: '', description: '', contactName: '', contactPhone: '' }
  createSchoolIdx.value = -1
  createTypeIdx.value = 0
  createPriorityIdx.value = 1
  createPopup.value.open()
}
function pickCreateSchool(e: any) {
  createSchoolIdx.value = Number(e.detail.value)
}
function pickCreateType(e: any) {
  createTypeIdx.value = Number(e.detail.value)
}
function pickCreatePriority(e: any) {
  createPriorityIdx.value = Number(e.detail.value)
}
async function handleCreate() {
  if (createSchoolIdx.value < 0 || !createForm.value.title.trim()) {
    uni.showToast({ title: '请选学校并填标题', icon: 'none' })
    return
  }
  try {
    await http.post('/work-orders', {
      schoolId: schools.value[createSchoolIdx.value].id,
      title: createForm.value.title,
      type: typeValues[createTypeIdx.value + 1],
      priority: priorityValues[createPriorityIdx.value],
      description: createForm.value.description,
      contactName: createForm.value.contactName,
      contactPhone: createForm.value.contactPhone,
      faultCode: createForm.value.faultCode || undefined,
    })
    uni.showToast({ title: '工单已创建', icon: 'success' })
    createPopup.value.close()
    loadData()
    loadStats()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '创建失败', icon: 'none' })
  }
}

function startProcess(row: any) {
  actionMode.value = 'process'
  actionId.value = row.id
  actionAssignee.value = row.assignee || ''
  actionResolution.value = ''
  actionPopup.value.open()
}
function openResolve(row: any) {
  actionMode.value = 'resolve'
  actionId.value = row.id
  actionAssignee.value = row.assignee || ''
  actionResolution.value = ''
  actionPopup.value.open()
}
async function submitAction() {
  try {
    if (actionMode.value === 'process') {
      await http.put('/work-orders/' + actionId.value + '/status', {
        status: 'processing',
        assignee: actionAssignee.value || undefined,
      })
      uni.showToast({ title: '已开始处理', icon: 'success' })
    } else {
      await http.put('/work-orders/' + actionId.value + '/status', {
        status: 'resolved',
        resolution: actionResolution.value,
        assignee: actionAssignee.value || undefined,
      })
      uni.showToast({ title: '工单已解决', icon: 'success' })
    }
    actionPopup.value.close()
    loadData()
    loadStats()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

function handleClose(row: any) {
  uni.showModal({
    title: '关闭工单',
    content: '确认关闭该工单？',
    success: async (r) => {
      if (!r.confirm) return
      await http.put('/work-orders/' + row.id + '/status', { status: 'closed' })
      uni.showToast({ title: '工单已关闭', icon: 'success' })
      loadData()
      loadStats()
    },
  })
}
function handleDelete(row: any) {
  uni.showModal({
    title: '删除工单',
    content: '确定删除 WO-' + String(row.id).padStart(4, '0') + ' 吗？',
    confirmColor: '#c0392b',
    success: async (r) => {
      if (!r.confirm) return
      await http.delete('/work-orders/' + row.id)
      uni.showToast({ title: '删除成功', icon: 'success' })
      loadData()
      loadStats()
    },
  })
}

function openDetail(row: any) {
  detailRow.value = row
  detailPopup.value.open()
}

onShow(() => {
  loadData()
  loadStats()
  loadSchools()
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
  width: 44px; height: 44px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px;
}
.stat-value { font-size: 22px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.kw-input { flex: 1; min-width: 200px; background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 12px; font-size: 14px; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 16px; font-size: 14px; color: #4a4a4a; }
.picker-box.small { min-width: 100px; padding: 9px 12px; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.wo-no { font-family: Consolas, monospace; font-weight: 600; color: #8b2e2e; font-size: 13px; }
.title-cell { display: flex; align-items: center; gap: 6px; }
.op { font-size: 13px; color: #1e3a5f; margin-right: 12px; }
.op.warn { color: #b8860b; }
.op.ok { color: #0f8a5f; }
.op.no { color: #c0392b; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.detail-line { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f6f6f6; font-size: 13px; }
.detail-block { padding: 10px 0; border-bottom: 1px solid #f6f6f6; }
.d-k { color: #7a8a96; font-size: 13px; display: block; margin-bottom: 6px; }
.block-v { font-size: 13px; color: #3a3a3a; line-height: 1.6; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.warn { background: #fef3c7; color: #b8860b; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog { width: 560px; max-width: 94vw; background: #fff; border-radius: 14px; }
.dialog.scroll { max-height: 86vh; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
