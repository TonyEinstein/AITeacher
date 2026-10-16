<template>
  <AdminLayout title="教师工作量">
    <!-- 统计窗口切换：近 7 / 30 / 90 天 -->
    <view class="panel">
      <view class="panel-title">统计窗口</view>
      <view class="seg">
        <view
          v-for="d in dayOptions"
          :key="d"
          class="seg-item"
          :class="{ on: days === d }"
          @click="switchDays(d)"
        >
          近 {{ d }} 天
        </view>
      </view>
    </view>

    <!-- 管理角色但缺少学校上下文（如超管未进入具体学校）：页内直接选学校，选中即查看 -->
    <view v-if="needSchoolHint" class="panel">
      <text class="empty">当前账号未关联学校，选择一所学校后查看：</text>
      <picker
        mode="selector"
        :range="schoolNames"
        :value="schoolIdx"
        @change="onPickSchool"
      >
        <view class="school-pick">{{ schoolIdx >= 0 ? schoolNames[schoolIdx] : '点击选择学校' }}</view>
      </picker>
    </view>

    <!-- 加载中 -->
    <view v-else-if="loading" class="panel">
      <text class="empty">加载中...</text>
    </view>

    <!-- 单校总览：作业复核 / 请假审批 两组统计卡 -->
    <template v-else-if="isSchoolMode && overview">
      <view class="panel">
        <view class="panel-title">作业复核</view>
        <view class="stat-row">
          <view v-for="c in homeworkCards" :key="c.label" class="stat-card">
            <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
            <view class="stat-info">
              <view class="stat-value" :class="{ warn: c.warn }">{{ c.value }}</view>
              <view class="stat-label">{{ c.label }}</view>
            </view>
          </view>
        </view>
      </view>

      <view class="panel">
        <view class="panel-title">请假审批</view>
        <view class="stat-row">
          <view v-for="c in leaveCards" :key="c.label" class="stat-card">
            <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
            <view class="stat-info">
              <view class="stat-value" :class="{ warn: c.warn }">{{ c.value }}</view>
              <view class="stat-label">{{ c.label }}</view>
            </view>
          </view>
        </view>
      </view>

      <view class="panel">
        <view class="note">
          口径：统计窗口为近 {{ overview.windowDays }} 天；「平均时长」为提交到完成复核 / 审批的平均间隔小时数，「暂无」表示窗口内无已完成记录。
        </view>
      </view>
    </template>

    <!-- 教师 / 学科管理员：仅本人请假审批工作量（后端对单校总览限制管理角色） -->
    <template v-else-if="!isSchoolMode && mine">
      <view class="panel">
        <view class="panel-title">我的请假审批</view>
        <view class="stat-row">
          <view v-for="c in myCards" :key="c.label" class="stat-card">
            <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
            <view class="stat-info">
              <view class="stat-value">{{ c.value }}</view>
              <view class="stat-label">{{ c.label }}</view>
            </view>
          </view>
        </view>
        <view class="note">说明：教师账号仅统计本人请假审批工作量；统计窗口为近 {{ mine.windowDays }} 天。</view>
      </view>
    </template>

    <!-- 无数据 / 加载失败兜底 -->
    <view v-else class="panel">
      <text class="empty">暂无数据</text>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'
import { onAdminRefresh } from '@/utils/admin-events'

// schoolId 取法与 devices / assignments 等管理页一致：
// 优先超管「进入学校」的上下文（active_school_id），其次登录用户归属学校；
// 都没有（如超管未进学校）时保持 0，由页内学校选择器补齐（见 needSchoolHint）
const user = getUser()
const schoolId = ref(Number(uni.getStorageSync('active_school_id')) || Number(user?.schoolId) || 0)

// 可查看单校总览的角色（与后端 GET /teachers/workload 的 @Roles 白名单一致）
const SCHOOL_ROLES = ['super_admin', 'group_admin', 'school_admin', 'grade_admin']
const canViewSchool = SCHOOL_ROLES.includes(user?.role)
// 管理角色 + 有学校上下文 → 单校总览；教师 / 学科管理员 → 个人接口
const isSchoolMode = computed(() => canViewSchool && !!schoolId.value)
// 管理角色但拿不到学校上下文（如超管未进入具体学校）时给页内选择器
const needSchoolHint = computed(() => canViewSchool && !schoolId.value)

// 页内学校选择器（needSchoolHint 时展示）：拉全部学校供选择
const schoolNames = ref<string[]>([])
const schoolList = ref<any[]>([])
const schoolIdx = ref(-1)

