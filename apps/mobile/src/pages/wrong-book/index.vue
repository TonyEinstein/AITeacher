<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>

    <view v-for="item in list" :key="item.id" class="card">
      <view class="q-title">{{ item.question || item.title || '错题' }}</view>
      <view v-if="item.subject" class="meta">科目：{{ item.subject.name }}</view>
      <view v-if="item.myAnswer" class="row">我的答案：<text class="wrong-text">{{ item.myAnswer }}</text></view>
      <view v-if="item.correctAnswer" class="row">正确答案：<text class="correct-text">{{ item.correctAnswer }}</text></view>
      <view v-if="item.analysis" class="analysis">解析：{{ item.analysis }}</view>
    </view>

    <view v-if="!loading && list.length === 0" class="empty">暂无错题，继续保持</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { http } from '@/utils/request'
import { getStudentId } from '@/utils/student'
import { useStudentAuth } from '@/composables/useStudentAuth'

const list = ref<any[]>([])
const loading = ref(true)

useStudentAuth(() => {
  load()
})

async function load() {
  const studentId = getStudentId()
  if (!studentId) return
  loading.value = true
  try {
    list.value = await http.get<any[]>('/wrong-questions/student/' + studentId)
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
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

.q-title {
  font-size: 28rpx;
  color: #1f2937;
  line-height: 1.6;
  margin-bottom: 12rpx;
}

.meta {
  font-size: 24rpx;
  color: #9ca3af;
  margin-bottom: 8rpx;
}

.row {
  font-size: 26rpx;
  color: #374151;
  margin-top: 8rpx;
}

.wrong-text { color: #ef4444; }
.correct-text { color: #10b981; }

.analysis {
  margin-top: 12rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}
</style>
