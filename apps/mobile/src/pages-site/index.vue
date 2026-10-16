<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import SiteShell from '@/components/site/SiteShell.vue';
import SiteLeadForm from '@/components/site/SiteLeadForm.vue';
import InkSymbols from '@/components/site/InkSymbols.vue';
import { useSiteConfig, useTracking } from '@/composables/useSite';
import { useReveal } from '@/composables/useReveal';
import { useSiteNav } from '@/composables/useSiteNav';

const { config, loadSiteConfig } = useSiteConfig();
const { pageview } = useTracking();
const { go } = useSiteNav();

// 滚动浮现动效（原版 v-reveal 移植）
useReveal();

onMounted(() => {
  loadSiteConfig();
  pageview('/');
});

const pain = [
  { c: 'i1', g: '校', t: '招人贵，留人难', d: '名师薪资高、跳槽频繁，教学质量随人走。AI 老师全年无休，标准如一，成本可控。' },
  { c: 'i2', g: '师', t: '重复劳动，精力分散', d: '批改作业、点名、盯纪律占用大量时间。AI 接手机械工作，老师专注教学本身。' },
  { c: 'i3', g: '家', t: '孩子在校，两眼一抹黑', d: '孩子上课表现、作业情况、在校状态，手机随时可看，家校不再信息不通。' },
  { c: 'i4', g: '生', t: '有问题，找不到人', d: '放学后、假期有疑问无人解答。AI 老师随时在线，随问随答。' },
];

const teach = [
  { c: 'i1', g: '课', t: '自动上课', d: '上传教材自动排课做 PPT，到点数字人开讲，点名互动全流程自动。' },
  { c: 'i1', g: '人', t: '数字人授课', d: '数字人按讲稿开讲、口型手势同步，PPT 自动翻页，到点自动上下课。' },
  { c: 'i2', g: '问', t: '实时互动', d: '学生举手即识别，AI 现场答疑；走神违纪当场提醒，记录在案。' },
];

const after = [
  { c: 'i4', g: '辅', t: '课后辅导', d: '学生穿戴设备随问随答，辅导 Agent 跨科答疑，不会的当场讲透，辅导记录自动沉淀进学情。' },
  { c: 'i3', g: '批', t: '作业批改', d: '作业推送小程序，AI 批改出初评，教师复核即可，省却机械劳动。' },
  { c: 'i4', g: '评', t: '个性化学情', d: '每课打分、长期追踪，每个学生一份成长报告，进步退步一目了然。' },
  { c: 'i2', g: '看', t: '家长看课', d: '家长小程序实时看孩子上课与表现，透明可见，放心安心。' },
];

const solutions = [
  { c: 'i1', g: '校', t: '给学校', d: 'AI 老师标准如一、全年无休，替代高薪名师的部分重复教学；课后辅导批量开通，寒暑假不增聘老师也能覆盖全部答疑；云端集中部署，学校免运维，订阅制按教室数核算。' },
  { c: 'i2', g: '师', t: '给老师', d: '自动备课、自动批改、自动点名考勤，把老师从机械劳动中解放出来；课后答疑交给辅导 Agent 承接，老师手机随时复核作业、审批请假、巡课看报表，专注教学本身。' },
  { c: 'i3', g: '家', t: '给家长', d: '小程序实时看孩子上课、看成绩排名、看作业与情绪状态；孩子放学、假期有疑问，AI 辅导随问随答，不再为天价一对一买单，家校不再隔着门。' },
  { c: 'i4', g: '生', t: '给学生', d: '课堂有 AI 老师授课答疑，课后有辅导 Agent 随身解答；不会的当场讲透，每节课有参与分、每个问题有回应，人人被看见。' },
];

