<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>

    <view v-if="report" class="report">
      <!-- 综合评分 -->
      <view class="card score-card">
        <view class="score-num">{{ report.averageScore ?? '—' }}</view>
        <view class="score-label">综合评分（满分100）</view>
        <view class="score-rank">班级第 {{ report.classRank ?? '—' }} 名 / 共 {{ report.classSize ?? '—' }} 人 · 已上 {{ report.totalLessons ?? '—' }} 课</view>
      </view>

      <!-- 四维度 -->
      <view class="card">
        <view class="section-title">能力维度</view>
        <view v-for="d in dimList" :key="d.name" class="dim">
          <view class="dim-top">
            <text>{{ d.name }}</text>
            <text>{{ d.score }}</text>
          </view>
          <progress :percent="Number(d.score) || 0" stroke-width="6" backgroundColor="#f3f4f6" activeColor="#3b82f6" />
        </view>
      </view>

      <!-- 课堂情绪 -->
      <view class="card" v-if="report.emotions">
        <view class="section-title">课堂情绪</view>
        <view class="emo-row">
          <view class="emo-item pos">积极 {{ report.emotions.distribution?.positive ?? 0 }}</view>
          <view class="emo-item neu">中性 {{ report.emotions.distribution?.neutral ?? 0 }}</view>
          <view class="emo-item neg">消极 {{ report.emotions.distribution?.negative ?? 0 }}</view>
        </view>
      </view>

      <!-- 最近课堂评价 -->
      <view class="card" v-if="report.evaluations && report.evaluations.length">
        <view class="section-title">最近课堂评价</view>
        <view v-for="e in report.evaluations.slice(0, 5)" :key="e.id" class="exam">
          <view class="exam-title">得分 {{ e.score }} · {{ fmtDate(e.createdAt) }}</view>
          <view class="exam-meta" v-if="e.comment">{{ e.comment }}</view>
        </view>
      </view>

      <button class="btn" open-type="share">分享给家长</button>
    </view>

    <view v-if="!loading && !report" class="empty">暂无成绩报告</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { http } from '@/utils/request'
import { getStudentId } from '@/utils/student'
import { useStudentAuth } from '@/composables/useStudentAuth'

const report = ref<any>(null)
const loading = ref(true)

const DIM_LABELS: Record<string, string> = {
  attendance: '出勤',
  discipline: '纪律',
  participation: '课堂参与',
  homework: '作业完成',
}

const dimList = computed(() => {
  const d = report.value?.dimensions || {}
  return Object.keys(DIM_LABELS).map((k) => ({
    name: DIM_LABELS[k],
    score: d[k] ?? 0,
  }))
})

useStudentAuth(() => {
  load()
})

async function load() {
  const studentId = getStudentId()
  if (!studentId) return
  loading.value = true
  try {
    report.value = await http.get<any>('/evaluations/student/' + studentId + '/report')
  } catch (e) {
    report.value = null
  } finally {
    loading.value = false
  }
}

function fmtDate(s: string) {
  if (!s) return ''
  return s.slice(0, 10)
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
  background: #f5f6fa;
}

.loading,
.empty {
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

.score-card {
  text-align: center;
  padding: 48rpx 28rpx;
  background: linear-gradient(135deg, #1e3a5f, #2563eb);
  color: #fff;
}

.score-num {
  font-size: 88rpx;
  font-weight: 800;
}

.score-label {
  font-size: 26rpx;
  opacity: 0.85;
  margin-top: 8rpx;
}

.score-rank {
  font-size: 24rpx;
  opacity: 0.85;
  margin-top: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}

.dim {
  margin-bottom: 20rpx;
}

.dim-top {
  display: flex;
  justify-content: space-between;
  font-size: 26rpx;
  color: #374151;
  margin-bottom: 8rpx;
}

.emo-row {
  display: flex;
  gap: 16rpx;
}

.emo-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.pos { color: #10b981; background: #d1fae5; }
.neu { color: #6b7280; background: #f3f4f6; }
.neg { color: #ef4444; background: #fee2e2; }

.exam {
  padding: 20rpx 0;
  border-top: 1rpx solid #f3f4f6;
}

.exam-title {
  font-size: 26rpx;
  color: #1f2937;
}

.exam-meta {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
}

.btn {
  background: #1e3a5f;
  color: #fff;
  border-radius: 12rpx;
  margin-top: 8rpx;
}
</style>