async function loadSchools() {
  try {
    const res = await http.get<any>('/schools', { page: 1, pageSize: 100 })
    schoolList.value = res?.list || res || []
    schoolNames.value = schoolList.value.map((s: any) => s.name)
  } catch {
    schoolList.value = []
    schoolNames.value = []
  }
}

/** 选中学校：写入 active_school_id（与其他页「进入学校」语义一致）并立即加载 */
function onPickSchool(e: any) {
  const idx = Number(e?.detail?.value)
  const school = schoolList.value[idx]
  if (!school) return
  schoolIdx.value = idx
  schoolId.value = school.id
  uni.setStorageSync('active_school_id', school.id)
  load()
}

const dayOptions = [7, 30, 90]
const days = ref(30)
const loading = ref(false)
// 单校总览数据：{ schoolId, windowDays, homework: { reviewedCount, pendingReviewCount, avgReviewHours }, leave: { reviewedCount, pendingCount, avgApprovalHours } }
const overview = ref<any>(null)
// 个人数据：{ userId, windowDays, leaveReviewedCount, avgApprovalHours }
const mine = ref<any>(null)

/** 统计卡结构 */
interface StatCard {
  label: string
  value: any
  icon: string
  color: string
  warn?: boolean
}

/** 平均时长（小时）格式化：null = 窗口内无已完成记录，显示「暂无」；数值保留 1 位小数 */
function fmtHours(h: number | null | undefined) {
  if (h === null || h === undefined) return '暂无'
  return String(Math.round(h * 10) / 10)
}

const homeworkCards = computed<StatCard[]>(() => {
  const h = overview.value?.homework || {}
  return [
    { label: '已复核（份）', value: h.reviewedCount ?? 0, icon: '核', color: 'linear-gradient(135deg,#2c5680,#1e3a5f)' },
    { label: '待复核（份）', value: h.pendingReviewCount ?? 0, warn: (h.pendingReviewCount ?? 0) > 0, icon: '待', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
    { label: '平均复核时长（小时）', value: fmtHours(h.avgReviewHours), icon: '时', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
  ]
})

const leaveCards = computed<StatCard[]>(() => {
  const l = overview.value?.leave || {}
  return [
    { label: '已审批（单）', value: l.reviewedCount ?? 0, icon: '审', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
    { label: '待审批（单）', value: l.pendingCount ?? 0, warn: (l.pendingCount ?? 0) > 0, icon: '待', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
    { label: '平均审批时长（小时）', value: fmtHours(l.avgApprovalHours), icon: '时', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  ]
})

const myCards = computed<StatCard[]>(() => [
  { label: '已审批（单）', value: mine.value?.leaveReviewedCount ?? 0, icon: '审', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '平均审批时长（小时）', value: fmtHours(mine.value?.avgApprovalHours), icon: '时', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
])

async function load() {
  if (needSchoolHint.value) return
  loading.value = true
  try {
    if (isSchoolMode.value) {
      overview.value = await http.get('/teachers/workload', { schoolId: schoolId.value, days: days.value })
    } else {
      mine.value = await http.get('/teachers/workload/me', { days: days.value })
    }
  } catch (e) {
    // 请求层已 toast 错误；这里只清空数据，让页面落到「暂无数据」兜底
    overview.value = null
    mine.value = null
  } finally {
    loading.value = false
  }
}

/** 切换统计窗口后重新拉取 */
function switchDays(d: number) {
  if (days.value === d) return
  days.value = d
  load()
}

onShow(() => {
  load()
  // 学校上下文缺失时才需要选择器列表
  if (needSchoolHint.value && !schoolList.value.length) loadSchools()
})
// 点侧栏当前菜单 = 刷新当前页（hash 路由不触发 onShow 的补位）
onAdminRefresh(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); margin-bottom: 16px; }
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; margin-bottom: 14px; }

/* 时间窗口 segmented 按钮组（与设备管理页一致） */
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; }
.seg-item { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; color: #6b7280; border-radius: 6px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }

/* 页内学校选择器（超管未进入学校时） */
.school-pick {
  margin-top: 12px; padding: 10px 14px; border: 1px solid #dcdfe6;
  border-radius: 8px; font-size: 14px; color: #1e3a5f; background: #fafbfc;
}

/* 统计卡（与学生学情报告页一致） */
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; }
.stat-card {
  display: flex; align-items: center; gap: 12px; background: #fafbfc;
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 150px;
}
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 17px; flex-shrink: 0;
}
.stat-info { min-width: 0; }
.stat-value { font-size: 20px; font-weight: 700; color: #2b2b2b; }
.stat-value.warn { color: #c0392b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; display: block; }
.note { font-size: 12px; color: #7a8a96; line-height: 1.6; }
</style>
