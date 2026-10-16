<template>
  <AdminLayout title="订阅管理">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">学校订阅列表</text>
      </view>
      <SimpleTable :columns="cols" :rows="list">
        <template #cell-school="{ row }">{{ row.school?.name }}（{{ row.school?.code }}）</template>
        <template #cell-plan="{ value }">
          <text class="tag" :class="planClass(value)">{{ planText(value) }}</text>
        </template>
        <template #cell-status="{ value }">
          <text class="tag" :class="value === 'active' ? 'ok' : 'info'">{{ statusText(value) }}</text>
        </template>
        <template #cell-startDate="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-endDate="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-amount="{ value }">¥{{ value }}</template>
        <template #cell-op="{ row }">
          <text class="op" @click="openRenew(row)">续费</text>
          <text v-if="row.status === 'active'" class="op no" @click="toggle(row, 'disable')">停用</text>
          <text v-else class="op ok" @click="toggle(row, 'enable')">启用</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无订阅</view>
    </view>

    <!-- 续费 -->
    <uni-popup ref="renewPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">续费 / 变更套餐</view>
        <view class="dialog-body">
          <text class="f-label">学校</text>
          <text class="ro-v">{{ cur?.school?.name }}</text>
          <text class="f-label">套餐</text>
          <picker :range="planOptions" :value="planIdx" @change="pickPlan">
            <view class="picker-box">{{ planOptions[planIdx] }}</view>
          </picker>
          <text class="f-label">续费时长</text>
          <picker :range="monthOptions" :value="monthIdx" @change="pickMonth">
            <view class="picker-box">{{ monthOptions[monthIdx] }}</view>
          </picker>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="renewPopup.close()">取消</button>
          <button class="d-btn ok" @click="doRenew">确认续费</button>
        </view>
      </view>
    </uni-popup>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'

const list = ref<any[]>([])
const renewPopup = ref<any>(null)
const cur = ref<any>(null)
const planOptions = ['基础版', '专业版', '企业版']
const planValues = ['basic', 'pro', 'enterprise']
const planIdx = ref(1)
const monthOptions = ['1 个月', '3 个月', '6 个月', '1 年', '2 年', '3 年']
const monthValues = [1, 3, 6, 12, 24, 36]
const monthIdx = ref(3)

const cols = [
  { key: 'school', title: '学校', minWidth: '200px' },
  { key: 'plan', title: '套餐', width: '100px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'startDate', title: '开始日期', minWidth: '120px' },
  { key: 'endDate', title: '到期日期', minWidth: '120px' },
  { key: 'amount', title: '金额', width: '100px' },
  { key: 'op', title: '操作', width: '140px' },
]

function planText(p: string) { return ({ basic: '基础版', pro: '专业版', enterprise: '企业版', trial: '试用' } as any)[p] || p }
function planClass(p: string) { return ({ pro: 'warn', enterprise: 'err' } as any)[p] || 'info' }
function statusText(s: string) { return ({ active: '生效中', inactive: '已停用', expired: '已到期' } as any)[s] || s }
function fmtDate(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')
}

async function load() {
  try {
    const res: any = await http.get('/subscriptions', { page: 1, pageSize: 50 })
    list.value = res?.list || []
  } catch (e) { list.value = [] }
}

function openRenew(row: any) {
  cur.value = row
  const pi = planValues.indexOf(row.plan)
  planIdx.value = pi >= 0 ? pi : 1
  monthIdx.value = 3
  renewPopup.value.open()
}
function pickPlan(e: any) { planIdx.value = Number(e.detail.value) }
function pickMonth(e: any) { monthIdx.value = Number(e.detail.value) }

async function doRenew() {
  try {
    await http.post('/subscriptions/school/' + cur.value.schoolId + '/renew', {
      plan: planValues[planIdx.value],
      durationMonths: monthValues[monthIdx.value],
    })
    uni.showToast({ title: '续费成功', icon: 'success' })
    renewPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '续费失败', icon: 'none' })
  }
}

function toggle(row: any, action: 'enable' | 'disable') {
  uni.showModal({
    title: action === 'enable' ? '启用订阅' : '停用订阅',
    content: '确认' + (action === 'enable' ? '启用' : '停用') + ' ' + row.school?.name + ' 的订阅？',
    success: async (r) => {
      if (!r.confirm) return
      await http.put('/subscriptions/school/' + row.schoolId + '/' + action)
      uni.showToast({ title: '操作成功', icon: 'success' })
      load()
    },
  })
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; }
.ro-v { font-size: 14px; color: #3a3a3a; }
.op { font-size: 13px; color: #1e3a5f; margin-right: 12px; }
.op.ok { color: #0f8a5f; }
.op.no { color: #c0392b; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.warn { background: #fef3c7; color: #b8860b; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog { width: 480px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 14px; font-size: 14px; color: #4a4a4a; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
