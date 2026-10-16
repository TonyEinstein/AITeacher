<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ current?: string }>();

const showDrawer = ref(false);
const scrolled = ref(false);

// #ifdef H5
function onScroll() {
  scrolled.value = window.scrollY > 60;
}
window.addEventListener('scroll', onScroll, { passive: true });
// #endif

// 官网页间跳转：H5 端用 navigateTo 压栈（浏览器后退可用）；
// reLaunch 是替换历史栈语义，会把上一页顶掉导致无法后退
function goPage(url: string) {
  showDrawer.value = false;
  // #ifdef H5
  uni.navigateTo({ url });
  // #endif
  // #ifndef H5
  uni.reLaunch({ url });
  // #endif
}

function goAnchor(anchor: string) {
  showDrawer.value = false;
  // #ifdef H5
  uni.navigateTo({ url: '/pages-site/index?anchor=' + anchor });
  // #endif
  // #ifndef H5
  uni.reLaunch({ url: '/pages-site/index?anchor=' + anchor });
  // #endif
}

function goLogin() {
  showDrawer.value = false;
  // #ifdef H5
  uni.navigateTo({ url: '/pages/login/index' });
  // #endif
  // #ifndef H5
  uni.reLaunch({ url: '/pages/login/index' });
  // #endif
}
</script>

<template>
  <view>
    <view class="site-nav" :class="{ scrolled }">
      <view class="site-nav-logo" @click="goPage('/pages-site/index')">AI Teacher</view>
      <view class="site-nav-links">
        <text class="nl" @click="goPage('/pages-site/features')">产品功能</text>
        <text class="nl" @click="goAnchor('solution')">解决方案</text>
        <text class="nl" @click="goPage('/pages-site/cases')">客户案例</text>
        <text class="nl" @click="goPage('/pages-site/about')">关于我们</text>
        <text class="nl" @click="goAnchor('compare')">对比</text>
        <text class="nl" @click="goPage('/pages-site/faq')">常见问题</text>
        <text class="nl" @click="goLogin">登录</text>
        <text class="nl site-nav-cta" @click="goPage('/pages-site/contact')">联系我们</text>
      </view>
      <view class="site-nav-burger" @click="showDrawer = true">☰</view>
    </view>

    <view v-if="showDrawer" class="site-nav-drawer">
      <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <text class="site-nav-logo">AI Teacher</text>
        <text style="font-size:22px;color:var(--muted);padding:4px 10px;" @click="showDrawer = false">✕</text>
      </view>
      <text class="nl" @click="goPage('/pages-site/features')">产品功能</text>
      <text class="nl" @click="goAnchor('solution')">解决方案</text>
      <text class="nl" @click="goPage('/pages-site/cases')">客户案例</text>
      <text class="nl" @click="goPage('/pages-site/about')">关于我们</text>
      <text class="nl" @click="goAnchor('compare')">对比</text>
      <text class="nl" @click="goPage('/pages-site/faq')">常见问题</text>
      <text class="nl" @click="goLogin">登录系统</text>
      <text class="nl" @click="goPage('/pages-site/contact')">联系我们</text>
    </view>
  </view>
</template>
