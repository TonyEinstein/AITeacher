<template>
  <view class="container">
    <!-- 顶部欢迎 -->
    <view class="header">
      <view class="greeting">你好，{{ studentInfo?.name || (role === 'parent' ? '家长' : '同学') }}</view>
      <view class="sub">今天也要加油学习</view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-grid">
      <view class="quick-item" @click="goHomework">
        <view class="quick-icon hw">作</view>
        <text>作业</text>
      </view>
      <view class="quick-item" @click="goScores">
        <view class="quick-icon score">绩</view>
        <text>成绩</text>
      </view>
      <view class="quick-item" @click="goWrongBook">
        <view class="quick-icon wrong">错</view>
        <text>错题本</text>
      </view>
      <view class="quick-item" @click="goLeave">
        <view class="quick-icon leave">假</view>
        <text>请假</text>
      </view>
    </view>

    <!-- 待交作业 -->
    <view class="card">
      <view class="card-title">
        <text>待交作业</text>
        <text class="more" @click="goHomework">全部 ›</text>
      </view>
      <view v-if="pendingHomework.length === 0" class="empty">暂无待交作业</view>
      <view v-for="item in pendingHomework" :key="item.id" class="hw-item" @click="goDetail(item.id)">
        <view class="hw-title">{{ item.title }}</view>
        <view class="hw-meta">截止：{{ item.dueDate || '未设置' }}</view>
      </view>
    </view>

    <!-- AI 辅导入口 -->
    <view class="card entry" @click="goTutoring">
      <view class="card-title"><text>AI 一对一辅导</text><text class="vip-tag">会员</text></view>
      <view class="desc">智能眼镜+手表，AI 老师随身辅导</view>
    </view>

    <!-- 学科专项练习入口 -->
    <view class="card entry practice" @click="goPractice">
      <view class="card-title"><text>学科专项练习</text></view>
      <view class="desc">朗读打卡 · 默写 · 口语跟读 · 单词听写</view>
    </view>

    <!-- 家长入口 -->
    <view class="card entry" @click="goParent">
      <view class="card-title"><text>家长模式</text></view>
      <view class="desc">实时看课、孩子表现、留言转达</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { http } from '@/utils/request'
import { getStudentId, getStudentInfo, getRole } from '@/utils/student'
import { useStudentAuth } from '@/composables/useStudentAuth'

const studentInfo = ref<any>(getStudentInfo())
const role = ref(getRole())
const pendingHomework = ref<any[]>([])

useStudentAuth(() => {
  studentInfo.value = getStudentInfo()
  role.value = getRole()
  loadData()
})

async function loadData() {
  const studentId = getStudentId()
  if (!studentId) return
  try {
    const list = await http.get<any[]>('/assignments/student/' + studentId)
    const pending = (list || []).filter((a: any) => !a.submissions || a.submissions.length === 0)
    pendingHomework.value = pending.slice(0, 3)
  } catch (e) {
    // 首页待办加载失败不阻塞页面
  }
}

function goHomework() { uni.switchTab({ url: '/pages/homework/index' }) }
function goScores() { uni.switchTab({ url: '/pages/scores/index' }) }
function goWrongBook() { uni.navigateTo({ url: '/pages/wrong-book/index' }) }
function goLeave() { uni.navigateTo({ url: '/pages/leave/index' }) }
function goTutoring() { uni.navigateTo({ url: '/pages/tutoring/index' }) }
function goPractice() { uni.navigateTo({ url: '/pages/practice/index' }) }
function goParent() { uni.navigateTo({ url: '/pages/profile/index' }) }
function goDetail(id: number) { uni.navigateTo({ url: '/pages/homework-detail/index?id=' + id }) }
</script>

<style>
.container {
  padding: 32rpx 24rpx 48rpx;
  min-height: 100vh;
  background: #f5f6fa;
}

.header {
  padding: 16rpx 8rpx 32rpx;
}

.greeting {
  font-size: 40rpx;
  font-weight: 700;
  color: #1e3a5f;
}

.sub {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #9ca3af;
}

.quick-grid {
  display: flex;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.quick-item {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #374151;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.quick-icon {
  width: 72rpx;
  height: 72rpx;
  line-height: 72rpx;
  margin: 0 auto 12rpx;
  border-radius: 20rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
}

.hw { background: #3b82f6; }
.score { background: #10b981; }
.wrong { background: #f59e0b; }
.leave { background: #ef4444; }

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.more {
  font-size: 24rpx;
  color: #9ca3af;
  font-weight: 400;
}

.empty {
  color: #9ca3af;
  font-size: 26rpx;
  padding: 24rpx 0;
  text-align: center;
}

.hw-item {
  padding: 20rpx 0;
  border-top: 1rpx solid #f3f4f6;
}

.hw-title {
  font-size: 28rpx;
  color: #1f2937;
}

.hw-meta {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.entry {
  border-left: 8rpx solid #6366f1;
}

.entry.practice {
  border-left-color: #f59e0b;
}

.desc {
  font-size: 24rpx;
  color: #9ca3af;
}

.vip-tag {
  font-size: 22rpx;
  color: #fff;
  background: #f59e0b;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}
</style>
