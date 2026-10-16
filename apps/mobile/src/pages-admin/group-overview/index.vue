<template>
  <AdminLayout title="跨校区汇总">
    <!-- 顶部筛选 -->
    <view class="panel filter">
      <text class="muted">选择集团：</text>
      <picker :range="schoolNames" :value="schoolIdx" @change="pickSchool">
        <view class="picker-box">{{ schoolIdx >= 0 && schoolNames.length ? schoolNames[schoolIdx] : '请选择' }}</view>
      </picker>
      <button class="mini-btn" @click="load">刷新</button>
    </view>

    <template v-if="data.school">
      <!-- 汇总卡片 -->
      <view class="cards">
        <view v-for="c in summaryCards" :key="c.label" class="stat">
          <view class="stat-icon" :style="{ background: c.color }">{{ c.mark }}</view>
          <view class="stat-body">
            <view class="stat-val">{{ c.value }}</view>
            <view class="stat-lab">{{ c.label }}</view>
          </view>
        </view>
      </view>

      <!-- 最佳 / 待提升 -->
      <view v-if="summary.bestCampus || summary.worstCampus" class="rank-row">
        <view class="rank-card best">
          <text class="rank-label">表现最佳校区</text>
          <text class="rank-name">{{ summary.bestCampus?.campusName || '-' }}</text>
          <text class="rank-score">{{ summary.bestCampus?.avgScore ?? '-' }} 分</text>
        </view>
        <view class="rank-card worst">
          <text class="rank-label">待提升校区</text>
          <text class="rank-name">{{ summary.worstCampus?.campusName || '-' }}</text>
          <text class="rank-score">{{ summary.worstCampus?.avgScore ?? '-' }} 分</text>
        </view>
      </view>

      <!-- 校区对比 -->
      <view class="panel">
        <view class="panel-head">
          <text class="panel-title">校区对比</text>
          <text class="muted">共 {{ data.campusCount }} 个校区</text>
        </view>
        <SimpleTable :columns="cols" :rows="data.campuses || []">
          <template #cell-avgScore="{ row }">
            <view v-if="row.avgScore === null || row.avgScore == null" class="muted">暂无</view>
            <view v-else class="score-cell">
              <view class="score-track">
                <view class="score-fill" :style="{ width: Math.min(100, Math.round(row.avgScore)) + '%', background: scoreColor(row.avgScore) }"></view>
              </view>
              <text class="score-num">{{ row.avgScore }}</text>
            </view>
          </template>
          <template #cell-avgEvaluation="{ value }">{{ value ?? '-' }}</template>
          <template #cell-attendanceRate="{ row }">
            <text v-if="row.attendanceRate === null || row.attendanceRate == null" class="muted">暂无</text>
            <text v-else>{{ row.attendanceRate }}%</text>
          </template>
        </SimpleTable>
        <view v-if="!(data.campuses || []).length" class="empty">该集团尚未创建校区</view>
      </view>

      <!-- 未纳入汇总 -->
      <view v-if="notImplText" class="note">尚未纳入汇总：{{ notImplText }}</view>
    </template>

    <view v-else class="empty">请选择要查看的集团</view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const schoolList = ref<any[]>([])
const schoolIdx = ref(-1)
// 学校归属：active_school_id 优先，其次登录用户自身 schoolId（集团管理员绑定校）
const currentSchoolId = ref<number>(
  Number(uni.getStorageSync('active_school_id')) || Number(getUser()?.schoolId) || 1,
)
const data = ref<any>({ campuses: [], summary: {}, notImplemented: [] })

const cols = [
  { key: 'campusName', title: '校区', minWidth: '120px' },
  { key: 'studentCount', title: '学生数', width: '80px' },
  { key: 'classCount', title: '班级数', width: '80px' },
  { key: 'gradeCount', title: '年级数', width: '80px' },
  { key: 'avgScore', title: '平均成绩', minWidth: '160px' },
  { key: 'avgEvaluation', title: '课堂评估', width: '90px' },
  { key: 'attendanceRate', title: '出勤率', width: '80px' },
  { key: 'completedLessons', title: '已完成课时', width: '100px' },
]

