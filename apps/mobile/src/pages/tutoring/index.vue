<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>

    <!-- 已开通 -->
    <view v-if="!loading && subscription" class="card open-card">
      <view class="section-title">辅导订阅</view>
      <view class="meta">订阅状态：{{ subscription.status || '已开通' }}</view>
      <view class="meta" v-if="subscription.remainingMinutes != null">剩余时长：{{ subscription.remainingMinutes }} 分钟</view>
      <view class="meta" v-if="subscription.expiresAt">到期时间：{{ subscription.expiresAt }}</view>
    </view>

    <!-- 未开通 -->
    <view v-if="!loading && !subscription" class="card">
      <view class="section-title">AI 一对一辅导</view>
      <view class="desc">智能硬件 + AI 老师，为孩子提供个性化实时辅导</view>
      <button class="btn" @click="subscribe">开通辅导</button>
    </view>

    <!-- 使用统计 -->
    <view class="card" v-if="stats">
      <view class="section-title">使用统计</view>
      <view class="stat-row">
        <view class="stat-item">
          <view class="stat-num">{{ stats.totalSessions ?? 0 }}</view>
          <view class="stat-label">辅导次数</view>
        </view>
        <view class="stat-item">
          <view class="stat-num">{{ stats.totalMinutes ?? 0 }}</view>
          <view class="stat-label">累计时长(分)</view>
        </view>
        <view class="stat-item">
          <view class="stat-num">{{ stats.totalQuestions ?? 0 }}</view>
          <view class="stat-label">提问数</view>
        </view>
      </view>
      <view class="meta avg" v-if="stats.avgMinutesPerSession != null">平均每次 {{ stats.avgMinutesPerSession }} 分钟</view>
    </view>

    <!-- 辅导记录 -->
    <view class="card" v-if="history.length > 0">
      <view class="section-title">辅导记录</view>
      <view v-for="item in history" :key="item.id" class="record">
        <view class="record-title">
          <text>辅导会话 #{{ item.id }}</text>
          <text class="record-status" :class="item.status">{{ statusName(item.status) }}</text>
        </view>
        <view class="record-meta">开始：{{ fmt(item.startedAt) }}</view>
        <view class="record-meta" v-if="item.endedAt">结束：{{ fmt(item.endedAt) }} · 时长 {{ duration(item) }} 分钟</view>
        <view class="record-meta" v-else>进行中</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { http } from '@/utils/request'
import { getStudentId } from '@/utils/student'
import { useStudentAuth } from '@/composables/useStudentAuth'

const subscription = ref<any>(null)
const stats = ref<any>(null)
const history = ref<any[]>([])
const loading = ref(true)

useStudentAuth(() => {
  load()
})

async function load() {
  const studentId = getStudentId()
  if (!studentId) return
  loading.value = true
  try {
    const [sub, st, hs] = await Promise.all([
      http.get<any>('/tutoring/subscription/' + studentId).catch(() => null),
      http.get<any>('/tutoring/stats/' + studentId).catch(() => null),
      http.get<any[]>('/tutoring/history/' + studentId).catch(() => []),
    ])
    subscription.value = sub
    stats.value = st
    history.value = hs || []
  } catch (e) {
    // 单个失败不阻塞整体
  } finally {
    loading.value = false
  }
}

function statusName(s: string) {
  return ({ active: '进行中', completed: '已完成', ended: '已结束', cancelled: '已取消' } as any)[s] || s
}

function fmt(s: string) {
  return s ? s.slice(0, 16).replace('T', ' ') : ''
}

function duration(item: any) {
  if (!item.startedAt || !item.endedAt) return '—'
  const ms = new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()
  return Math.max(0, Math.round(ms / 60000))
}

function subscribe() {
  uni.showToast({ title: '开通功能开发中，请咨询老师', icon: 'none' })
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
  background: #f56fa;
  background: #f5f6fa;
}

.loading,
.empty {
  text-align: center;
  color: #9ca3af;
  padding: 48rpx 0;
  font-size: 26rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.open-card {
  border-left: 8rpx solid #10b981;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.meta {
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 8rpx;
}

.avg {
  margin-top: 16rpx;
}

.desc {
  font-size: 26rpx;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 24rpx;
}

.btn {
  background: #1e3a5f;
  color: #fff;
  border-radius: 12rpx;
}

.stat-row {
  display: flex;
  gap: 16rpx;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  background: #f9fafb;
  border-radius: 12rpx;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 700;
  color: #1e3a5f;
}

.stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.record {
  padding: 20rpx 0;
  border-top: 1rpx solid #f3f4f6;
}

.record-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 28rpx;
  color: #1f2937;
}

.record-status {
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.record-status.active { color: #3b82f6; background: #dbeafe; }
.record-status.completed,
.record-status.ended { color: #10b981; background: #d1fae5; }
.record-status.cancelled { color: #6b7280; background: #f3f4f6; }

.record-meta {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9ca3af;
}
</style>
