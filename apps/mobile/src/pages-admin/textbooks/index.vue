<template>
  <AdminLayout title="教材教案">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">教材与教案管理</text>
        <button class="mini-btn" @click="choose">上传教材</button>
      </view>
      <SimpleTable :columns="bookCols" :rows="books">
        <template #cell-subject="{ row }">{{ row.subject?.name || '-' }}</template>
        <template #cell-version="{ value }">{{ value || '-' }}</template>
        <template #cell-status="{ value }">
          <text class="tag" :class="value === 'parsed' ? 'ok' : 'warn'">{{ bookStatus(value) }}</text>
        </template>
        <template #cell-op="{ row }">
          <view class="ops">
            <text class="op" @click="genOutline(row)">AI大纲</text>
            <text class="op" @click="viewPlans(row)">教案列表</text>
          </view>
        </template>
      </SimpleTable>
      <view v-if="!books.length" class="empty">暂无教材</view>
    </view>

    <!-- 教案列表弹窗 -->
    <uni-popup ref="plansPopup" type="center">
      <view class="dialog lg">
        <view class="dialog-title">{{ current?.title }} - 教案列表</view>
        <view class="dialog-body">
          <button class="mini-btn" style="margin-bottom:12px" @click="genPlan">AI生成教案</button>
          <SimpleTable :columns="planCols" :rows="plans">
            <template #cell-status="{ value }">
              <text class="tag" :class="value === 'confirmed' ? 'ok' : 'warn'">{{ planStatus(value) }}</text>
            </template>
            <template #cell-op="{ row }">
              <text v-if="row.status === 'draft'" class="op ok-text" @click="confirm(row.id)">确认锁版</text>
              <text v-else class="muted">已锁版</text>
            </template>
          </SimpleTable>
          <view v-if="!plans.length" class="empty">暂无教案</view>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="plansPopup.close()">关闭</button>
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
import { http } from '@/utils/request'
import { uploadFile } from '@/utils/upload'
import { getUser } from '@/utils/auth'

const schoolId = getUser()?.schoolId || 1
const books = ref<any[]>([])
const plans = ref<any[]>([])
const current = ref<any>(null)
const plansPopup = ref<any>(null)

const bookCols = [
  { key: 'title', title: '教材名称', minWidth: '180px' },
  { key: 'subject', title: '科目', width: '90px' },
  { key: 'version', title: '版本', width: '90px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'op', title: '操作', width: '170px' },
]
const planCols = [
  { key: 'chapter', title: '章节', minWidth: '140px' },
  { key: 'title', title: '教案标题', minWidth: '180px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'op', title: '操作', width: '110px' },
]

function bookStatus(s: string) {
  return ({ uploaded: '已上传', parsed: '已解析' } as any)[s] || s
}
function planStatus(s: string) {
  return ({ draft: '草稿', confirmed: '已锁版' } as any)[s] || s
}

async function load() {
  try {
    const res: any = await http.get('/textbooks', { schoolId })
    books.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    books.value = []
  }
}

// 选择并上传教材
function choose() {
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['pdf', 'doc', 'docx', 'ppt', 'pptx'],
    success: async (r) => {
      const f = r.tempFiles[0]
      uni.showLoading({ title: '上传中...' })
      try {
        await uploadFile({
          url: '/textbooks/upload',
          filePath: f.path,
          name: 'file',
          formData: { schoolId: String(schoolId), subjectId: '1', title: f.name },
        })
        uni.hideLoading()
        uni.showToast({ title: '上传成功', icon: 'success' })
        load()
      } catch (e) {
        uni.hideLoading()
      }
    },
  })
}

async function genOutline(book: any) {
  try {
    await http.post('/lesson-plans/generate-outline', { textbookId: book.id })
    uni.showToast({ title: '大纲生成中，请刷新', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '生成失败', icon: 'none' })
  }
}

async function viewPlans(book: any) {
  current.value = book
  try {
    const res: any = await http.get('/lesson-plans', { textbookId: book.id })
    plans.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    plans.value = []
  }
  plansPopup.value.open()
}

async function genPlan() {
  if (!current.value) return
  try {
    await http.post('/lesson-plans/generate', { textbookId: current.value.id, chapter: '新章节' })
    uni.showToast({ title: '教案生成中', icon: 'none' })
    const res: any = await http.get('/lesson-plans', { textbookId: current.value.id })
    plans.value = Array.isArray(res) ? res : res?.list || []
  } catch (e: any) {
    uni.showToast({ title: e?.message || '生成失败', icon: 'none' })
  }
}

async function confirm(id: number) {
  try {
    await http.post('/lesson-plans/' + id + '/confirm')
    uni.showToast({ title: '已锁版', icon: 'success' })
    const res: any = await http.get('/lesson-plans', { textbookId: current.value.id })
    plans.value = Array.isArray(res) ? res : res?.list || []
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
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
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; }
.mini-btn {
  background: #1e3a5f;
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  margin: 0;
}
.ops { display: flex; gap: 12px; }
.op { font-size: 13px; color: #1e3a5f; }
.ok-text { color: #2e7d5a; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 20px; }
.muted { color: #7a8a96; font-size: 13px; }

.tag {
  font-size: 12px; padding: 2px 10px; border-radius: 6px;
  background: #fef3c7; color: #b07d0b;
}
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.warn { background: #fef3c7; color: #b07d0b; }

.dialog {
  width: 720px; max-width: 94vw;
  background: #fff; border-radius: 14px;
  max-height: 88vh; display: flex; flex-direction: column;
}
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; overflow-y: auto; }
.dialog-foot { display: flex; justify-content: flex-end; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
</style>
