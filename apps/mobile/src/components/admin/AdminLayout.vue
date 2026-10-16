<template>
  <view class="al" :class="{ wide: isWide }">
    <!-- 宽屏侧边栏 -->
    <view v-if="isWide" class="sidebar">
      <view class="brand">
        <view class="seal">师</view>
        <text class="brand-text">AI Teacher</text>
      </view>
      <scroll-view scroll-y class="menu-scroll">
        <view
          v-for="m in menus"
          :key="m.url"
          class="menu-item"
          :class="{ active: currentUrl === m.url }"
          @click="go(m.url)"
        >
          {{ m.title }}
        </view>
      </scroll-view>
      <view class="version">v1.0.0</view>
    </view>

    <!-- 窄屏抽屉 -->
    <uni-popup ref="popup" type="left" :is-mask-click="true">
      <view class="drawer">
        <view class="brand">
          <view class="seal">师</view>
          <text class="brand-text">AI Teacher</text>
        </view>
        <scroll-view scroll-y class="menu-scroll drawer-menu">
          <view
            v-for="m in menus"
            :key="m.url"
            class="menu-item"
            :class="{ active: currentUrl === m.url }"
            @click="go(m.url, true)"
          >
            {{ m.title }}
          </view>
        </scroll-view>
      </view>
    </uni-popup>

    <!-- 主区域 -->
    <view class="main">
      <view class="topbar">
        <view class="top-left">
          <text v-if="!isWide" class="hamburger" @click="openDrawer">≡</text>
          <text class="top-title">{{ title }}</text>
        </view>
        <view class="top-right">
          <view class="user">
            <view class="u-avatar">{{ (user?.name || 'A').slice(0, 1) }}</view>
            <text class="u-name">{{ user?.name || user?.username || '管理员' }}</text>
          </view>
          <text class="logout-btn" @click="onLogout">退出</text>
        </view>
      </view>
      <scroll-view scroll-y class="content">
        <slot />
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getAdminMenus, ROLE_TEXT } from '@/config/admin-menus'
import { logout as doLogout, getUser } from '@/utils/auth'
import { ADMIN_PAGE_REFRESH } from '@/utils/admin-events'

const props = defineProps<{ title: string }>()

const sys = uni.getSystemInfoSync()
const isWide = ref((sys.windowWidth || 0) >= 768)
const popup = ref<any>(null)

const user = ref<any>(getUser())
const role = ref(user.value?.role || '')
const menus = ref(getAdminMenus(role.value))

// 当前页面 url（用于高亮）
function getCurrentUrl(): string {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1] as any
  return cur ? '/' + cur.route : ''
}
const currentUrl = ref(getCurrentUrl())

function openDrawer() {
  popup.value && popup.value.open()
}

function go(url: string, fromDrawer = false) {
  if (fromDrawer) popup.value && popup.value.close()
  if (url === currentUrl.value) {
    // hash 路由下同 URL 跳转不会重建页面、不触发 onShow——广播刷新事件，
    // 让页面（onRefresh）重新拉数据，等价于「刷新当前页」
    uni.$emit(ADMIN_PAGE_REFRESH)
    return
  }
  uni.reLaunch({ url })
}

function onLogout() {
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
.al {
  display: flex;
  min-height: 100vh;
  background: #eef1f4;
}

/* 侧边栏 */
.sidebar {
  width: 230px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #f8f9fb, #eef1f4);
  border-right: 1px solid rgba(43, 43, 43, 0.08);
  display: flex;
  flex-direction: column;
}

.brand {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(43, 43, 43, 0.08);
}

.seal {
  width: 36px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b2e2e, #6e2222);
  color: #fff;
  font-weight: 900;
}

.brand-text {
  font-size: 17px;
  font-weight: 700;
  color: #2b2b2b;
  letter-spacing: 2px;
}

.menu-scroll {
  flex: 1;
  padding: 12px 8px;
}

.menu-item {
  padding: 11px 16px;
  border-radius: 10px;
  margin-bottom: 4px;
  color: #4a4a4a;
  font-size: 14px;
}

.menu-item.active {
  background: linear-gradient(135deg, rgba(139, 46, 46, 0.12), rgba(139, 46, 46, 0.05));
  color: #8b2e2e;
  font-weight: 600;
}

.version {
  padding: 14px;
  text-align: center;
  font-size: 11px;
  color: #7a8a96;
  border-top: 1px solid rgba(43, 43, 43, 0.08);
}

.drawer {
  width: 260px;
  height: 100vh;
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
}

.drawer-menu {
  flex: 1;
}

/* 主区域 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 60px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid rgba(43, 43, 43, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hamburger {
  font-size: 26px;
  color: #4a4a4a;
  padding: 4rpx 12rpx;
}

.top-title {
  font-size: 17px;
  font-weight: 600;
  color: #2b2b2b;
  letter-spacing: 1px;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.u-avatar {
  width: 32px;
  height: 32px;
  line-height: 32px;
  text-align: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b2e2e, #6e2222);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.u-name {
  font-size: 14px;
  color: #2b2b2b;
}

.logout-btn {
  font-size: 13px;
  color: #8b2e2e;
  padding: 6px 12px;
  border: 1px solid rgba(139, 46, 46, 0.3);
  border-radius: 8px;
}

.content {
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
}
</style>
