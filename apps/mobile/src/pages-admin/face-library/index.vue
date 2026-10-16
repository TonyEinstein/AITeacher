<template>
  <AdminLayout title="人脸库管理">
    <!-- 统计卡片 -->
    <view class="stat-row">
      <view v-for="c in cards" :key="c.label" class="stat-card">
        <view class="stat-value" :style="{ color: c.color }">{{ stats[c.key] || 0 }}</view>
        <view class="stat-label">{{ c.label }}</view>
      </view>
    </view>

    <view class="panel">
      <view class="toolbar">
        <view class="id-input">
          <text class="f-label" style="margin:0 8px 0 0">学生ID</text>
          <input class="num-input" type="number" v-model="uploadStudentId" placeholder="如：1" />
        </view>
        <button class="mini-btn" @click="chooseAndUpload">上传人脸照片</button>
        <button class="mini-btn ghost" @click="doSync">下发到盒子</button>
      </view>

      <SimpleTable :columns="cols" :rows="photos">
        <template #cell-idx="{ row }">{{ row.id }}</template>
        <template #cell-student="{ row }">{{ row.student?.name || '#' + row.studentId }}</template>
        <template #cell-photo="{ row }">
          <image v-if="row.photoUrl" :src="fullUrl(row.photoUrl)" class="face-img" mode="aspectFill" />
          <text v-else class="muted">无</text>
        </template>
        <template #cell-photoUrl="{ value }"><text class="path">{{ value }}</text></template>
        <template #cell-status="{ value }">
          <text class="tag" :class="statusClass(value)">{{ statusText(value) }}</text>
        </template>
        <template #cell-createdAt="{ value }">{{ fmtTime(value) }}</template>
      </SimpleTable>
      <view v-if="!photos.length" class="empty">暂无人脸照片</view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { uploadFile } from '@/utils/upload'
import { ENV } from '@/config/env'

const schoolId = 1
const photos = ref<any[]>([])
const stats = reactive<any>({})
const uploadStudentId = ref('')

const cards = [
  { key: 'total', label: '照片总数', color: '#8b2e2e' },
  { key: 'pending', label: '待提取特征', color: '#b8860b' },
  { key: 'processed', label: '已提取特征', color: '#4a6b5a' },
  { key: 'synced', label: '已下发盒子', color: '#2e7d5a' },
]

const cols = [
  { key: 'idx', title: '#', width: '50px' },
  { key: 'student', title: '学生', minWidth: '110px' },
  { key: 'photo', title: '照片', width: '80px' },
  { key: 'photoUrl', title: '文件路径', minWidth: '170px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'createdAt', title: '上传时间', minWidth: '150px' },
]

function statusText(s: string) {
  return ({ pending: '待处理', processed: '已提取', synced: '已下发', failed: '失败' } as any)[s] || s
}
function statusClass(s: string) {
  return ({ pending: 'warn', processed: 'ok', synced: 'info', failed: 'err' } as any)[s] || 'info'
}
function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}
function fullUrl(p: string) {
  if (!p) return ''
  if (p.startsWith('http')) return p
  return ENV.apiBase.replace('/api/v1', '') + '/' + p.replace(/^\//, '')
}

async function loadData() {
  try {
    const data: any = await http.get('/face-library/school/' + schoolId)
    const d = data?.data || data || {}
    stats.total = d.stats?.total || 0
    stats.pending = d.stats?.pending || 0
    stats.processed = d.stats?.processed || 0
    stats.synced = d.stats?.synced || 0
    photos.value = d.photos || []
  } catch (e) {
    photos.value = []
  }
}

function chooseAndUpload() {
  if (!uploadStudentId.value) {
    uni.showToast({ title: '请先填写学生ID', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: 1,
    success: (res) => {
      const filePath = res.tempFilePaths[0]
      uni.showLoading({ title: '上传中' })
      uploadFile({
        url: '/face-library/upload',
        filePath,
        formData: { studentId: uploadStudentId.value },
      })
        .then(() => {
          uni.hideLoading()
          uni.showToast({ title: '上传成功', icon: 'success' })
          loadData()
        })
        .catch((e: any) => {
          uni.hideLoading()
          uni.showToast({ title: e?.message || '上传失败', icon: 'none' })
        })
    },
  })
}

async function doSync() {
  try {
    const res: any = await http.post('/face-library/sync')
    uni.showToast({ title: '已下发 ' + (res?.synced ?? 0) + ' 张', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '需在设备侧触发', icon: 'none' })
  }
}

onShow(() => loadData())
</script>

<style>
.stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.stat-card {
  background: #fff; border-radius: 12px; padding: 16px; text-align: center;
  border: 1px solid rgba(43, 43, 43, 0.06); flex: 1; min-width: 130px;
}
.stat-value { font-size: 26px; font-weight: 700; }
.stat-label { font-size: 12px; color: #7a8a96; margin-top: 4px; }

.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.id-input { display: flex; align-items: center; }
.num-input { width: 90px; background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.mini-btn.ghost { background: #f0f0f0; color: #4a4a4a; }
.face-img { width: 44px; height: 44px; border-radius: 6px; }
.path { font-size: 12px; color: #6b7280; }
.muted { color: #aaa; font-size: 13px; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.warn { background: #fef3c7; color: #b8860b; }
.tag.info { background: #dbeafe; color: #2563a8; }
</style>
