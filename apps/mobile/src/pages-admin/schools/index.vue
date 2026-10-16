<template>
  <AdminLayout title="学校管理">
    <!-- 统计卡片 -->
    <view class="cards">
      <view v-for="c in statCards" :key="c.label" class="stat">
        <view class="stat-icon" :style="{ background: c.color }">{{ c.mark }}</view>
        <view class="stat-body">
          <view class="stat-val">{{ c.value }}</view>
          <view class="stat-lab">{{ c.label }}</view>
        </view>
      </view>
    </view>

    <!-- 工具栏 -->
    <view class="toolbar">
      <uni-easyinput v-model="keyword" placeholder="搜索学校名称/编码" :inputBorder="true" style="flex:1;max-width:320px" @confirm="load" />
      <picker :range="statusLabels" :value="statusIdx" @change="onStatus">
        <view class="picker-box">{{ statusIdx >= 0 ? statusLabels[statusIdx] : '全部状态' }}</view>
      </picker>
      <button class="add-btn" @click="openCreate">新增学校</button>
    </view>

    <!-- 列表 -->
    <view class="panel">
      <SimpleTable :columns="cols" :rows="filtered">
        <template #cell-name="{ row }">
          <view class="name-cell">
            <view class="s-avatar">{{ (row.name || '?').slice(0, 1) }}</view>
            <view>
              <view class="s-name">{{ row.name }}</view>
              <view class="s-code">编码：{{ row.code }}</view>
            </view>
          </view>
        </template>
        <template #cell-region="{ row }">
          {{ row.province || '-' }} {{ row.city || '' }}
        </template>
        <template #cell-status="{ value }">
          <text class="tag" :class="value">{{ statusText(value) }}</text>
        </template>
        <template #cell-subscriptionEnd="{ value }">
          {{ value ? fmtDateOnly(value) : '未设置' }}
        </template>
        <template #cell-createdAt="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-op="{ row }">
          <view class="ops">
            <text class="op" @click="enterSchool(row)">进入</text>
            <text class="op" @click="openEdit(row)">编辑</text>
            <text class="op danger" @click="remove(row)">删除</text>
          </view>
        </template>
      </SimpleTable>
      <view v-if="!filtered.length" class="empty">暂无学校</view>
    </view>

    <!-- 新增/编辑弹窗 -->
    <uni-popup ref="popup" type="center">
      <view class="dialog">
        <view class="dialog-title">{{ isEdit ? '编辑学校' : '新增学校' }}</view>
        <scroll-view scroll-y class="dialog-body">
          <view class="f-item"><text class="f-label">学校名称*</text>
            <uni-easyinput v-model="form.name" placeholder="请输入学校名称" /></view>
          <view class="f-item"><text class="f-label">学校编码*</text>
            <uni-easyinput v-model="form.code" placeholder="唯一编码，如 SCHOOL001" :disabled="isEdit" /></view>
          <view class="f-item"><text class="f-label">省份</text>
            <uni-easyinput v-model="form.province" placeholder="如：广东省" /></view>
          <view class="f-item"><text class="f-label">城市</text>
            <uni-easyinput v-model="form.city" placeholder="如：广州市" /></view>
          <view class="f-item"><text class="f-label">状态</text>
            <picker :range="statusLabelsAll" :value="formStatusIdx" @change="onFormStatus">
              <view class="picker-box">{{ statusLabelsAll[formStatusIdx] }}</view>
            </picker>
          </view>
          <view class="f-item"><text class="f-label">订阅到期</text>
            <picker mode="date" :value="form.subscriptionEnd" @change="onDate">
              <view class="picker-box">{{ form.subscriptionEnd || '选择日期' }}</view>
            </picker>
          </view>
          <view class="f-item"><text class="f-label">联系人</text>
            <uni-easyinput v-model="form.contactName" placeholder="联系人姓名" /></view>
          <view class="f-item"><text class="f-label">联系电话</text>
            <uni-easyinput v-model="form.contactPhone" placeholder="联系电话" /></view>
        </scroll-view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="close">取消</button>
          <button class="d-btn ok" :loading="submitting" @click="submit">确定</button>
        </view>
      </view>
    </uni-popup>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'

const keyword = ref('')
const statusIdx = ref(-1)
const statusLabels = ['试用中', '正式订阅', '已过期', '已停用']
const statusValues = ['trial', 'active', 'expired', 'disabled']
const statusLabelsAll = ['试用中', '正式订阅', '已过期', '已停用']

const schools = ref<any[]>([])
const popup = ref<any>(null)
const isEdit = ref(false)
const submitting = ref(false)

const form = reactive<any>({
  id: null, name: '', code: '', province: '', city: '',
  status: 'trial', subscriptionEnd: '', contactName: '', contactPhone: '',
})
const formStatusIdx = computed(() => Math.max(0, statusValues.indexOf(form.status)))

