<template>
  <AdminLayout title="家长满意度问卷">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">家长满意度问卷</text>
        <button class="mini-btn" @click="openCreate">创建问卷</button>
      </view>
      <SimpleTable :columns="cols" :rows="list">
        <template #cell-title="{ value }">{{ value }}</template>
        <template #cell-status="{ value }">
          <text class="tag" :class="value === 'active' ? 'ok' : 'info'">{{ value === 'active' ? '进行中' : '已结束' }}</text>
        </template>
        <template #cell-createdAt="{ value }">{{ fmtTime(value) }}</template>
        <template #cell-op="{ row }">
          <text class="op" @click="viewStats(row)">查看统计</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无问卷</view>
    </view>

    <!-- 创建问卷 -->
    <uni-popup ref="createPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">创建满意度问卷</view>
        <view class="dialog-body">
          <text class="f-label">标题</text>
          <uni-easyinput v-model="form.title" />
          <text class="f-label">说明</text>
          <uni-easyinput v-model="form.desc" type="textarea" placeholder="问卷说明（可选）" />
          <view class="tip">默认包含 5 个标准满意度问题：教学质量、AI 互动、作业批改、辅导效果、推荐意愿（1-5 分）</view>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="createPopup.close()">取消</button>
          <button class="d-btn ok" @click="doCreate">创建并推送</button>
        </view>
      </view>
    </uni-popup>

    <!-- 统计 -->
    <uni-popup ref="statsPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">问卷统计</view>
        <view class="dialog-body">
          <text class="stats-line">回收份数：{{ statsData.totalResponses ?? 0 }}</text>
          <text class="stats-line">平均评分：{{ statsData.averageRating ?? '-' }}</text>
        </view>
        <view class="dialog-foot">
          <button class="d-btn ok" @click="statsPopup.close()">关闭</button>
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

const list = ref<any[]>([])
const createPopup = ref<any>(null)
const statsPopup = ref<any>(null)
const form = ref({ title: '家长满意度问卷', desc: '' })
const statsData = ref<any>({})

const defaultQuestions = [
  { q: '您对AI老师的教学质量满意度', type: 'rating' },
  { q: '您对AI老师与孩子的互动满意度', type: 'rating' },
  { q: '您对作业批改的及时性满意度', type: 'rating' },
  { q: '您对辅导效果的满意度', type: 'rating' },
  { q: '您向其他家长推荐的意愿', type: 'rating' },
]

const cols = [
  { key: 'title', title: '问卷标题', minWidth: '200px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'createdAt', title: '创建时间', minWidth: '170px' },
  { key: 'op', title: '操作', width: '110px' },
]

function fmtTime(d: string) {
  if (!d) return ''
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

async function load() {
  try {
    list.value = await http.get('/surveys/active')
  } catch (e) {
    list.value = []
  }
}

function openCreate() {
  form.value = { title: '家长满意度问卷', desc: '' }
  createPopup.value.open()
}
async function doCreate() {
  try {
    await http.post('/surveys', { title: form.value.title, description: form.value.desc, questions: defaultQuestions })
    uni.showToast({ title: '已创建并推送', icon: 'success' })
    createPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '创建失败', icon: 'none' })
  }
}

async function viewStats(row: any) {
  try {
    statsData.value = await http.get('/surveys/' + row.id + '/stats')
  } catch (e: any) {
    statsData.value = {}
  }
  statsPopup.value.open()
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.op { font-size: 13px; color: #1e3a5f; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }
.tip { font-size: 12px; color: #7a8a96; background: #f6f8fa; border-radius: 8px; padding: 10px 12px; margin-top: 14px; line-height: 1.6; }
.stats-line { display: block; font-size: 15px; color: #3a3a3a; margin-bottom: 10px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog { width: 500px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
