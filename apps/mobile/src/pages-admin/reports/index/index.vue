<template>
  <AdminLayout :title="isSuperAdmin ? '全局报表' : '校级报表'">
    <!-- ===== 超级管理员：全局报表 ===== -->
    <template v-if="isSuperAdmin">
      <view class="stat-row">
        <view v-for="c in globalCards" :key="c.label" class="stat-card">
          <view class="stat-icon" :style="{ background: c.color }">{{ c.icon }}</view>
          <view class="stat-info">
            <view class="stat-value">{{ c.value }}</view>
            <view class="stat-label">{{ c.label }}</view>
          </view>
        </view>
      </view>

      <view class="row">
        <view class="col-main panel">
          <view class="panel-title">学校规模排名</view>
          <SimpleTable :columns="rankCols" :rows="globalData.schoolRanking || []">
            <template #cell-rank="{ row }">{{ (globalData.schoolRanking || []).indexOf(row) + 1 }}</template>
            <template #cell-name="{ value }">{{ value }}</template>
            <template #cell-code="{ value }">{{ value }}</template>
            <template #cell-status="{ value }">
              <text class="tag" :class="value === 'active' ? 'ok' : value === 'trial' ? 'warn' : 'info'">{{ statusText(value) }}</text>
            </template>
            <template #cell-gradeCount="{ value }">{{ value }}</template>
            <template #cell-classCount="{ value }">{{ value }}</template>
            <template #cell-studentCount="{ value }">{{ value }}</template>
            <template #cell-subscriptionEnd="{ row }">{{ fmtDate(row.subscriptionEnd) }}</template>
          </SimpleTable>
        </view>

        <view class="col-side">
          <view class="panel" style="margin-bottom:16px">
            <view class="panel-title">即将到期订阅（30天内）</view>
            <SimpleTable :columns="expCols" :rows="globalData.expiringSubscriptions || []">
              <template #cell-schoolName="{ value }">{{ value }}</template>
              <template #cell-plan="{ value }">{{ value }}</template>
              <template #cell-endDate="{ value }">{{ fmtDate(value) }}</template>
            </SimpleTable>
            <view v-if="!(globalData.expiringSubscriptions || []).length" class="empty">暂无即将到期的订阅</view>
          </view>

          <view class="panel">
            <view class="panel-title">平台概览</view>
            <view class="overview-grid">
              <view v-for="o in overviewItems" :key="o.label" class="overview-item">
                <text class="ov-label">{{ o.label }}</text>
                <text class="ov-value">{{ o.value }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <!-- ===== 校级报表 ===== -->
    <template v-else>
      <view class="stat-row">
        <view v-for="c in cards" :key="c.label" class="plain-card">
          <view class="pc-value">{{ c.value }}{{ c.suffix || '' }}</view>
          <view class="pc-label">{{ c.label }}</view>
        </view>
      </view>

      <view class="row">
        <view class="col-main panel">
          <view class="panel-title">各年级学生分布</view>
          <SimpleTable :columns="gradeCols" :rows="overview.gradeDistribution || []">
            <template #cell-name="{ value }">{{ value }}</template>
            <template #cell-classCount="{ value }">{{ value }}</template>
            <template #cell-studentCount="{ value }">{{ value }}</template>
          </SimpleTable>
        </view>
        <view class="col-side panel">
          <view class="panel-title">学生预警</view>
          <SimpleTable :columns="warnCols" :rows="warnings.list || []">
            <template #cell-studentName="{ value }">{{ value }}</template>
            <template #cell-className="{ value }">{{ value }}</template>
            <template #cell-alerts="{ row }">
              <text v-for="a in row.alerts" :key="a" class="tag err" style="margin-right:4px">{{ a }}</text>
            </template>
          </SimpleTable>
          <view v-if="!(warnings.list || []).length" class="empty">暂无预警学生</view>
        </view>
      </view>
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const user = getUser()
const isSuperAdmin = computed(() => user?.role === 'super_admin')
const schoolId = Number(uni.getStorageSync('active_school_id')) || user?.schoolId || 1

const globalData = ref<any>({})
const overview = ref<any>({})
const warnings = ref<any>({ list: [] })

const globalCards = computed(() => [
  { label: '合作学校', value: globalData.value.totalSchools || 0, icon: '校', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '学生总数', value: globalData.value.totalStudents || 0, icon: '生', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '设备在线率', value: (globalData.value.deviceOnlineRate || 0) + '%', icon: '机', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '咨询留资', value: globalData.value.totalLeads || 0, icon: '资', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
  { label: '正式订阅', value: globalData.value.activeSchools || 0, icon: '订', color: 'linear-gradient(135deg,#2e7d5a,#226048)' },
  { label: '即将到期', value: globalData.value.expiringSubscriptions?.length || 0, icon: '期', color: 'linear-gradient(135deg,#8b4513,#6e3710)' },
])

const cards = computed(() => [
  { label: '学生总数', value: overview.value.students || 0 },
  { label: '班级总数', value: overview.value.classes || 0 },
  { label: '今日课程', value: overview.value.todayLessons || 0 },
  { label: '设备在线率', value: overview.value.devices?.total ? Math.round((overview.value.devices.online / overview.value.devices.total) * 100) : 0, suffix: '%' },
])

const overviewItems = computed(() => [
  { label: '合作学校', value: globalData.value.totalSchools || 0 },
  { label: '正式订阅', value: globalData.value.activeSchools || 0 },
  { label: '试用中', value: globalData.value.trialSchools || 0 },
  { label: '已停用', value: globalData.value.disabledSchools || 0 },
  { label: '学生总数', value: globalData.value.totalStudents || 0 },
  { label: '班级总数', value: globalData.value.totalClasses || 0 },
  { label: '设备总数', value: globalData.value.totalDevices || 0 },
  { label: '设备在线率', value: (globalData.value.deviceOnlineRate || 0) + '%' },
  { label: '咨询留资', value: globalData.value.totalLeads || 0 },
  { label: '活跃订阅', value: globalData.value.activeSubscriptions || 0 },
])

const rankCols = [
  { key: 'rank', title: '排名', width: '60px' },
  { key: 'name', title: '学校名称', minWidth: '160px' },
  { key: 'code', title: '编码', width: '100px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'gradeCount', title: '年级', width: '60px' },
  { key: 'classCount', title: '班级', width: '60px' },
  { key: 'studentCount', title: '学生数', width: '80px' },
  { key: 'subscriptionEnd', title: '订阅到期', minWidth: '110px' },
]
const expCols = [
  { key: 'schoolName', title: '学校', minWidth: '130px' },
  { key: 'plan', title: '套餐', width: '80px' },
  { key: 'endDate', title: '到期日', minWidth: '110px' },
]
const gradeCols = [
  { key: 'name', title: '年级', minWidth: '120px' },
  { key: 'classCount', title: '班级数', width: '100px' },
  { key: 'studentCount', title: '学生数', width: '100px' },
]
const warnCols = [
  { key: 'studentName', title: '学生', width: '100px' },
  { key: 'className', title: '班级', width: '100px' },
  { key: 'alerts', title: '预警', minWidth: '140px' },
]

function statusText(s: string) {
  return ({ active: '服务中', trial: '试用中', disabled: '已停用' } as any)[s] || s
}
function fmtDate(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0')
}

async function load() {
  try {
    if (isSuperAdmin.value) {
      globalData.value = await http.get('/dashboard/global')
    } else {
      overview.value = await http.get('/dashboard/school/' + schoolId)
      warnings.value = await http.get('/evaluations/warnings', { schoolId })
    }
  } catch (e) {}
}

onShow(() => load())
</script>

<style>
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 12px; padding: 14px 16px;
  border: 1px solid rgba(43, 43, 43, 0.06);
  flex: 1; min-width: 180px;
}
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px; flex-shrink: 0;
}
.stat-value { font-size: 22px; font-weight: 700; color: #2b2b2b; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 2px; }

.plain-card {
  background: #fff; border-radius: 12px; padding: 18px;
  border: 1px solid rgba(43, 43, 43, 0.06);
  flex: 1; min-width: 160px; text-align: center;
}
.pc-value { font-size: 26px; font-weight: 700; color: #1e3a5f; }
.pc-label { font-size: 13px; color: #7a8a96; margin-top: 4px; }

.row { display: flex; gap: 16px; flex-wrap: wrap; }
.col-main { flex: 2; min-width: 420px; }
.col-side { flex: 1; min-width: 300px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; margin-bottom: 12px; }

.overview-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.overview-item {
  width: calc(50% - 5px); box-sizing: border-box;
  padding: 10px 12px; background: #f8f9fb; border-radius: 8px;
}
.ov-label { font-size: 12px; color: #7a8a96; display: block; }
.ov-value { font-size: 18px; font-weight: 700; color: #2b2b2b; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.warn { background: #fef3c7; color: #b07d0b; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.info { background: #dbeafe; color: #2563a8; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 20px; }
</style>
