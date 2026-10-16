<template>
  <view class="container">
    <view v-if="loadingStats" class="loading">加载中...</view>

    <!-- ===== 统计区：分类型卡片 + 朗读连击 ===== -->
    <template v-if="!loadingStats">
      <!-- 朗读打卡连击（reading 专属亮点） -->
      <view class="card streak-card">
        <view class="streak-num">{{ stats?.readingStreakDays ?? 0 }}</view>
        <view class="streak-label">朗读打卡 · 连续 {{ stats?.readingStreakDays ?? 0 }} 天</view>
        <view class="streak-sub">每天坚持朗读，养成好习惯</view>
      </view>

      <!-- 分类型统计卡片 -->
      <view class="card">
        <view class="section-title">练习统计</view>
        <view class="stat-grid">
          <view v-for="t in typeStats" :key="t.type" class="stat-box" @click="switchTab(t.type)">
            <view class="stat-name">{{ t.name }}</view>
            <view class="stat-count">{{ t.total }} 次</view>
            <view class="stat-rate" :class="rateClass(t.correctRate)">{{ rateText(t.correctRate) }}</view>
            <view class="stat-last" v-if="t.lastAt">最近：{{ fmtDate(t.lastAt) }}</view>
            <view class="stat-last" v-else>还没练过</view>
          </view>
        </view>
      </view>
    </template>

    <!-- ===== 四类专项练习 Tab ===== -->
    <view class="tab-bar">
      <view
        v-for="t in TABS"
        :key="t.value"
        class="tab-item"
        :class="{ on: tab === t.value }"
        @click="switchTab(t.value)"
      >
        {{ t.name }}
      </view>
    </view>

    <!-- 练习提交表单 -->
    <view class="card">
      <view class="section-title">{{ currentTab.name }}</view>
      <view class="desc">{{ currentTab.desc }}</view>

      <!-- 学科（可选） -->
      <view class="field">
        <text class="label">学科（可不选）</text>
        <picker :range="SUBJECT_NAMES" @change="onSubjectChange">
          <view class="picker">{{ subjectName || '请选择学科' }}</view>
        </picker>
      </view>

      <!-- 题目内容：朗读打卡/口语跟读显示朗读文本，默写/听写显示题目 -->
      <view class="field">
        <text class="label">{{ questionLabel }}</text>
        <textarea
          v-model="question"
          class="textarea"
          :placeholder="questionPlaceholder"
          maxlength="500"
        />
      </view>

      <view class="field">
        <text class="label">{{ answerLabel }}</text>
        <textarea
          v-model="userAnswer"
          class="textarea"
          :placeholder="answerPlaceholder"
          maxlength="500"
        />
      </view>

      <!-- 默写/听写可填标准答案，由前端自动判对错；朗读/口语由学生自评 -->
      <view class="field" v-if="tab === 'dictation' || tab === 'spelling'">
        <text class="label">标准答案（选填，填写后自动判对错）</text>
        <textarea
          v-model="correctAnswer"
          class="textarea"
          placeholder="填写标准答案，提交后自动对比判分"
          maxlength="500"
        />
      </view>

      <!-- 朗读/口语：自评掌握程度；默写/听写有标准答案时自动判 -->
      <view class="field" v-if="tab === 'reading' || tab === 'oral'">
        <text class="label">本次完成情况</text>
        <view class="judge-row">
          <view class="judge-btn" :class="{ ok: selfJudge === true }" @click="selfJudge = true">完成良好</view>
          <view class="judge-btn" :class="{ bad: selfJudge === false }" @click="selfJudge = false">还需加强</view>
        </view>
      </view>

      <button class="btn" :loading="submitting" :disabled="!question || !userAnswer" @click="submit">
        提交练习
      </button>
      <view class="session-tip" v-if="sessionId">当前练习会话 #{{ sessionId }}（进入页面时自动创建）</view>
      <view class="session-tip" v-else>正在创建练习会话...</view>
    </view>

    <!-- ===== 本次练习历史（当前类型最近记录） ===== -->
    <view class="card" v-if="history.length > 0">
      <view class="section-title">最近练习（{{ currentTab.name }}）</view>
      <view v-for="item in history" :key="item.id" class="record">
        <view class="record-top">
          <text class="record-q">{{ item.question }}</text>
          <text class="record-status" :class="judgeClass(item.isCorrect)">{{ judgeText(item.isCorrect) }}</text>
        </view>
        <view class="record-meta">我的作答：{{ item.userAnswer }}</view>
        <view class="record-meta" v-if="item.correctAnswer">标准答案：{{ item.correctAnswer }}</view>
        <view class="record-meta">{{ fmtTime(item.createdAt) }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * B5 学科专项练习页（PRD §3.19）
 * ---------------------------------------------------------------
 * 四类专项：reading 朗读打卡 / dictation 默写 / oral 口语跟读 / spelling 单词听写。
 *
 * 接口对接（均为 2026-10-10 新增端点，前缀 /api/v1）：
 *  - 提交：POST /practice/record { sessionId, practiceType, subject?, question,
 *          userAnswer, correctAnswer?, isCorrect? }
 *  - 统计：GET /practice/stats?studentId= → { types: [{type,total,correctRate,lastAt}],
 *          readingStreakDays }
 *  - 历史：GET /practice/history?studentId=&type=
 *
 * sessionId 说明：/practice/record 要求记录归属一个辅导会话（PracticeRecord.sessionId
 * 外键关联 TutoringSession）。本页没有辅导会话上下文，因此进入页面时调用
 * POST /tutoring/session/start/:studentId 创建一个新会话（现有 tutoring 模块的
 * 开会话接口），后续所有练习提交都挂在该会话下。
 * 注意：session/start 要求学生已开通辅导订阅（未开通时后端返回 400），此时提交按钮
 * 会提示开通，统计/历史不受影响。
 */
import { ref, computed } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { http } from '@/utils/request'
import { getStudentId } from '@/utils/student'
import { useStudentAuth } from '@/composables/useStudentAuth'

/** 四类专项练习定义 */
const TABS = [
  { value: 'reading', name: '朗读打卡', desc: '选择一篇课文或段落，大声朗读后提交打卡' },
  { value: 'dictation', name: '默写', desc: '根据题目默写内容，可填标准答案自动判分' },
  { value: 'oral', name: '口语跟读', desc: '跟读句子或对话，自评完成情况' },
  { value: 'spelling', name: '单词听写', desc: '听写单词，可填标准答案自动判分' },
] as const

/** 学科选项（提交时传中文 subject 字符串，后端仅存文本） */
const SUBJECT_NAMES = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

const tab = ref<string>('reading')
const currentTab = computed(() => TABS.find((t) => t.value === tab.value) || TABS[0])

const stats = ref<any>(null)
const loadingStats = ref(true)
const history = ref<any[]>([])

const subjectName = ref('')
const question = ref('')
const userAnswer = ref('')
const correctAnswer = ref('')
const selfJudge = ref<boolean | null>(null)
const submitting = ref(false)

/** 练习会话 id：进入页面时自动创建（见文件头注释） */
const sessionId = ref<number | null>(null)
/** 当前学生 id */
let studentIdCache: number | null = null

useStudentAuth(() => {
  studentIdCache = getStudentId()
  if (!studentIdCache) return
  loadStats()
  loadHistory()
  ensureSession()
})

onHide(() => {
  // 离开页面重置表单，避免下次进入带着旧内容
  resetForm()
})

/** 分类型统计卡片数据（stats.types 顺序渲染，缺的类型补 0） */
const typeStats = computed(() => {
  const byType = new Map<string, any>((stats.value?.types || []).map((t: any) => [t.type, t]))
  return TABS.map((t) => {
    const s = byType.get(t.value)
    return {
      type: t.value,
      name: t.name,
      total: s?.total ?? 0,
      correctRate: s?.correctRate ?? null,
      lastAt: s?.lastAt ?? null,
    }
  })
})

function switchTab(v: string) {
  tab.value = v
  resetForm()
  loadHistory()
}

function resetForm() {
  question.value = ''
  userAnswer.value = ''
  correctAnswer.value = ''
  selfJudge.value = null
}

function onSubjectChange(e: any) {
  subjectName.value = SUBJECT_NAMES[Number(e.detail.value)] || ''
}

/** 题目输入框文案（按类型区分） */
const questionLabel = computed(() =>
  tab.value === 'reading' || tab.value === 'oral' ? '朗读/跟读内容' : '题目',
)
const questionPlaceholder = computed(() => {
  if (tab.value === 'reading') return '如：请朗读《春》第一自然段'
  if (tab.value === 'oral') return '如：跟读句子 I have a dream'
  if (tab.value === 'dictation') return '如：默写《静夜思》全诗'
  return '如：听写单词 beautiful'
})
const answerLabel = computed(() =>
  tab.value === 'reading' || tab.value === 'oral' ? '实际完成情况记录' : '我的作答',
)
const answerPlaceholder = computed(() => {
  if (tab.value === 'reading') return '记录本次朗读情况，如：已朗读 3 遍，流利'
  if (tab.value === 'oral') return '记录跟读情况，如：跟读 2 遍，发音清晰'
  return '写下你的答案'
})

/** 加载分类型统计（含朗读连击天数） */
async function loadStats() {
  loadingStats.value = true
  try {
    stats.value = await http.get<any>('/practice/stats', { studentId: studentIdCache })
  } catch (e) {
    stats.value = null
  } finally {
    loadingStats.value = false
  }
}

/** 加载当前类型的最近练习历史 */
async function loadHistory() {
  if (!studentIdCache) return
  try {
    history.value = await http.get<any[]>('/practice/history', {
      studentId: studentIdCache,
      type: tab.value,
    })
  } catch (e) {
    history.value = []
  }
}

/**
 * 确保有可用的辅导会话（提交 /practice/record 必须带 sessionId）。
 * 首次进入创建；已有则复用。失败（如未开通订阅）不阻塞统计/历史展示，
 * 提交时再给出提示。
 */
async function ensureSession() {
  if (!studentIdCache) return
  if (sessionId.value) return
  try {
    const s: any = await http.post<any>('/tutoring/session/start/' + studentIdCache, {}, {
      showError: false,
    })
    sessionId.value = s?.id ?? null
  } catch (e) {
    // 未开通辅导订阅等场景：置空，提交时提示
    sessionId.value = null
  }
}

/** 提交一次练习 */
async function submit() {
  if (!studentIdCache) return
  if (!question.value || !userAnswer.value) return
  // 没有会话（如未开通订阅）时再尝试创建一次，仍失败则提示
  if (!sessionId.value) {
    await ensureSession()
    if (!sessionId.value) {
      uni.showToast({ title: '练习需要辅导会话，请先开通 AI 一对一辅导', icon: 'none' })
      return
    }
  }

  // 判分：默写/听写填了标准答案 → 自动对比；朗读/口语 → 用自评；否则不判（null）
  let isCorrect: boolean | null = null
  if ((tab.value === 'dictation' || tab.value === 'spelling') && correctAnswer.value) {
    isCorrect = userAnswer.value.trim() === correctAnswer.value.trim()
  } else if (tab.value === 'reading' || tab.value === 'oral') {
    isCorrect = selfJudge.value
  }

  submitting.value = true
  try {
    await http.post('/practice/record', {
      sessionId: sessionId.value,
      practiceType: tab.value,
      subject: subjectName.value || undefined,
      question: question.value,
      userAnswer: userAnswer.value,
      correctAnswer: correctAnswer.value || undefined,
      isCorrect,
    })
    uni.showToast({ title: '提交成功', icon: 'success' })
    resetForm()
    loadStats()
    loadHistory()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

/** 正确率文案：null（未判分）显示「—」 */
function rateText(rate: number | null) {
  return rate == null ? '—' : rate + '%'
}
function rateClass(rate: number | null) {
  if (rate == null) return ''
  if (rate >= 80) return 'good'
  if (rate >= 60) return 'mid'
  return 'bad'
}
function judgeText(v: boolean | null) {
  if (v === true) return '通过'
  if (v === false) return '待加强'
  return '未判分'
}
function judgeClass(v: boolean | null) {
  if (v === true) return 'ok'
  if (v === false) return 'bad'
  return ''
}
function fmtDate(s: string) {
  return s ? s.slice(0, 10) : ''
}
function fmtTime(s: string) {
  return s ? s.slice(0, 16).replace('T', ' ') : ''
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
  background: #f5f6fa;
}

.loading {
  text-align: center;
  color: #9ca3af;
  padding: 48rpx 0;
  font-size: 26rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}

.desc {
  font-size: 24rpx;
  color: #9ca3af;
  margin-bottom: 24rpx;
}

/* ===== 朗读连击卡 ===== */
.streak-card {
  text-align: center;
  padding: 40rpx 28rpx;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff;
}

.streak-num {
  font-size: 72rpx;
  font-weight: 800;
}

.streak-label {
  font-size: 28rpx;
  margin-top: 8rpx;
}

.streak-sub {
  font-size: 22rpx;
  opacity: 0.85;
  margin-top: 8rpx;
}

/* ===== 分类型统计 ===== */
.stat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.stat-box {
  flex: 1 1 40%;
  min-width: 280rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 24rpx;
}

.stat-name {
  font-size: 26rpx;
  color: #374151;
  font-weight: 600;
}

.stat-count {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #1e3a5f;
}

.stat-rate {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.stat-rate.good { color: #10b981; }
.stat-rate.mid { color: #f59e0b; }
.stat-rate.bad { color: #ef4444; }

.stat-last {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

/* ===== Tab 栏 ===== */
.tab-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  background: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #6b7280;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.tab-item.on {
  background: #1e3a5f;
  color: #fff;
  font-weight: 600;
}

/* ===== 表单 ===== */
.field {
  margin-bottom: 28rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}

.picker {
  padding: 20rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1f2937;
}

.textarea {
  width: 100%;
  height: 140rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.judge-row {
  display: flex;
  gap: 16rpx;
}

.judge-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  background: #f9fafb;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #6b7280;
}

.judge-btn.ok {
  background: #d1fae5;
  color: #10b981;
  font-weight: 600;
}

.judge-btn.bad {
  background: #fee2e2;
  color: #ef4444;
  font-weight: 600;
}

.btn {
  background: #1e3a5f;
  color: #fff;
  border-radius: 12rpx;
}

.session-tip {
  margin-top: 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: #9ca3af;
}

/* ===== 练习历史 ===== */
.record {
  padding: 20rpx 0;
  border-top: 1rpx solid #f3f4f6;
}

.record:first-of-type {
  border-top: none;
}

.record-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.record-q {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.5;
}

.record-status {
  flex-shrink: 0;
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.record-status.ok { color: #10b981; background: #d1fae5; }
.record-status.bad { color: #ef4444; background: #fee2e2; }

.record-meta {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9ca3af;
}
</style>
