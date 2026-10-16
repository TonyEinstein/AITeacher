<template>
  <view class="container">
    <view class="card">
      <view class="section-title">提交请假</view>
      <view class="field">
        <text class="label">请假类型</text>
        <uni-data-checkbox
          v-model="type"
          :localdata="types"
          mode="button"
        />
      </view>
      <view class="field">
        <text class="label">开始日期</text>
        <picker mode="date" :value="startDate" :end="endDate" @change="onStartChange">
          <view class="picker">{{ startDate || '请选择' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">结束日期</text>
        <picker mode="date" :value="endDate" :start="startDate" @change="onEndChange">
          <view class="picker">{{ endDate || '请选择（可不填）' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">请假原因</text>
        <textarea v-model="reason" class="textarea" placeholder="请填写请假原因" maxlength="200" />
      </view>
      <button class="btn" :loading="submitting" :disabled="!type || !startDate || !reason" @click="apply">
        提交申请
      </button>
    </view>

    <view class="card">
      <view class="section-title">请假记录</view>
      <view v-if="history.length === 0" class="empty">暂无请假记录</view>
      <view v-for="item in history" :key="item.id" class="record">
        <view class="record-top">
          <text class="record-type">{{ typeName(item.type) }}</text>
          <text class="record-status" :class="item.status">{{ statusName(item.status) }}</text>
        </view>
        <view class="record-meta">{{ fmtDate(item.startDate) }} {{ item.endDate ? '~ ' + fmtDate(item.endDate) : '' }}</view>
        <view class="record-meta">{{ item.reason }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { http } from '@/utils/request'
import { getStudentId } from '@/utils/student'

const types = [
  { value: 'sick', text: '病假' },
  { value: 'personal', text: '事假' },
  { value: 'other', text: '其他' },
]

const type = ref('')
const startDate = ref('')
const endDate = ref('')
const reason = ref('')
const submitting = ref(false)
const history = ref<any[]>([])

onShow(() => {
  loadHistory()
})

function onStartChange(e: any) {
  startDate.value = e.detail.value
  if (endDate.value && endDate.value < startDate.value) endDate.value = ''
}
function onEndChange(e: any) {
  endDate.value = e.detail.value
}

function typeName(t: string) {
  return (types.find((x) => x.value === t) || { text: t }).text
}
function statusName(s: string) {
  return ({ pending: '待审批', approved: '已通过', rejected: '已驳回' } as any)[s] || s
}

function fmtDate(s: string) {
  return s ? s.slice(0, 10) : ''
}

async function apply() {
  const studentId = getStudentId()
  if (!studentId) return
  submitting.value = true
  try {
    await http.post('/leaves/apply/' + studentId, {
      type: type.value,
      startDate: startDate.value,
      endDate: endDate.value || undefined,
      reason: reason.value,
    }, { showError: true })
    uni.showToast({ title: '提交成功，等待老师审批', icon: 'success' })
    type.value = ''
    startDate.value = ''
    endDate.value = ''
    reason.value = ''
    loadHistory()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function loadHistory() {
  const studentId = getStudentId()
  if (!studentId) return
  try {
    history.value = await http.get<any[]>('/leaves/student/' + studentId)
  } catch (e) {
    history.value = []
  }
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
  background: #f5f6fa;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}

.field {
  margin-bottom: 28rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}

.picker {
  padding: 20rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1f2937;
}

.textarea {
  width: 100%;
  height: 160rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.btn {
  background: #1e3a5f;
  color: #fff;
  border-radius: 12rpx;
}

.empty {
  text-align: center;
  color: #9ca3af;
  font-size: 26rpx;
  padding: 24rpx 0;
}

.record {
  padding: 20rpx 0;
  border-top: 1rpx solid #f3f4f6;
}

.record-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-type {
  font-size: 28rpx;
  color: #1f2937;
}

.record-status {
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.record-status.pending { color: #f59e0b; background: #fef3c7; }
.record-status.approved { color: #10b981; background: #d1fae5; }
.record-status.rejected { color: #ef4444; background: #fee2e2; }

.record-meta {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #9ca3af;
}
</style>
