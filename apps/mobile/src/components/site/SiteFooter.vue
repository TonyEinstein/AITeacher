<script setup lang="ts">
import { onMounted } from 'vue';
import { useSiteConfig } from '@/composables/useSite';

const { config, loadSiteConfig } = useSiteConfig();
onMounted(loadSiteConfig);

function go(url: string) {
  // #ifdef H5
  uni.navigateTo({ url });
  // #endif
  // #ifndef H5
  uni.reLaunch({ url });
  // #endif
}
</script>

<template>
  <view class="site-footer">
    <view>© 2026 AI Teacher</view>
    <view style="margin-top:10px;letter-spacing:3px;">教无常师，以智为师 · 立德树人，以人为本</view>
    <view style="margin-top:10px;letter-spacing:1px;">
      <text @click="go('/pages-site/privacy')">隐私政策</text>
      <text style="margin:0 10px;">·</text>
      <text @click="go('/pages-site/terms')">用户协议</text>
      <template v-if="config.icpNo">
        <text style="margin:0 10px;">·</text>
        <text>{{ config.icpNo }}</text>
      </template>
    </view>
  </view>
</template>
