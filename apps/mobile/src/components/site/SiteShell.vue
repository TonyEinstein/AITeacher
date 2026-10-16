<script setup lang="ts">
import SiteHeader from './SiteHeader.vue';
import SiteFooter from './SiteFooter.vue';
import SiteFloat from './SiteFloat.vue';

defineProps<{ current?: string }>();
</script>

<template>
  <view>
    <SiteHeader :current="current" />
    <slot />
    <SiteFooter />
    <SiteFloat />
  </view>
</template>

<!-- 官网全局主题 site.scss 已移至 App.vue 全局注入：
     此处 scoped/组件级 import 会被打上本组件的 data-v-hash，
     与页面 slot 内容的 scope 对不上，导致整站样式失效（裸文本 bug）。 -->

