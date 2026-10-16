<script setup lang="ts">
import { onMounted } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useTracking } from '@/composables/useSite';

const { pageview } = useTracking();
onMounted(() => pageview('/terms'));
</script>

<template>
  <SiteShell current="terms">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head">
          <view class="eyebrow">TERMS</view>
          <view class="section-h2">用 户 协 议</view>
        </view>
        <view class="legal-box">
          <text class="lp">本页面为用户协议占位页，正式文本待法务确认后发布。</text>
          <text class="lp" style="margin-top:14px;">服务采用学校年订阅制，具体条款以正式协议为准。</text>
        </view>
      </view>
    </view>
  </SiteShell>
</template>

<style lang="scss" scoped>
.section-h2 {
  font-size: 46px;
  letter-spacing: 8px;
  font-weight: 700;
}
.lp {
  display: block;
  font-size: 15px;
  line-height: 2;
  color: var(--ink-soft);
}
@media (max-width: 768px) {
  .section-h2 {
    font-size: 32px;
  }
}
</style>
