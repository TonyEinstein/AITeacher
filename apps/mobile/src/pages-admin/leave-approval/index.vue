<template>
  <AdminLayout title="请假审批">
    <view class="panel">
      <view class="panel-title">待审批请假</view>
      <SimpleTable :columns="cols" :rows="list">
        <template #cell-student="{ row }">{{ row.student?.name || '#' + row.studentId }}</template>
        <template #cell-class="{ row }">{{ row.student?.class?.name || '-' }}</template>
        <template #cell-type="{ value }">
          <text class="tag" :class="value === 'sick' ? 'sick' : 'personal'">{{ typeText(value) }}</text>
        </template>
        <template #cell-reason="{ value }">{{ value }}</template>
        <template #cell-startDate="{ value }">{{ fmtDate(value) }}</template>
        <template #cell-op="{ row }">
          <text class="op ok" @click="review(row, true)">批准</text>
          <text class="op no" @click="review(row, false)">驳回</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无待审批请假</view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const schoolId = getUser()?.schoolId || 1
const reviewerId = getUser()?.id || 1
const list = ref<any[]>([])

const cols = [
  { key: 'student', title: '学生', minWidth: '110px' },
  { key: 'class', title: '班级', minWidth: '120px' },
  { key: 'type', title: '类型', width: '90px' },
  { key: 'reason', title: '事由', minWidth: '180px' },
  { key: 'startDate', title: '开始日期', width: '110px' },
  { key: 'op', title: '操作', width: '130px' },
]

function typeText(t: string) {
  return ({ personal: '事假', sick: '病假', other: '其他' } as any)[t] || t
}
function fmtDate(d: string) {
  if (!d) return ''
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')
}

async function load() {
  try {
    const res: any = await http.get('/leaves/pending/' + schoolId)
    list.value = res?.list || res || []
  } catch (e) {
    list.value = []
  }
}

function review(row: any, approved: boolean) {
  uni.showModal({
    title: approved ? '批准请假' : '驳回请假',
    content: '确认' + (approved ? '批准' : '驳回') + ' ' + (row.student?.name || '') + ' 的请假？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.post('/leaves/' + row.id + '/review', { approved, reviewerId })
        uni.showToast({ title: approved ? '已批准' : '已驳回', icon: 'success' })
        load()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
      }
    },
  })
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-title { font-size: 15px; font-weight: 600; margin-bottom: 14px; }
.op { font-size: 13px; margin-right: 14px; }
.op.ok { color: #0f8a5f; }
.op.no { color: #c0392b; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.sick { background: #fee2e2; color: #c0392b; }
.tag.personal { background: #dbeafe; color: #2563a8; }
</style>
