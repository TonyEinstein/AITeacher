<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useReveal } from '@/composables/useReveal';
import { useTracking } from '@/composables/useSite';
import { useSiteNav } from '@/composables/useSiteNav';

const { pageview } = useTracking();
const { go } = useSiteNav();
useReveal();
onMounted(() => pageview('/faq'));

const faqs = reactive([
  { q: '断网了怎么办？', a: '教室双链路兜底：主网络断开自动切换 4G/5G，学生无感知；课堂数据本地暂存，网络恢复后自动同步。', open: false },
  { q: '学生数据安全吗？', a: '数据归学校所有，人脸照片与成绩等敏感信息加密存储，不外泄、不用于训练，可签署数据保护条款。', open: false },
  { q: '怎么部署？', a: '学校装一个客户端（教室小盒子出厂预装系统），教室接投影和摄像头，网线连好即可开课，云端集中管理，学校免运维。', open: false },
  { q: '辅导怎么开通？', a: '辅导能力包含在学校订阅方案内，寒暑假可低成本额外开通，按班级或学生批量配置，无需额外采购硬件。', open: false },
  { q: '如何合作？', a: '按学校年订阅、费用按教室数核算，教室越多费用越高，加购模块单独计费。具体方案与报价请联系我们获取，谈妥后在后台为您开通服务。', open: false },
  { q: '有问题找谁？', a: '专属运维对接，可远程协助排查，重大故障提供应急预案，售后工单全程跟踪。', open: false },
]);
function toggle(i: number) {
  faqs[i].open = !faqs[i].open;
}
</script>

<template>
  <SiteShell current="faq">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head" data-reveal>
        <view class="eyebrow">FAQ</view>
        <view class="section-h2">常 见 问 题</view>
          <view class="section-sub">常见疑问，一查便知</view>
        </view>
        <view class="faq-list">
          <view v-for="(f,i) in faqs" :key="f.q" class="faq-item" :class="{ closed: !f.open }" @click="toggle(i)">
            <text class="faq-q">{{ f.q }}</text>
            <text class="ans">{{ f.a }}</text>
          </view>
        </view>
        <view style="text-align:center;margin-top:44px;">
          <text style="color:var(--muted);display:block;margin-bottom:22px;">还有疑问？直接联系我们</text>
          <view class="btn btn-primary" @click="go('/pages-site/contact')">联系我们</view>
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
.faq-q {
  display: block;
  font-size: 18px;
  letter-spacing: 1px;
  font-weight: 700;
}
@media (max-width: 768px) {
  .section-h2 {
    font-size: 32px;
  }
}
</style>
