<script setup lang="ts">
import { onMounted } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useReveal } from '@/composables/useReveal';
import SiteLeadForm from '@/components/site/SiteLeadForm.vue';
import { useSiteConfig, useTracking } from '@/composables/useSite';

const { config, loadSiteConfig } = useSiteConfig();
const { pageview } = useTracking();
useReveal();
onMounted(() => {
  loadSiteConfig();
  pageview('/contact');
});
</script>

<template>
  <SiteShell current="contact">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head" data-reveal>
        <view class="eyebrow">CONTACT</view>
        <view class="section-h2">联 系 我 们</view>
          <view class="section-sub">预约演示，或留下信息，我们将在工作日内联系您</view>
        </view>
        <view class="contact-box" data-reveal>
          <view class="contact-info" style="margin-bottom:8px;">
            <view>
              <view><text style="letter-spacing:2px;">咨询电话</text>：{{ config.contactPhone }}</view>
              <view><text style="letter-spacing:2px;">工作时间</text>：{{ config.workHours }}</view>
              <view><text style="letter-spacing:2px;">微信公众号</text>：{{ config.wechatName }}</view>
            </view>
          </view>
          <SiteLeadForm page="/contact" />
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
@media (max-width: 768px) {
  .section-h2 {
    font-size: 32px;
  }
}
</style>
