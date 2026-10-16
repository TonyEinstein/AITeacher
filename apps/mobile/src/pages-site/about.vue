<script setup lang="ts">
import { onMounted } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useReveal } from '@/composables/useReveal';
import { useTracking } from '@/composables/useSite';
import { useSiteNav } from '@/composables/useSiteNav';

const { pageview } = useTracking();
const { go } = useSiteNav();
useReveal();
onMounted(() => pageview('/about'));
</script>

<template>
  <SiteShell current="about">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head" data-reveal>
        <view class="eyebrow">ABOUT</view>
        <view class="section-h2">关 于 我 们</view>
          <view class="section-sub">让每间教室都有一位不辞辛劳的 AI 老师</view>
        </view>
        <view class="about-box">
          <text class="about-p">AI Teacher 是一套云端智能教学系统：AI 老师负责自动上课、实时互动、作业批改与课后辅导，真人老师从机械劳动中解放出来，专注教学本身。</text>
          <text class="about-p" style="margin-top:18px;">我们服务县城中学、城区学校与托管机构，用订阅制让优质教学资源以可负担的成本规模化触达每一间教室。</text>
        </view>
        <view style="text-align:center;margin-top:44px;">
          <view class="btn btn-primary" @click="go('/pages-site/contact')">预约演示</view>
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
.about-box {
  max-width: 820px;
  margin: 0 auto;
  background: #fff;
  border-radius: 24px;
  padding: 44px 50px;
  border: 1px solid var(--line);
}
.about-p {
  font-size: 16px;
  line-height: 2.1;
  color: var(--ink-soft);
  display: block;
}
@media (max-width: 768px) {
  .section-h2 {
    font-size: 32px;
  }
  .about-box {
    padding: 30px 26px;
  }
}
</style>