const schoolNames = computed(() => schoolList.value.map((s) => s.name))
const summary = computed(() => data.value.summary || {})
const notImplText = computed(() => (data.value.notImplemented || []).join('；'))

const summaryCards = computed(() => [
  { label: '校区数', value: summary.value.totalCampuses ?? 0, mark: '区', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '学生总数', value: summary.value.totalStudents ?? 0, mark: '生', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
  { label: '班级总数', value: summary.value.totalClasses ?? 0, mark: '班', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '年级总数', value: summary.value.totalGrades ?? 0, mark: '级', color: 'linear-gradient(135deg,#7a8a96,#5f6b74)' },
  { label: '完成课时', value: summary.value.totalCompletedLessons ?? 0, mark: '课', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '集团均分', value: summary.value.avgScore ?? '-', mark: '均', color: 'linear-gradient(135deg,#b32323,#8b1a1a)' },
])

function scoreColor(v: number) {
  if (v >= 90) return '#4a6b5a'
  if (v >= 75) return '#b8860b'
  return '#b32323'
}

async function loadSchools() {
  try {
    const res: any = await http.get('/schools', { pageSize: 200 })
    schoolList.value = res?.list || (Array.isArray(res) ? res : [])
    const idx = schoolList.value.findIndex((s) => s.id === currentSchoolId.value)
    schoolIdx.value = idx >= 0 ? idx : (schoolList.value.length ? 0 : -1)
    if (idx < 0 && schoolList.value.length) currentSchoolId.value = schoolList.value[0].id
  } catch (e) {
    schoolList.value = []
  }
}

function pickSchool(e: any) {
  schoolIdx.value = Number(e.detail.value)
  const s = schoolList.value[schoolIdx.value]
  if (s) {
    currentSchoolId.value = s.id
    load()
  }
}

async function load() {
  try {
    data.value = await http.get('/campuses/group-overview', { schoolId: currentSchoolId.value })
  } catch (e) {
    data.value = { campuses: [], summary: {}, notImplemented: [] }
  }
}

onShow(async () => {
  await loadSchools()
  await load()
})
</script>

<style>
.filter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.muted { color: #7a8a96; font-size: 13px; }
.picker-box {
  background: #fafbfc;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 14px;
  color: #4a4a4a;
  min-width: 200px;
}
.mini-btn {
  background: #1e3a5f;
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  margin: 0;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  flex: 1;
  min-width: 130px;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px;
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 17px; font-weight: 700;
}
.stat-val { font-size: 20px; font-weight: 700; color: #2b2b2b; }
.stat-lab { font-size: 12px; color: #999; margin-top: 2px; }

.rank-row {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.rank-card {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 14px 18px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.rank-card.best { border-left: 3px solid #4a6b5a; }
.rank-card.worst { border-left: 3px solid #b8860b; }
.rank-label { font-size: 12px; color: #7a8a96; }
.rank-name { font-size: 15px; font-weight: 700; color: #2b2b2b; flex: 1; }
.rank-score { font-size: 16px; font-weight: 700; color: #8b2e2e; }

.panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; }

.score-cell { display: flex; align-items: center; gap: 8px; min-width: 140px; }
.score-track { flex: 1; height: 8px; background: #eef0f2; border-radius: 4px; overflow: hidden; min-width: 70px; }
.score-fill { height: 100%; border-radius: 4px; }
.score-num { font-size: 13px; font-weight: 600; color: #2b2b2b; width: 38px; text-align: right; }

.empty { text-align: center; color: #999; font-size: 13px; padding: 20px; }
.note {
  background: #fef9e7;
  border: 1px solid #f5e6a8;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #8a6d1a;
}
</style>