const compareTeach = [
  ['授课稳定性', '请假、跳槽、情绪起伏', '全年无休，标准如一'],
  ['备课与开课', '手工备课，逐课准备', '教材上传自动排课，到点数字人开讲'],
  ['课堂关注度', '班大顾不过来', '同时盯全班，举手、违纪实时识别'],
  ['课堂纪律', '靠盯靠吼，顾此失彼', '数字人当场提醒，规则可配置'],
  ['课堂数据', '靠手记，不系统', '每课自动打分，沉淀成长档案'],
];
const compareTutor = [
  ['辅导时间', '仅限在校，课后难找人', '24 小时在线，随问随答'],
  ['假期辅导', '天价一对一', '低成本批量开通，寒暑假照常'],
  ['跨科覆盖', '一科一师，凑齐不易', '一个辅导 Agent 全科随身解答'],
  ['一对一关注', '时间有限，难以兼顾', '一人一实例，每个问题都有回应'],
  ['辅导成效', '口头讲解，事后无据', '即时评估，错题沉淀进学情'],
];

const homeFaqs = reactive([
  { q: '断网了怎么办？', a: '教室双链路兜底，主网络断自动切 4G/5G，无感知。', open: false },
  { q: '学生数据安全吗？', a: '数据归学校所有，人脸和成绩加密存储，不外泄。', open: false },
  { q: '怎么部署？', a: '学校装一个客户端（教室小盒子出厂预装），教室接投影和摄像头，网线连好即可。', open: false },
  { q: '如何合作？', a: '按学校年订阅、按教室数核算，具体方案与报价请联系我们获取，谈妥后在后台开通服务。', open: false },
]);
function toggleFaq(i: number) {
  homeFaqs[i].open = !homeFaqs[i].open;
}

onLoad((options: any) => {
  if (options && options.anchor) {
    setTimeout(() => {
      uni.pageScrollTo({ selector: '.anchor-' + options.anchor, duration: 400 });
    }, 700);
  }
});
</script>

