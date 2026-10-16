<template>
  <view class="container">
    <!-- 用户信息 -->
    <view class="card user-card">
      <view class="avatar">{{ (studentInfo?.name || '学').slice(0, 1) }}</view>
      <view class="user-info">
        <view class="user-name">{{ studentInfo?.name || (role === 'parent' ? '家长用户' : '同学') }}</view>
        <view class="user-meta" v-if="studentInfo">学号 {{ studentInfo.studentNo }} · 班级 {{ studentInfo.classId }}</view>
        <view class="user-meta" v-else>{{ role === 'parent' ? '微信登录用户' : '学生用户' }}</view>
      </view>
    </view>

    <!-- 模式切换 -->
    <view class="card">
      <view class="section-title">模式</view>
      <uni-segmented-control :current="modeIndex" :values="['学生模式', '家长模式']" @click="switchMode" />
    </view>

    <!-- AI 偏好（演示用，本地存储） -->
    <view class="card">
      <view class="section-title">AI 辅导偏好</view>
      <view class="field">
        <text class="label">偏好风格</text>
        <uni-data-checkbox v-model="aiStyle" :localdata="styles" mode="button" />
      </view>
    </view>

    <!-- 菜单 -->
    <view class="card menu">
      <view class="menu-item" @click="goWrongBook">错题本</view>
      <view class="menu-item" @click="goLeave">请假申请</view>
      <view class="menu-item" @click="goTutoring">AI 一对一辅导</view>
      <view class="menu-item" @click="goPractice">学科专项练习</view>
      <view class="menu-item" @click="about">关于系统</view>
    </view>

    <button class="logout" @click="logout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { logout as doLogout } from '@/utils/auth'
import { getStudentInfo, getRole } from '@/utils/student'

const studentInfo = ref<any>(getStudentInfo())
const role = ref(getRole())
const modeIndex = ref(role.value === 'parent' ? 1 : 0)
const aiStyle = ref(uni.getStorageSync('aiStyle') || 'step')
const styles = [
  { value: 'step', text: '分步讲解' },
  { value: 'concise', text: '简洁点拨' },
  { value: 'strict', text: '严格追问' },
]

onShow(() => {
  studentInfo.value = getStudentInfo()
  role.value = getRole()
  modeIndex.value = role.value === 'parent' ? 1 : 0
})

function switchMode(e: any) {
  const idx = e.currentIndex ?? e.index ?? e
  // 家长模式需微信绑定（移动端先提示，学生模式随时可用）
  if (idx === 1 && role.value !== 'parent') {
    uni.showToast({ title: '家长模式请使用微信登录', icon: 'none' })
    return
  }
  if (idx === 0) {
    uni.reLaunch({ url: '/pages/login/index' })
  }
}

function goWrongBook() { uni.navigateTo({ url: '/pages/wrong-book/index' }) }
function goLeave() { uni.navigateTo({ url: '/pages/leave/index' }) }
function goTutoring() { uni.navigateTo({ url: '/pages/tutoring/index' }) }
function goPractice() { uni.navigateTo({ url: '/pages/practice/index' }) }

function about() {
  uni.showModal({ title: 'AI Teacher', content: 'AI Teacher 智能教学系统 v0.1（跨平台版）', showCancel: false })
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: (r) => {
      if (r.confirm) {
        doLogout()
        uni.reLaunch({ url: '/pages/login/index' })
      }
    },
  })
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

.user-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  border-radius: 50%;
  background: #1e3a5f;
  color: #fff;
  font-size: 40rpx;
  font-weight: 700;
}

.user-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
}

.user-meta {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}

.field {
  margin-bottom: 20rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}

.menu {
  padding: 8rpx 28rpx;
}

.menu-item {
  padding: 28rpx 0;
  font-size: 28rpx;
  color: #1f2937;
  border-bottom: 1rpx solid #f3f4f6;
}

.menu-item:last-child {
  border-bottom: none;
}

.logout {
  background: #fff;
  color: #ef4444;
  border-radius: 12rpx;
  border: 1rpx solid #fecaca;
}
</style>
