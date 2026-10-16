<template>
  <view class="container">
    <!-- 纸白水墨符号粒子背景（与官网同源同色：朱砂淡染） -->
    <view class="ink-host" aria-hidden="true">
      <InkSymbols class="ink-symbols-host" color="139, 46, 46" />
    </view>

    <!-- 双栏布局（对齐管理后台登录页）：桌面左品牌区 + 右登录卡；窄屏退化为单栏 -->
    <view class="split">
      <!-- 左：品牌区 -->
      <view class="hero-side">
        <view class="brand">
          <view class="seal">师</view>
          <view class="brand-text">
            <view class="name">AI Teacher</view>
            <view class="slogan">智能教学引擎</view>
          </view>
        </view>
        <view class="brush-line"></view>
        <view class="hero-points">
          <text class="point">数字人自动授课 · 实时课堂互动</text>
          <text class="point">AI 作业批改 · 个性化学情辅导</text>
          <text class="point">家长实时看课 · 全维度评估报告</text>
        </view>
        <view class="pill-row">
          <text class="pill">降本增效</text>
          <text class="pill">因材施教</text>
          <text class="pill">家校透明</text>
          <text class="pill">数据驱动</text>
        </view>
      </view>

      <!-- 右：登录卡 -->
      <view class="card-side">
        <view class="card">
          <view class="card-title">欢迎登录</view>
          <view class="card-sub">AI Teacher · 请输入您的账号信息</view>

          <view class="tabs">
            <view class="tab" :class="{ on: tab === 'student' }" @click="tab = 'student'">学生登录</view>
            <view class="tab" :class="{ on: tab === 'admin' }" @click="tab = 'admin'">管理员登录</view>
            <view class="ink-indicator" :style="{ left: tab === 'student' ? '0' : '50%' }"></view>
          </view>

          <!-- 学生登录 -->
          <view v-if="tab === 'student'" class="form">
            <view class="field">
              <text class="label">学号</text>
              <uni-easyinput v-model="studentNo" placeholder="请输入学号" :maxlength="20" />
            </view>
            <view class="field">
              <text class="label">姓名</text>
              <uni-easyinput v-model="name" placeholder="请输入姓名" :maxlength="20" />
            </view>
            <button class="btn" :loading="loading" @click="studentLogin">进 入</button>
          </view>

          <!-- 管理员登录 -->
          <view v-else class="form">
            <view class="field">
              <text class="label">用户名</text>
              <uni-easyinput v-model="username" placeholder="请输入用户名" :maxlength="30" />
            </view>
            <view class="field">
              <text class="label">密码</text>
              <uni-easyinput v-model="password" type="password" placeholder="请输入密码" :maxlength="30" />
            </view>
            <button class="btn" :loading="loading" @click="adminLogin">登 录</button>
          </view>

          <!-- 微信一键登录（仅小程序端、学生tab显示） -->
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="tab === 'student'" class="wx-section">
            <view class="divider"><text>或</text></view>
            <button class="wx-btn" :loading="wxLoading" @click="wechatLogin">
              <text>微信一键登录</text>
            </button>
          </view>
          <!-- #endif -->

          <view class="demo-tip">演示账号：superadmin / 123456</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { http } from '@/utils/request'
import { setToken, setUser, isLogin, getUser } from '@/utils/auth'
import InkSymbols from '@/components/site/InkSymbols.vue'

const tab = ref('student')
const studentNo = ref('')
const name = ref('')
const username = ref('')
const password = ref('')
const loading = ref(false)
const wxLoading = ref(false)

onLoad(() => {
  // 已登录：按角色分流
  if (isLogin()) {
    const u = getUser()
    if (u && u.role && u.role !== 'student') {
      uni.reLaunch({ url: '/pages-admin/dashboard/index' })
    } else if (uni.getStorageSync('studentId')) {
      uni.switchTab({ url: '/pages/index/index' })
    }
  }
})

