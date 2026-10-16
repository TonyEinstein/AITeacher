<script setup lang="ts">
import { onMounted } from 'vue';
import SiteShell from '@/components/site/SiteShell.vue';
import { useReveal } from '@/composables/useReveal';
import { useTracking } from '@/composables/useSite';
import { useSiteNav } from '@/composables/useSiteNav';

const { pageview } = useTracking();
const { go } = useSiteNav();
useReveal();
onMounted(() => pageview('/cases'));

const cases = [
  { c: 'i1', g: '县', t: '县城中学 · 数学', d: '3 个教室、6 个班接入自动上课与作业批改，老师复核时间日均减少 2 小时，月考平均分提升 9 分，教学进度更稳。' },
  { c: 'i2', g: '城', t: '城市校区 · 英语', d: '口语跟读、单词听写交给 AI 专项练习，家长实时看课参与率 82%，续费意愿明显提升。' },
  { c: 'i3', g: '暑', t: '暑期托管 · 全科', d: '寒暑假低成本批量开通辅导 Agent，学生随问随答；不增聘老师即可覆盖全部答疑，托管服务质量不打折。' },
];
</script>

<template>
  <SiteShell current="cases">
    <view class="site-section" style="padding-top:170px;">
      <view class="inner">
        <view class="section-head" data-reveal>
        <view class="eyebrow">CASES</view>
        <view class="section-h2">客 户 案 例</view>
          <view class="section-sub">从县城中学到城市校区，AI 老师正在开课</view>
        </view>
        <view class="grid grid-3" data-reveal>
          <view v-for="c in cases" :key="c.t" class="bezel">
            <view class="card">
              <view class="icon" :class="c.c">{{ c.g }}</view>
              <view class="card-h3">{{ c.t }}</view>
              <text class="card-p">{{ c.d }}</text>
              <text class="case-note">案例示意，详情联系获取</text>
            </view>
          </view>
        </view>
        <view style="text-align:center;margin-top:50px;">
          <text style="color:var(--muted);display:block;margin-bottom:22px;">想了解与您情况类似的落地效果？</text>
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
.card-h3 {
  font-size: 21px;
  margin-bottom: 12px;
  letter-spacing: 2px;
}
.card-p {
  font-size: 15px;
  color: var(--ink-soft);
  line-height: 1.9;
  text-align: justify; /* 两端对齐消孤字残行 */
}
@media (max-width: 768px) {
  .section-h2 {
    font-size: 32px;
  }
}
</style>
