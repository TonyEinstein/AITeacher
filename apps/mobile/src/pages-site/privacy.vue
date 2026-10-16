<script setup lang="ts">
import { onMounted } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useTracking } from '@/composables/useSite';

const { pageview } = useTracking();
onMounted(() => pageview('/privacy'));
</script>

<template>
  <SiteShell current="privacy">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head">
          <view class="eyebrow">PRIVACY</view>
          <view class="section-h2">隐 私 政 策</view>
        </view>
        <view class="legal-box">
          <text class="lp">本页面为隐私政策占位页，正式文本待法务确认后发布。</text>
          <text class="lp" style="margin-top:14px;">我们将遵循相关法律法规，妥善保护学校、学生与家长的个人信息。</text>
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