const cols = [
  { key: 'name', title: '学校名称', minWidth: '200px' },
  { key: 'region', title: '地区', minWidth: '140px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'subscriptionEnd', title: '订阅到期', width: '120px' },
  { key: 'gradeCount', title: '年级', width: '70px' },
  { key: 'createdAt', title: '创建时间', width: '150px' },
  { key: 'op', title: '操作', width: '170px' },
]

const filtered = computed(() => {
  let list = schools.value
  if (statusIdx.value >= 0) list = list.filter((s) => s.status === statusValues[statusIdx.value])
  const kw = keyword.value.trim().toLowerCase()
  if (kw) list = list.filter((s) => (s.name || '').toLowerCase().includes(kw) || (s.code || '').toLowerCase().includes(kw))
  return list
})

const statCards = computed(() => [
  { label: '合作学校', value: schools.value.length, mark: '校', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '正式订阅', value: schools.value.filter((s) => s.status === 'active').length, mark: '订', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '试用中', value: schools.value.filter((s) => s.status === 'trial').length, mark: '试', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '即将到期', value: schools.value.filter((s) => isExpiring(s.subscriptionEnd)).length, mark: '期', color: 'linear-gradient(135deg,#8b4513,#6e3710)' },
])

function isExpiring(date: string) {
  if (!date) return false
  const diff = new Date(date).getTime() - Date.now()
  return diff > 0 && diff < 30 * 86400000
}
function statusText(s: string) {
  return ({ trial: '试用中', active: '正式订阅', expired: '已过期', disabled: '已停用' } as any)[s] || s
}
function fmtDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDateOnly(d: string) {
  return d ? new Date(d).toLocaleDateString('zh-CN') : '-'
}

function onStatus(e: any) {
  statusIdx.value = Number(e.detail.value)
}
function onFormStatus(e: any) {
  form.status = statusValues[Number(e.detail.value)]
}
function onDate(e: any) {
  form.subscriptionEnd = e.detail.value
}

async function load() {
  try {
    const res = await http.get<any>('/schools', { pageSize: 200 })
    schools.value = res?.list || (Array.isArray(res) ? res : [])
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function openCreate() {
  isEdit.value = false
  Object.assign(form, { id: null, name: '', code: '', province: '', city: '', status: 'trial', subscriptionEnd: '', contactName: '', contactPhone: '' })
  popup.value.open()
}
function openEdit(row: any) {
  isEdit.value = true
  Object.assign(form, {
    id: row.id, name: row.name, code: row.code, province: row.province, city: row.city,
    status: row.status, subscriptionEnd: row.subscriptionEnd ? row.subscriptionEnd.slice(0, 10) : '',
    contactName: row.contactName, contactPhone: row.contactPhone,
  })
  popup.value.open()
}
function close() {
  popup.value.close()
}

async function submit() {
  if (!form.name || !form.code) {
    uni.showToast({ title: '请填写名称和编码', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await http.put('/schools/' + form.id, form)
      uni.showToast({ title: '编辑成功', icon: 'success' })
    } else {
      await http.post('/schools', form)
      uni.showToast({ title: '创建成功', icon: 'success' })
    }
    popup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function remove(row: any) {
  uni.showModal({
    title: '删除确认',
    content: `确定删除学校「${row.name}」吗？删除后不可恢复。`,
    confirmColor: '#c0392b',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.delete('/schools/' + row.id)
        uni.showToast({ title: '删除成功', icon: 'success' })
        load()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

function enterSchool(row: any) {
  uni.setStorageSync('active_school_id', row.id)
  uni.setStorageSync('active_school_name', row.name)
  uni.showToast({ title: `进入「${row.name}」`, icon: 'success' })
  uni.reLaunch({ url: '/pages-admin/dashboard/index' })
}

onShow(() => load())
</script>

<style>
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 18px;
}
.stat {
  flex: 1;
  min-width: 140px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.stat-icon {
  width: 46px; height: 46px; border-radius: 12px;
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 19px; font-weight: 700;
}
.stat-val { font-size: 23px; font-weight: 700; color: #2b2b2b; }
.stat-lab { font-size: 13px; color: #999; margin-top: 2px; }

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.picker-box {
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  color: #4a4a4a;
}
.add-btn {
  background: #1e3a5f;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  margin-left: auto;
}

.panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.name-cell { display: flex; align-items: center; gap: 12px; }
.s-avatar {
  width: 38px; height: 38px; border-radius: 10px;
  background: linear-gradient(135deg, #8b2e2e, #6e2222);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700;
}
.s-name { font-size: 14px; font-weight: 600; color: #2b2b2b; }
.s-code { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.ops { display: flex; gap: 12px; }
.op { font-size: 13px; color: #1e3a5f; }
.op.danger { color: #c0392b; }

.empty { text-align: center; color: #999; font-size: 13px; padding: 20px; }

.tag {
  font-size: 12px; padding: 2px 10px; border-radius: 6px;
  background: #eef0f2; color: #555;
}
.tag.active { background: #d1fae5; color: #0f8a5f; }
.tag.trial { background: #fef3c7; color: #b07d0b; }
.tag.expired { background: #eef0f2; color: #777; }
.tag.disabled { background: #fee2e2; color: #c0392b; }

.dialog {
  width: 640px;
  max-width: 92vw;
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}
.dialog-title { font-size: 17px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; max-height: 60vh; }
.f-item { margin-bottom: 16px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
