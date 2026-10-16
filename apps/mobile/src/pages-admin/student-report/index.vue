<template>
  <AdminLayout title="学生学情报告">
    <!-- 筛选 -->
    <view class="panel">
      <view class="filter-bar">
        <picker :range="gradeLabels" :value="gradeIdx" @change="pickGrade">
          <view class="picker-box small">{{ gradeIdx >= 0 && gradeLabels.length ? gradeLabels[gradeIdx] : '选择年级' }}</view>
        </picker>
        <picker :range="classLabels" :value="classIdx" @change="pickClass">
          <view class="picker-box small">{{ classIdx >= 0 && classLabels.length ? classLabels[classIdx] : '选择班级' }}</view>
        </picker>
        <picker :range="studentLabels" :value="studentIdx" @change="pickStudent">
          <view class="picker-box small">{{ studentIdx >= 0 && studentLabels.length ? studentLabels[studentIdx] : '选择学生' }}</view>
        </picker>
        <picker :range="subjectLabels" :value="subjectIdx" @change="pickSubject">
          <view class="picker-box small">{{ subjectIdx >= 0 && subjectLabels.length ? subjectLabels[subjectIdx] : '全部学科' }}</view>
        </picker>
      </view>
    </view>

    <template v-if="report">
      <!-- 概览卡片 -->
      <view class="stat-row">
        <view v-for="c in overviewCards" :key="c.label" class="stat-card">
          <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
          <view class="stat-info">
            <view class="stat-value">{{ c.value }}</view>
            <view class="stat-label">{{ c.label }}</view>
          </view>
        </view>
      </view>

      <view class="two-col">
        <!-- 各维度 -->
        <view class="panel">
          <view class="panel-title">各维度表现</view>
          <view v-for="d in dimensionRows" :key="d.key" class="dim-row">
            <text class="dim-label">{{ d.label }}</text>
            <ProportionBar :value="Math.round(d.value)" :color="dimColor(d.value)" />
            <text class="dim-val">{{ Math.round(d.value) }}</text>
          </view>
          <view v-if="!report.totalLessons" class="empty">暂无课堂数据</view>
        </view>

        <!-- 情绪分布 -->
        <view class="panel">
          <view class="panel-title">课堂情绪分布</view>
          <view v-for="e in emotionRows" :key="e.key" class="emo-row">
            <view class="emo-head">
              <text class="emo-label">{{ e.label }}</text>
              <text class="emo-count" :style="{ color: e.color }">{{ e.count }}</text>
            </view>
            <ProportionBar :value="e.percent" :color="e.color" />
          </view>
          <view class="emo-latest">
            最近一节课情绪：
            <text class="tag" :class="emotionTagClass(report.emotions?.latest)">{{ emotionText(report.emotions?.latest) }}</text>
          </view>
        </view>
      </view>

      <!-- 薄弱知识点 -->
      <view class="panel">
        <view class="panel-title">薄弱知识点</view>
        <SimpleTable :columns="weakCols" :rows="weakItems">
          <template #cell-knowledgePoint="{ value }">{{ value || '未归类' }}</template>
          <template #cell-wrongCount="{ value }">{{ value }}</template>
          <template #cell-recentCount="{ value }">{{ value }}</template>
          <template #cell-sharePercent="{ row }">
            <ProportionBar :value="row.sharePercent" />
          </template>
          <template #cell-score="{ value }">{{ value }}</template>
          <template #cell-latestAt="{ value }">{{ fmtTime(value) }}</template>
        </SimpleTable>
        <view v-if="!weakItems.length" class="empty">暂无带知识点的错题，无法生成薄弱画像</view>
        <view class="note">口径：按知识点聚合的错题数（错题数 + 近30天错题×0.5 = 薄弱分），不是错误率；系统暂未记录某知识点共练多少题，算不出分母。</view>
      </view>

      <!-- 全班薄弱分布（班级维度，定位共性问题） -->
      <view class="panel">
        <view class="panel-title">
          全班薄弱分布
          <text v-if="classStudentCount" class="cd-title-sub">（全班 {{ classStudentCount }} 人）</text>
        </view>
        <view v-if="!classDist.length" class="empty">本班暂无薄弱点数据</view>
        <view v-for="d in classDist" :key="d.knowledgePoint" class="cd-item">
          <!-- 点击行展开该知识点涉及的学生名单 -->
          <view class="cd-row" @click="toggleCd(d.knowledgePoint)">
            <view class="cd-head">
              <text class="cd-kp">{{ d.knowledgePoint || '未归类' }}</text>
              <text class="cd-meta">{{ d.studentCount }} 人在错（{{ d.percentOfClass }}%）</text>
              <text class="cd-arrow" :class="{ open: expandedCd === d.knowledgePoint }">▾</text>
            </view>
            <view class="cd-bar-track">
              <view class="cd-bar-fill" :style="{ width: cdBarWidth(d.percentOfClass) }"></view>
            </view>
            <view class="cd-sub">累计错题 {{ d.wrongCount }} 题</view>
          </view>
          <view v-if="expandedCd === d.knowledgePoint" class="cd-students">
            涉及学生：{{ cdStudentsText(d) }}
          </view>
        </view>
        <view class="note">口径：全班每生取前5薄弱知识点聚合，按多少学生在错排序</view>
      </view>

      <!-- 最近课堂评估 -->
      <view class="panel">
        <view class="panel-title">最近课堂评估</view>
        <SimpleTable :columns="evalCols" :rows="report.evaluations || []">
          <template #cell-createdAt="{ value }">{{ fmtTime(value) }}</template>
          <template #cell-score="{ value }">{{ value ?? '-' }}</template>
          <template #cell-discipline="{ row }">{{ row.dimensions?.discipline ?? '-' }}</template>
          <template #cell-participation="{ row }">{{ row.dimensions?.participation ?? '-' }}</template>
          <template #cell-emotion="{ row }">
            <text class="tag" :class="emotionTagClass(row.emotion)">{{ emotionText(row.emotion) }}</text>
          </template>
          <template #cell-comment="{ value }">{{ value || '-' }}</template>
        </SimpleTable>
        <view v-if="!(report.evaluations || []).length" class="empty">暂无评估记录</view>
      </view>
    </template>

    <view v-else class="panel">
      <text class="empty">请选择 年级 → 班级 → 学生 查看学情报告</text>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import ProportionBar from '@/components/ProportionBar.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

