<template>
  <AdminLayout title="管理概览">
    <!-- 超管全局 -->
    <view v-if="isSuper">
      <view class="cards">
        <view v-for="c in globalCards" :key="c.label" class="stat">
          <view class="stat-icon" :style="{ background: c.color }">{{ c.mark }}</view>
          <view class="stat-body">
            <view class="stat-val">{{ c.value }}</view>
            <view class="stat-lab">{{ c.label }}</view>
          </view>
        </view>
      </view>

      <view class="panel">
        <view class="panel-title">学校规模排名</view>
        <SimpleTable :columns="rankCols" :rows="data.schoolRanking || []">
          <template #cell-status="{ value }">
            <text class="tag" :class="value">{{ statusText(value) }}</text>
          </template>
        </SimpleTable>
        <view v-if="!(data.schoolRanking || []).length" class="empty">暂无数据</view>
      </view>

      <view class="panel">
        <view class="panel-title">设备状态</view>
        <view class="dev-grid">
          <view class="dev"><text>设备总数</text><text class="tag">{{ data.totalDevices || 0 }}</text></view>
          <view class="dev"><text>在线设备</text><text class="tag ok">{{ data.onlineDevices || 0 }}</text></view>
          <view class="dev"><text>在线率</text><text class="tag warn">{{ data.deviceOnlineRate || 0 }}%</text></view>
          <view class="dev"><text>咨询留资</text><text class="tag">{{ data.totalLeads || 0 }}</text></view>
        </view>
      </view>

      <view class="panel">
        <view class="panel-title">LLM 用量（近7天，总 {{ usage.totalTokens || 0 }} tokens）</view>
        <ChartBar :categories="usageCategories" :series="usageSeries" :height="220" unit="tokens" />
      </view>
    </view>

    <!-- 学校级 -->
    <view v-else>
      <view class="cards">
        <view v-for="c in schoolCards" :key="c.label" class="stat">
          <view class="stat-icon" :style="{ background: c.color }">{{ c.mark }}</view>
          <view class="stat-body">
            <view class="stat-val">{{ c.value }}</view>
            <view class="stat-lab">{{ c.label }}</view>
          </view>
        </view>
      </view>

      <view class="panel">
        <view class="panel-title">设备与教学状态</view>
        <view class="dev-grid">
          <view class="dev"><text>在线设备</text><text class="tag ok">{{ overview.devices?.online || 0 }}</text></view>
          <view class="dev"><text>设备总数</text><text class="tag">{{ overview.devices?.total || 0 }}</text></view>
          <view class="dev"><text>正在上课</text><text class="tag warn">{{ overview.ongoingLessons || 0 }}</text></view>
          <view class="dev"><text>待复核作业</text><text class="tag err">{{ overview.pendingReview || 0 }}</text></view>
        </view>
      </view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ChartBar from '@/components/chart/ChartBar.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const user = ref<any>(getUser())
const isSuper = computed(() => user.value.role === 'super_admin')

const data = ref<any>({})
const overview = ref<any>({})
const usage = ref<any>({ daily: [], totalTokens: 0 })

const globalCards = computed(() => [
  { label: '合作学校', value: data.value.totalSchools || 0, mark: '校', color: 'linear-gradient(135deg,#8b2e2e,#6e2222)' },
  { label: '学生总数', value: data.value.totalStudents || 0, mark: '生', color: 'linear-gradient(135deg,#4a6b5a,#3a5548)' },
  { label: '班级总数', value: data.value.totalClasses || 0, mark: '班', color: 'linear-gradient(135deg,#5a7a9a,#456080)' },
  { label: '设备在线率', value: (data.value.deviceOnlineRate || 0) + '%', mark: '设', color: 'linear-gradient(135deg,#b8860b,#9a7209)' },
  { label: '咨询留资', value: data.value.totalLeads || 0, mark: '询', color: 'linear-gradient(135deg,#8b4513,#6e3710)' },
  { label: '正式订阅', value: data.value.activeSchools || 0, mark: '订', color: 'linear-gradient(135deg,#2e7d5a,#226048)' },
])

const schoolCards = computed(() => [
  { label: '在校学生', value: overview.value.students || 0, mark: '生', color: '#409eff' },
  { label: '教学班级', value: overview.value.classes || 0, mark: '班', color: '#67c23a' },
  { label: '今日课程', value: overview.value.todayLessons || 0, mark: '课', color: '#e6a23c' },
  { label: '接入设备', value: overview.value.devices?.total || 0, mark: '设', color: '#f56c6c' },
])

const rankCols = [
  { key: 'name', title: '学校名称', minWidth: '160px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'gradeCount', title: '年级', width: '70px' },
  { key: 'classCount', title: '班级', width: '70px' },
  { key: 'studentCount', title: '学生数', width: '80px' },
]

function statusText(s: string) {
  return ({ active: '服务中', trial: '试用中', disabled: '已停用' } as any)[s] || s
}

const last7 = computed(() => (usage.value.daily || []).slice(-7))
/** X 轴：MM-DD（去掉年份，避免标签过密） */
const usageCategories = computed(() => last7.value.map((d: any) => String(d.date || '').slice(5)))
/** 单序列：每日 token 用量（真实值，由图表自行定轴） */
const usageSeries = computed(() => [
  { name: 'tokens', data: last7.value.map((d: any) => Number(d.tokens) || 0) },
])

onShow(async () => {
  try {
    if (isSuper.value) {
      data.value = await http.get('/dashboard/global')
      const u = await http.get('/dashboard/usage', { days: 30 })
      usage.value = u || { daily: [], totalTokens: 0 }
    } else {
      const sid = user.value.schoolId || 1
      overview.value = await http.get('/dashboard/school/' + sid)
    }
  } catch (e) {
    // 接口未就绪用空数据
  }
})
</script>

<style>
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 18px;
}

.stat {
  flex: 1;
  min-width: 150px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}

.stat-val {
  font-size: 24px;
  font-weight: 700;
  color: #2b2b2b;
}

.stat-lab {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.panel {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #2b2b2b;
  margin-bottom: 14px;
}

.empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 16px;
}

.dev-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dev {
  flex: 1;
  min-width: 130px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafbfc;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  color: #4a4a4a;
}

.tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 6px;
  background: #eef0f2;
  color: #555;
}

.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.warn { background: #fef3c7; color: #b07d0b; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.active { background: #d1fae5; color: #0f8a5f; }
.tag.trial { background: #fef3c7; color: #b07d0b; }
.tag.disabled { background: #eef0f2; color: #777; }
</style>
