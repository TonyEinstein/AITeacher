<script setup lang="ts">
import { onMounted } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useReveal } from '@/composables/useReveal';
import { useTracking } from '@/composables/useSite';
import { useSiteNav } from '@/composables/useSiteNav';

const { pageview } = useTracking();
const { go } = useSiteNav();
useReveal();
onMounted(() => pageview('/features'));

const features = [
  { c: 'i1', g: '课', t: '自动上课', v: '到点开讲，全程无人值守', d: '上传教材自动排课、生成 PPT 大纲与讲稿，按课表到点自动上下课，点名、互动、板书全流程自动。' },
  { c: 'i1', g: '人', t: '数字人授课', v: '口型手势同步，讲得稳、演得真', d: '2D 数字人按讲稿开讲，口型与手势同步，PPT 自动翻页；5 个通用形象可按科目选择，学校可定制加购。' },
  { c: 'i2', g: '问', t: '实时互动', v: '举手即识别，AI 现场答疑', d: '学生举手、起立实时识别，AI 当场答疑；走神、违纪当场提醒并记录在案，课堂节奏不被打断。' },
  { c: 'i4', g: '辅', t: '课后辅导', v: '随问随答，不会的当场讲透', d: '学生穿戴设备随身提问，辅导 Agent 跨科答疑，讲解当场可追问，辅导记录自动沉淀进学情档案。' },
  { c: 'i3', g: '批', t: '作业批改', v: 'AI 初评，教师复核即可', d: '作业推送学生小程序，AI 批改出初评与批注，教师手机复核确认，机械劳动大幅减少。' },
  { c: 'i4', g: '评', t: '个性化学情', v: '每人一份成长报告', d: '每课自动打分、长期追踪，形成个人成长档案；班级、年级、跨校排名可选参与，进步退步一目了然。' },
  { c: 'i2', g: '看', t: '家长看课', v: '上课表现，手机随时可看', d: '家长小程序实时看孩子上课画面、作业情况、在校状态，家校信息不再隔着门。' },
];
</script>

<template>
  <SiteShell current="features">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head" data-reveal>
        <view class="eyebrow">FEATURES</view>
        <view class="section-h2">产 品 功 能</view>
          <view class="section-sub">七大能力，覆盖课堂与课后全流程</view>
        </view>

        <view v-for="(f,i) in features" :key="f.t" class="feature-row">
          <view class="feature-icon"><view class="icon" :class="f.c">{{ f.g }}</view></view>
          <view class="feature-body">
            <view class="fb-h3">{{ f.t }}<text class="feature-value">{{ f.v }}</text></view>
            <text class="fb-p">{{ f.d }}</text>
          </view>
          <text class="feature-no">{{ String(i + 1).padStart(2, '0') }}</text>
        </view>

        <view style="text-align:center;margin-top:50px;">
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
.fb-h3 {
  font-size: 22px;
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.fb-p {
  font-size: 15px;
  color: var(--ink-soft);
  line-height: 1.9;
}
@media (max-width: 768px) {
  .section-h2 {
    font-size: 32px;
  }
}
</style>