// 学生登录
async function studentLogin() {
  if (!studentNo.value || !name.value) {
    uni.showToast({ title: '请输入学号和姓名', icon: 'none' })
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    const res = await http.post<{ access_token: string; student: any }>('/auth/student-login', {
      studentNo: studentNo.value,
      name: name.value,
    })
    setToken(res.access_token)
    setUser(res.student)
    uni.setStorageSync('studentId', res.student.id)
    uni.setStorageSync('studentInfo', res.student)
    uni.setStorageSync('role', 'student')
    uni.switchTab({ url: '/pages/index/index' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 管理员登录
async function adminLogin() {
  if (!username.value || !password.value) {
    uni.showToast({ title: '请输入账号和密码', icon: 'none' })
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    const res = await http.post<{ access_token: string; user: any }>('/auth/login', {
      username: username.value,
      password: password.value,
    })
    setToken(res.access_token)
    setUser(res.user)
    uni.setStorageSync('role', res.user.role)
    uni.reLaunch({ url: '/pages-admin/dashboard/index' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 微信登录（小程序端）
async function wechatLogin() {
  if (wxLoading.value) return
  wxLoading.value = true
  try {
    const loginRes: any = await new Promise((resolve, reject) => {
      uni.login({ success: resolve, fail: reject })
    })
    if (!loginRes.code) throw new Error('获取微信登录凭证失败')
    const res = await http.post<{ access_token: string; parent: any; isBound: boolean }>(
      '/wechat/miniprogram-login',
      { code: loginRes.code },
    )
    setToken(res.access_token)
    setUser(res.parent || {})
    uni.setStorageSync('parent', res.parent || {})
    uni.setStorageSync('role', 'parent')
    if (res.isBound && res.parent?.studentId) {
      uni.setStorageSync('studentId', res.parent.studentId)
      uni.switchTab({ url: '/pages/index/index' })
    } else {
      uni.showModal({ title: '绑定学生', content: '您还未绑定学生，请先绑定学生信息后使用', confirmText: '知道了' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '登录失败，请重试', icon: 'none' })
  } finally {
    wxLoading.value = false
  }
}
</script>

<style>
/* 登录页纸白版：底色/粒子与官网一致（宣纸白 + 朱砂符号），
   卡片改白底细线、输入改墨线、文字改墨色；朱砂印与按钮保留 */
.container {
  position: relative;
  min-height: 100vh;
  background: #fbfaf7;
  overflow: hidden;
}
.ink-host {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.ink-host .ink-symbols-host {
  position: absolute;
  inset: 0;
}
/* reduced-motion / 兜底：CSS 静态朱砂墨晕 */
@media (prefers-reduced-motion: reduce) {
  .ink-host {
    background:
      radial-gradient(ellipse 46% 34% at 50% 40%, rgba(139, 46, 46, 0.08), transparent 70%),
      radial-gradient(ellipse 64% 50% at 52% 50%, rgba(74, 107, 90, 0.06), transparent 74%);
  }
}

/* 双栏布局：桌面左品牌右登录卡；窄屏（≤960px）退化为单栏，品牌区收起 */
.split {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8vw;
  padding: 6vh 6vw;
  box-sizing: border-box;
}
.hero-side {
  flex: 1;
  max-width: 560px;
}
.card-side {
  flex: 0 0 400px;
  max-width: 400px;
}

/* 左：品牌区 */
.brand {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 36px;
}
.seal {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: #8b2e2e;
  color: #f5f2ec;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 38px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 28px rgba(139, 46, 46, 0.35);
  flex: none;
}
.brand-text { display: flex; flex-direction: column; }
.name {
  font-family: 'Noto Serif SC', serif;
  font-size: 44px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #2b2b2b;
  line-height: 1.15;
}
.slogan {
  margin-top: 6px;
  font-size: 15px;
  letter-spacing: 6px;
  color: rgba(43, 43, 43, 0.45);
}
.brush-line {
  width: 110px;
  height: 3px;
  background: #8b2e2e;
  margin: 26px 0 34px;
  position: relative;
}
.brush-line::after {
  content: '';
  position: absolute;
  right: -7px;
  top: -2.5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b2e2e;
}
.hero-points {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.point {
  font-size: 16px;
  letter-spacing: 2px;
  color: #2b2b2b;
}
.pill-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 36px;
}
.pill {
  padding: 8px 18px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(43, 43, 43, 0.08);
  font-size: 13px;
  letter-spacing: 2px;
  color: #2b2b2b;
}
.pill::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8b2e2e;
  margin-right: 8px;
  vertical-align: 2px;
}

/* 右：登录卡（白底细线，与官网卡片同语言） */
.card {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(43, 43, 43, 0.08);
  border-top: 3px solid #8b2e2e;
  border-radius: 18px;
  padding: 40px 36px 28px;
  box-shadow: 0 24px 60px rgba(43, 43, 43, 0.1);
}
.card-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 4px;
  color: #2b2b2b;
  text-align: center;
}
.card-sub {
  margin-top: 8px;
  margin-bottom: 28px;
  font-size: 13px;
  letter-spacing: 1px;
  color: rgba(43, 43, 43, 0.5);
  text-align: center;
}

/* 墨条滑动指示 tab */
.tabs {
  position: relative;
  display: flex;
  margin-bottom: 30px;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 14px 0;
  font-size: 15px;
  letter-spacing: 2px;
  color: rgba(43, 43, 43, 0.45);
  transition: color 0.25s ease;
  position: relative;
  z-index: 1;
  cursor: pointer;
}
.tab.on { color: #2b2b2b; }
.ink-indicator {
  position: absolute;
  bottom: 0;
  width: 50%;
  height: 2px;
  background: #a84a3d;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 表单：墨线输入风 */
.field { margin-bottom: 24px; }
.label {
  display: block;
  font-size: 12px;
  letter-spacing: 3px;
  color: rgba(43, 43, 43, 0.5);
  margin-bottom: 10px;
}
/* 覆写 uni-easyinput 浅色适配（uni-app 编译下用 :deep() 穿透） */
.card :deep(.uni-easyinput__content) {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid rgba(43, 43, 43, 0.16) !important;
  border-radius: 0 !important;
}
.card :deep(.uni-easyinput__content-input) {
  color: #2b2b2b !important;
  font-size: 15px;
  padding-left: 2px !important;
  background: transparent !important;
}
.card :deep(.uni-icons) { color: rgba(43, 43, 43, 0.4) !important; }

.btn {
  margin-top: 16px;
  width: 100%;
  background: #8b2e2e;
  color: #f5f2ec;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  letter-spacing: 6px;
  font-weight: 600;
  padding: 13px 0;
  transition: background 0.2s ease;
}
.btn::after { border: none; }
.btn:active { background: #a84a3d; }

.wx-section { margin-top: 28px; }
.divider {
  text-align: center;
  color: rgba(43, 43, 43, 0.35);
  font-size: 12px;
  letter-spacing: 3px;
  margin-bottom: 20px;
}
.wx-btn {
  width: 100%;
  background: #07c160;
  color: #fff;
  border: none;
  border-radius: 12px;
}
.wx-btn::after { border: none; }

.demo-tip {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  letter-spacing: 1px;
  color: rgba(43, 43, 43, 0.4);
}

/* 窄屏：退化为单栏，品牌区收为紧凑头部 */
@media (max-width: 960px) {
  .split {
    flex-direction: column;
    justify-content: flex-start;
    gap: 0;
    padding: 7vh 26px 40px;
  }
  .hero-side {
    max-width: 480px;
    margin-bottom: 36px;
  }
  .name { font-size: 32px; }
  .slogan { font-size: 13px; letter-spacing: 4px; }
  .brush-line { margin: 18px 0 22px; }
  .point { font-size: 14px; }
  .pill-row { margin-top: 24px; }
  .card-side { flex: none; width: 100%; max-width: 480px; }
  .card { padding: 30px 24px 24px; }
}
</style>