// 学校归属：active_school_id（超管「进入学校」后写入）优先，其次登录用户自身 schoolId
// （修复：原先直接 || 1 兜底，school_admin 未进学校视图时会越权查 school 1 被 403）
const schoolId =
  Number(uni.getStorageSync('active_school_id')) || Number(getUser()?.schoolId) || 1

const grades = ref<any[]>([])
const classes = ref<any[]>([])
const students = ref<any[]>([])
const subjects = ref<any[]>([])
const gradeIdx = ref(-1)
const classIdx = ref(-1)
const studentIdx = ref(-1)
const subjectIdx = ref(-1)
const report = ref<any>(null)
const weakItems = ref<any[]>([])

// 全班薄弱分布（班级维度）状态
const classDist = ref<any[]>([])
const classStudentCount = ref(0)
const expandedCd = ref<string | null>(null)

const gradeLabels = computed(() => grades.value.map((g) => g.name))
const classLabels = computed(() => classes.value.map((c) => c.name))
const studentLabels = computed(() => students.value.map((s) => s.name + '（' + s.studentNo + '）'))
const subjectLabels = computed(() => ['全部学科'].concat(subjects.value.map((s) => s.name)))

const overviewCards = computed(() => [
  { label: '综合评分', value: report.value?.averageScore ?? '-', icon: '分', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '班级排名', value: report.value?.classRank ? report.value.classRank + '/' + report.value.classSize : '-', icon: '名', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '累计课次', value: report.value?.totalLessons ?? 0, icon: '课', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
  { label: '最近情绪', value: emotionText(report.value?.emotions?.latest), icon: '情', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
])

const dimensionRows = computed(() => {
  const d = report.value?.dimensions || {}
  return [
    { key: 'attendance', label: '出勤', value: d.attendance ?? 0 },
    { key: 'discipline', label: '纪律', value: d.discipline ?? 0 },
    { key: 'participation', label: '参与', value: d.participation ?? 0 },
    { key: 'homework', label: '作业', value: d.homework ?? 0 },
  ]
})

const emotionRows = computed(() => {
  const dist = report.value?.emotions?.distribution || { positive: 0, neutral: 0, negative: 0 }
  const total = (dist.positive || 0) + (dist.neutral || 0) + (dist.negative || 0)
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  return [
    { key: 'positive', label: '积极', count: dist.positive || 0, percent: pct(dist.positive || 0), color: '#4a6b5a' },
    { key: 'neutral', label: '平稳', count: dist.neutral || 0, percent: pct(dist.neutral || 0), color: '#7a8a96' },
    { key: 'negative', label: '消极', count: dist.negative || 0, percent: pct(dist.negative || 0), color: '#b32323' },
  ]
})

const weakCols = [
  { key: 'knowledgePoint', title: '知识点', minWidth: '150px' },
  { key: 'wrongCount', title: '错题数', width: '80px' },
  { key: 'recentCount', title: '近30天', width: '80px' },
  { key: 'sharePercent', title: '占比', width: '150px' },
  { key: 'score', title: '薄弱分', width: '80px' },
  { key: 'latestAt', title: '最近错题', minWidth: '130px' },
]
const evalCols = [
  { key: 'createdAt', title: '时间', minWidth: '140px' },
  { key: 'score', title: '综合分', width: '80px' },
  { key: 'discipline', title: '纪律', width: '70px' },
  { key: 'participation', title: '参与度', width: '80px' },
  { key: 'emotion', title: '情绪', width: '90px' },
  { key: 'comment', title: '评语', minWidth: '180px' },
]

function dimColor(v: number) {
  if (v >= 90) return '#4a6b5a'
  if (v >= 70) return '#b8860b'
  return '#b32323'
}
function emotionText(e?: string | null) {
  if (!e) return '暂无'
  return ({ positive: '积极', neutral: '平稳', negative: '消极' } as any)[e] || e
}
function emotionTagClass(e?: string | null) {
  if (e === 'positive') return 'ok'
  if (e === 'negative') return 'err'
  return 'info'
}
function fmtTime(d?: string | null) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

// ===== 全班薄弱分布（班级维度）=====
/** 条形宽度：percentOfClass 为 0~100（可能带一位小数），夹取到 0~100 防溢出 */
function cdBarWidth(p: number) {
  const n = Number(p)
  if (!Number.isFinite(n)) return '0%'
  return Math.min(100, Math.max(0, n)) + '%'
}
/** 展开/收起某知识点的学生名单 */
function toggleCd(kp: string) {
  expandedCd.value = expandedCd.value === kp ? null : kp
}
/** 学生名单文案：students 为姓名数组（后端已截断到最多 20 个） */
function cdStudentsText(d: any) {
  const list = (d?.students || []).filter(Boolean)
  return list.length ? list.join('、') : '无'
}
/** 加载全班薄弱分布：classId 直接取自页面顶部的班级选择器（与 students 列表同源） */
async function loadClassDist() {
  classDist.value = []
  classStudentCount.value = 0
  expandedCd.value = null
  const cls = classIdx.value >= 0 ? classes.value[classIdx.value] : null
  if (!cls?.id) return
  try {
    const res: any = await http.get('/wrong-questions/class-distribution/' + cls.id, { topN: 5 })
    classDist.value = res?.distribution || []
    classStudentCount.value = res?.studentCount || 0
  } catch (er) {
    classDist.value = []
  }
}

async function loadBase() {
  try {
    grades.value = await http.get('/grades', { schoolId })
    subjects.value = await http.get('/subjects')
  } catch (e) {
    grades.value = []
    subjects.value = []
  }
}

async function pickGrade(e: any) {
  gradeIdx.value = Number(e.detail.value)
  classIdx.value = -1
  studentIdx.value = -1
  report.value = null
  // 切换年级后班级已失效，同步清空班级维度的分布数据
  classDist.value = []
  classStudentCount.value = 0
  expandedCd.value = null
  try {
    classes.value = await http.get('/classes', { gradeId: grades.value[gradeIdx.value].id })
  } catch (er) {
    classes.value = []
  }
}
async function pickClass(e: any) {
  classIdx.value = Number(e.detail.value)
  studentIdx.value = -1
  report.value = null
  // 切换班级后旧班的分布数据失效，立即清空
  classDist.value = []
  classStudentCount.value = 0
  expandedCd.value = null
  try {
    students.value = await http.get('/students', { classId: classes.value[classIdx.value].id })
  } catch (er) {
    students.value = []
  }
}
async function pickStudent(e: any) {
  studentIdx.value = Number(e.detail.value)
  await loadReport()
}
async function pickSubject(e: any) {
  subjectIdx.value = Number(e.detail.value) - 1
  if (report.value) await loadWeakness()
}

async function loadReport() {
  const id = students.value[studentIdx.value].id
  try {
    report.value = await http.get('/evaluations/student/' + id + '/report')
    // 个人薄弱画像与全班分布互不依赖，并行加载
    await Promise.all([loadWeakness(), loadClassDist()])
  } catch (er) {
    report.value = null
  }
}
async function loadWeakness() {
  const id = students.value[studentIdx.value].id
  try {
    const params: any = { topN: 10 }
    if (subjectIdx.value >= 0) params.subjectId = subjects.value[subjectIdx.value].id
    const w: any = await http.get('/wrong-questions/weaknesses/' + id, params)
    weakItems.value = w?.items || w?.list || (Array.isArray(w) ? w : [])
  } catch (er) {
    weakItems.value = []
  }
}

onShow(() => loadBase())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); margin-bottom: 16px; }
.filter-bar { display: flex; gap: 10px; flex-wrap: wrap; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 14px; font-size: 13px; color: #4a4a4a; min-width: 100px; }
.picker-box.small { min-width: 96px; text-align: center; }

.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 150px;
}
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 17px;
}
.stat-value { font-size: 20px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.two-col { display: flex; gap: 16px; flex-wrap: wrap; }
.two-col .panel { flex: 1; min-width: 300px; }
.panel-title { font-size: 15px; font-weight: 600; margin-bottom: 14px; }

.dim-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.dim-label { width: 40px; font-size: 13px; color: #4a4a4a; }
.dim-val { width: 30px; font-size: 13px; color: #6b7280; text-align: right; }

.emo-row { margin-bottom: 14px; }
.emo-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.emo-label { font-size: 13px; color: #4a4a4a; }
.emo-count { font-size: 15px; font-weight: 700; }
.emo-latest { font-size: 13px; color: #4a4a4a; margin-top: 14px; }

/* ===== 全班薄弱分布 ===== */
.cd-title-sub { font-size: 12px; font-weight: 400; color: #7a8a96; }
.cd-item { margin-bottom: 12px; }
.cd-row { cursor: pointer; }
.cd-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.cd-kp { font-size: 13px; color: #4a4a4a; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-meta { font-size: 12px; color: #b32323; white-space: nowrap; }
.cd-arrow { font-size: 12px; color: #7a8a96; transition: transform 0.2s; }
.cd-arrow.open { transform: rotate(180deg); }
.cd-bar-track { height: 8px; border-radius: 4px; background: rgba(43, 43, 43, 0.07); overflow: hidden; }
.cd-bar-fill { height: 100%; border-radius: 4px; background: #b32323; }
.cd-sub { font-size: 11px; color: #7a8a96; margin-top: 4px; }
.cd-students { font-size: 12px; color: #4a4a4a; line-height: 1.7; background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }

.empty { text-align: center; color: #999; font-size: 13px; padding: 18px; display: block; }
.note { font-size: 12px; color: #7a8a96; line-height: 1.6; margin-top: 12px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.info { background: #dbeafe; color: #2563a8; }
</style>
