<template>
  <AdminLayout title="作业复核">
    <view class="panel">
      <view class="info-bar">以下为 AI 初评完成、需要老师复核的主观题作业</view>

      <SimpleTable :columns="cols" :rows="pendingList">
        <template #cell-student="{ row }">{{ row.student?.name || '-' }}</template>
        <template #cell-assignment="{ row }">{{ row.assignment?.title || '-' }}</template>
        <template #cell-score="{ value }">
          <text class="score">{{ value ?? '-' }}</text>
        </template>
        <template #cell-submittedAt="{ value }">{{ fmtTime(value) }}</template>
        <template #cell-op="{ row }">
          <text class="op" @click="openReview(row)">复核</text>
        </template>
      </SimpleTable>
      <view v-if="!pendingList.length" class="empty">暂无待复核作业</view>
    </view>

    <!-- 复核弹窗 -->
    <uni-popup ref="reviewPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">作业复核</view>
        <view class="dialog-body" v-if="current">
          <view class="kv"><text class="k">学生</text><text class="v">{{ current.student?.name }}</text></view>
          <view class="kv"><text class="k">作业</text><text class="v">{{ current.assignment?.title }}</text></view>
          <view class="kv"><text class="k">AI评分</text><text class="v">{{ current.score }}</text></view>
          <text class="f-label">最终分数</text>
          <Stepper v-model="reviewScore" :min="0" :max="100" :step="1" />
          <text class="f-label">评语</text>
          <uni-easyinput v-model="reviewComment" type="textarea" :maxlength="300" placeholder="请输入评语" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="reviewPopup.close()">取消</button>
          <button class="d-btn ok" @click="submitReview">确认通过</button>
        </view>
      </view>
    </uni-popup>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import Stepper from '@/components/admin/Stepper.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const schoolId = Number(uni.getStorageSync('active_school_id')) || getUser()?.schoolId || 1

const pendingList = ref<any[]>([])
const reviewPopup = ref<any>(null)
const current = ref<any>(null)
const reviewScore = ref(0)
const reviewComment = ref('')

const cols = [
  { key: 'student', title: '学生', minWidth: '120px' },
  { key: 'assignment', title: '作业', minWidth: '200px' },
  { key: 'score', title: 'AI评分', width: '100px' },
  { key: 'submittedAt', title: '提交时间', minWidth: '160px' },
  { key: 'op', title: '操作', width: '100px' },
]

function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

async function load() {
  try {
    const res: any = await http.get('/assignments/review/pending', { schoolId })
    pendingList.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    pendingList.value = []
  }
}

function openReview(row: any) {
  current.value = row
  reviewScore.value = row.score ?? 0
  reviewComment.value = ''
  reviewPopup.value.open()
}

async function submitReview() {
  if (!current.value) return
  try {
    await http.post('/assignments/submission/' + current.value.id + '/review', {
      score: reviewScore.value,
      comment: reviewComment.value,
    })
    uni.showToast({ title: '复核完成', icon: 'success' })
    reviewPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '复核失败', icon: 'none' })
  }
}

onShow(() => load())
</script>

<style>
.panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.info-bar {
  background: #eef5ff;
  color: #3a6ea5;
  font-size: 13px;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
}
.score { font-weight: 600; color: #1e3a5f; }
.op { font-size: 13px; color: #1e3a5f; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 24px; }

.dialog { width: 520px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.kv { display: flex; margin-bottom: 10px; font-size: 14px; }
.kv .k { width: 70px; color: #6b7280; }
.kv .v { color: #2b2b2b; flex: 1; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 14px 0 8px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