<template>
  <SiteShell current="home">
    <!-- Hero -->
    <view class="hero">
      <!-- 水墨符号粒子背景（原版官网 InkCanvasBg 移植）：学科符号漂浮，
           鼠标跟随、滚动换字；reduced-motion 自动降级为静态 -->
      <InkSymbols class="ink-canvas" />
      <view class="hero-inner">
      <view class="eyebrow">智 能 教 学 引 擎</view>
      <view class="hero-h1" data-reveal>
        <text>以 AI 为师</text>
        <text class="accent">上课有根有据，辅导随叫随到</text>
      </view>
      <view class="brush-line"></view>
      <text class="hero-p">自动授课、实时互动、作业批改、个性化学情；课后 AI 辅导随身答疑，随问随答。一位不知疲倦的 AI 老师，24 小时在线，上课与辅导全程覆盖。</text>
      <view class="btn-row" data-reveal>
        <view class="btn btn-primary" @click="go('/pages-site/contact')">预约演示</view>
        <view class="btn btn-ghost" @click="go('/pages-site/features')">了解更多</view>
      </view>
      </view>
    </view>

    <!-- 痛点 -->
    <view class="site-section">
      <view class="inner">
        <view class="section-head" data-reveal>
          <view class="eyebrow">PAIN POINTS</view>
          <view class="section-h2">解 决 谁 的 问 题</view>
          <view class="section-sub">四方痛点，一一对应</view>
        </view>
        <view class="grid grid-4" data-reveal>
          <view v-for="p in pain" :key="p.t" class="bezel">
            <view class="card">
              <view class="icon" :class="p.c">{{ p.g }}</view>
              <view class="card-h3">{{ p.t }}</view>
              <text class="card-p">{{ p.d }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 功能 -->
    <view class="site-section cream">
      <view class="inner">
        <view class="section-head" data-reveal>
          <view class="eyebrow">FEATURES</view>
          <view class="section-h2">产 品 能 做 什 么</view>
          <view class="section-sub">七大能力，覆盖教学与辅导全流程</view>
        </view>
        <view class="band-title">上 课</view>
        <view class="grid grid-3" style="margin-bottom:44px;" data-reveal>
          <view v-for="p in teach" :key="p.t" class="bezel">
            <view class="card">
              <view class="icon" :class="p.c">{{ p.g }}</view>
              <view class="card-h3">{{ p.t }}</view>
              <text class="card-p">{{ p.d }}</text>
            </view>
          </view>
        </view>
        <view class="band-title">辅 导 与 课 后</view>
        <view class="grid grid-4" data-reveal>
          <view v-for="p in after" :key="p.t" class="bezel">
            <view class="card">
              <view class="icon" :class="p.c">{{ p.g }}</view>
              <view class="card-h3">{{ p.t }}</view>
              <text class="card-p">{{ p.d }}</text>
            </view>
          </view>
        </view>
        <view style="text-align:center;margin-top:44px;">
          <view class="btn btn-ghost" @click="go('/pages-site/features')">查看全部功能</view>
        </view>
      </view>
    </view>

    <!-- 方案 -->
    <view class="site-section anchor-solution">
      <view class="inner">
        <view class="section-head" data-reveal>
          <view class="eyebrow">SOLUTIONS</view>
          <view class="section-h2">四 方 解 决 方 案</view>
          <view class="section-sub">上课 + 辅导，四方受益</view>
        </view>
        <view class="grid grid-4" data-reveal>
          <view v-for="p in solutions" :key="p.t" class="bezel">
            <view class="card">
              <view class="icon" :class="p.c">{{ p.g }}</view>
              <view class="card-h3">{{ p.t }}</view>
              <text class="card-p">{{ p.d }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 对比 -->
    <view class="site-section anchor-compare">
      <view class="inner">
        <view class="section-head" data-reveal>
          <view class="eyebrow">COMPARISON</view>
          <view class="section-h2">与 真 人 教 师 之 别</view>
          <view class="section-sub">上课与辅导，优势都看得见</view>
        </view>
        <view class="band-title">上 课</view>
        <view class="vtable" style="margin-bottom:48px;" data-reveal>
          <view class="vrow vhead"><text>维度</text><text>真人教师</text><text>AI 老师</text></view>
          <view v-for="(r,i) in compareTeach" :key="'t'+i" class="vrow">
            <text>{{ r[0] }}</text><text>{{ r[1] }}</text><text class="vwin">{{ r[2] }}</text>
          </view>
        </view>
        <view class="band-title">辅 导</view>
        <view class="vtable" data-reveal>
          <view class="vrow vhead"><text>维度</text><text>真人教师</text><text>AI 老师</text></view>
          <view v-for="(r,i) in compareTutor" :key="'u'+i" class="vrow">
            <text>{{ r[0] }}</text><text>{{ r[1] }}</text><text class="vwin">{{ r[2] }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 数据 -->
    <view class="site-section cream">
      <view class="inner">
        <view class="section-head" data-reveal>
          <view class="eyebrow">DATA</view>
          <view class="section-h2">数 据 背 书</view>
          <view class="section-sub">真实运营数据（上线后更新为实际数值）</view>
        </view>
        <view class="grid grid-3" data-reveal>
          <view class="bezel"><view class="card" style="text-align:center;">
            <view class="icon i1" style="margin:0 auto 18px;">校</view>
            <view class="big-num">{{ config.schoolsCount }}</view>
            <view class="card-h3" style="margin-top:10px;">已服务学校数</view>
            <text class="card-p">覆盖县中、城区中学与托管机构</text>
          </view></view>
          <view class="bezel"><view class="card" style="text-align:center;">
            <view class="icon i2" style="margin:0 auto 18px;">生</view>
            <view class="big-num">{{ config.studentsCount }}</view>
            <view class="card-h3" style="margin-top:10px;">覆盖学生数</view>
            <text class="card-p">每节课自动点名、打分、留档</text>
          </view></view>
          <view class="bezel"><view class="card" style="text-align:center;">
            <view class="icon i3" style="margin:0 auto 18px;">省</view>
            <view class="big-num">{{ config.costSave }}</view>
            <view class="card-h3" style="margin-top:10px;">节支成本</view>
            <text class="card-p">对比同规模真人名师授课成本</text>
          </view></view>
        </view>
      </view>
    </view>

    <!-- FAQ 精选 -->
    <view class="site-section">
      <view class="inner">
        <view class="section-head" data-reveal>
          <view class="eyebrow">FAQ</view>
          <view class="section-h2">常 见 问 题</view>
        </view>
        <view class="faq-list" data-reveal>
          <view v-for="(f,i) in homeFaqs" :key="f.q" class="faq-item" :class="{ closed: !f.open }" @click="toggleFaq(i)">
            <text class="faq-q">{{ f.q }}</text>
            <text class="ans">{{ f.a }}</text>
          </view>
        </view>
        <view style="text-align:center;margin-top:32px;">
          <view class="btn btn-ghost" @click="go('/pages-site/faq')">查看全部常见问题</view>
        </view>
      </view>
    </view>

    <!-- 联系 -->
    <view class="site-section" style="padding-top:0;">
      <view class="inner">
        <view class="contact-box" data-reveal>
          <view class="section-h2">联 系 我 们</view>
          <text style="opacity:0.7;margin-top:12px;">留下您的信息，我们将在一个工作日内联系您。</text>
          <view class="contact-info" style="margin-top:26px;">
            <view>
              <view><text style="letter-spacing:2px;">咨询电话</text>：{{ config.contactPhone }}</view>
              <view><text style="letter-spacing:2px;">工作时间</text>：{{ config.workHours }}</view>
              <view><text style="letter-spacing:2px;">微信公众号</text>：{{ config.wechatName }}</view>
            </view>
          </view>
          <SiteLeadForm page="/" />
        </view>
      </view>
    </view>
  </SiteShell>
</template>

<style lang="scss" scoped>
/* 墨韵 canvas：铺满 hero 沉底，文字浮于其上 */
.ink-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.hero {
  position: relative;
  overflow: hidden;
}
.hero-inner {
  position: relative;
  z-index: 1;
}
/* reduced-motion 下的静态墨晕兜底（组件内部同时只渲染一帧） */
@media (prefers-reduced-motion: reduce) {
  .ink-canvas {
    background:
      radial-gradient(ellipse 42% 30% at 50% 46%, rgba(139, 46, 46, 0.16), transparent 70%),
      radial-gradient(ellipse 62% 44% at 48% 52%, rgba(74, 107, 90, 0.10), transparent 72%);
  }
}
.hero-h1 {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 72px;
  line-height: 1.25;
  font-weight: 900;
  letter-spacing: 6px;
  margin-bottom: 28px;
}
.hero-h1 text {
  text-wrap: balance; /* 副题断行均衡：移动端两行宽窄不悬殊 */
}
.hero-h1 .accent {
  color: var(--cinnabar);
}
.hero-p {
  font-size: 18px;
  color: var(--ink-soft);
  max-width: 620px;
  line-height: 2;
  display: block;
  margin: 0 auto 44px; /* auto 恢复水平居中——迁移时丢失导致段落整体偏左 */
}
.section-h2 {
  font-size: 46px;
  letter-spacing: 8px;
  line-height: 1.2;
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
}
.faq-q {
  display: block;
  font-size: 18px;
  letter-spacing: 1px;
  font-weight: 700;
}
.vtable {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(43, 43, 43, 0.06);
}
.vrow {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1.5fr;
  border-bottom: 1px solid var(--line);
}
.vrow:last-child {
  border-bottom: none;
}
.vrow text {
  padding: 20px 24px;
  font-size: 15px;
  color: var(--ink-soft);
  line-height: 1.6;
}
.vrow.vhead text {
  background: #faf8f5;
  color: var(--ink);
  font-weight: 600;
  letter-spacing: 2px;
}
.vrow .vwin {
  background: rgba(74, 107, 90, 0.06);
  color: var(--jade);
  font-weight: 600;
}
@media (max-width: 768px) {
  .hero-h1 {
    font-size: 42px;
  }
  .section-h2 {
    font-size: 32px;
  }
  .vrow {
    grid-template-columns: 1fr 1fr 1.3fr;
  }
  .vrow text {
    padding: 14px 12px;
    font-size: 13px;
  }
}
</style>
