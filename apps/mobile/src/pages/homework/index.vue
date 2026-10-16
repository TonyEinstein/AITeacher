<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>

    <view v-for="item in list" :key="item.id" class="card" @click="goDetail(item.id)">
      <view class="title">{{ item.title }}</view>
      <view class="meta">
        <text v-if="item.submissions && item.submissions.length > 0" class="status done">已提交</text>
        <text v-else class="status pending">待完成</text>
        <text class="time">布置于 {{ item.createdAt }}</text>
      </view>
    </view>

    <view v-if="!loading && list.length === 0" class="empty">暂无作业</view>
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
    list.value = await http.get<any[]>('/assignments/student/' + studentId)
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function goDetail(id: number) {
  uni.navigateTo({ url: '/pages/homework-detail/index?id=' + id })
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

.title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}

.meta {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.status {
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.done { color: #10b981; background: #d1fae5; }
.pending { color: #f59e0b; background: #fef3c7; }

.time {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
