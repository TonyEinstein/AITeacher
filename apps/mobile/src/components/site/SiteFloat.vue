<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SiteLeadForm from './SiteLeadForm.vue';
import { useSiteConfig } from '@/composables/useSite';

const { config, loadSiteConfig } = useSiteConfig();
const showModal = ref(false);
const showTop = ref(false);

onMounted(loadSiteConfig);

// #ifdef H5
function onScroll() {
  showTop.value = window.scrollY > 600;
}
window.addEventListener('scroll', onScroll, { passive: true });
// #endif

function toTop() {
  uni.pageScrollTo({ scrollTop: 0, duration: 250 });
}
</script>

<template>
  <view>
    <view v-if="showTop" class="site-top" @click="toTop">↑</view>
    <view class="site-float" @click="showModal = true">💬</view>

    <view v-if="showModal" class="site-modal-mask" @click.self="showModal = false">
      <view class="site-modal-box">
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <text style="font-size:18px;font-weight:700;letter-spacing:2px;">咨询 AI Teacher</text>
          <text style="font-size:22px;color:var(--muted);" @click="showModal = false">✕</text>
        </view>
        <view style="font-size:14px;line-height:2.2;color:var(--ink-soft);">
          <view>电话：{{ config.contactPhone }}</view>
          <view>微信：{{ config.wechatName }}</view>
          <view v-if="config.workHours">工作时间：{{ config.workHours }}</view>
        </view>
        <SiteLeadForm page="/contact" :compact="true" @submitted="showModal = false" />
      </view>
    </view>
  </view>
</template>
