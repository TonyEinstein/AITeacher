<template>
  <AdminLayout title="考试管理">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">考试列表</text>
        <button class="mini-btn" @click="openCreate">创建考试</button>
      </view>

      <SimpleTable :columns="cols" :rows="exams">
        <template #cell-name="{ value }">{{ value }}</template>
        <template #cell-type="{ value }">{{ typeText(value) }}</template>
        <template #cell-startTime="{ value }">{{ fmtTime(value) }}</template>
        <template #cell-status="{ value }">
          <text class="tag" :class="statusClass(value)">{{ statusText(value) }}</text>
        </template>
        <template #cell-op="{ row }">
          <view class="ops">
            <text class="op" @click="genPaper(row)">AI组卷</text>
            <text class="op" @click="viewAnalysis(row)">分析报告</text>
          </view>
        </template>
      </SimpleTable>
      <view v-if="!exams.length" class="empty">暂无考试，点击右上角创建</view>
    </view>

    <!-- 创建考试 -->
    <uni-popup ref="createPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">创建考试</view>
        <view class="dialog-body">
          <text class="f-label">考试名称</text>
          <uni-easyinput v-model="form.name" placeholder="如：第一次月考" />
          <text class="f-label">考试类型</text>
          <view class="seg">
            <view v-for="t in types" :key="t.v" class="seg-item" :class="{ on: form.type === t.v }" @click="form.type = t.v">{{ t.t }}</view>
          </view>
          <text class="f-label">开始时间（留空默认一周后）</text>
          <uni-datetime-picker type="datetime" v-model="form.startTime" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="createPopup.close()">取消</button>
          <button class="d-btn ok" @click="createExam">创建</button>
        </view>
      </view>
    </uni-popup>

    <!-- 分析报告 -->
    <uni-popup ref="analysisPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">考试分析报告</view>
        <view class="dialog-body">
          <template v-if="analysis && !analysis.message">
            <view class="stat-grid">
              <view class="stat"><text class="stat-n">{{ analysis.totalStudents }}</text><text class="stat-l">参考人数</text></view>
              <view class="stat"><text class="stat-n">{{ analysis.average }}</text><text class="stat-l">平均分</text></view>
              <view class="stat"><text class="stat-n">{{ analysis.max }}</text><text class="stat-l">最高分</text></view>
              <view class="stat"><text class="stat-n">{{ analysis.min }}</text><text class="stat-l">最低分</text></view>
              <view class="stat"><text class="stat-n">{{ analysis.passRate }}%</text><text class="stat-l">及格率</text></view>
              <view class="stat"><text class="stat-n">{{ analysis.excellentRate }}%</text><text class="stat-l">优秀率</text></view>
            </view>
          </template>
          <view v-else class="empty">{{ analysis?.message || '暂无分析数据' }}</view>
        </view>
        <view class="dialog-foot">
          <button class="d-btn ok" @click="analysisPopup.close()">关闭</button>
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
import { getUser } from '@/utils/auth'

const schoolId = Number(uni.getStorageSync('active_school_id')) || getUser()?.schoolId || 1

const exams = ref<any[]>([])
const createPopup = ref<any>(null)
const analysisPopup = ref<any>(null)
const analysis = ref<any>(null)
const form = ref<any>({ name: '', type: 'monthly', startTime: '' })

const types = [
  { v: 'monthly', t: '月考' },
  { v: 'midterm', t: '段考' },
  { v: 'final', t: '期末考' },
]

const cols = [
  { key: 'name', title: '考试名称', minWidth: '160px' },
  { key: 'type', title: '类型', width: '90px' },
  { key: 'startTime', title: '开始时间', minWidth: '160px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'op', title: '操作', width: '170px' },
]

function typeText(t: string) {
  return ({ monthly: '月考', midterm: '段考', final: '期末考' } as any)[t] || t
}
function statusText(s: string) {
  return ({ scheduled: '待考', ongoing: '进行中', completed: '已结束' } as any)[s] || s
}
function statusClass(s: string) {
  return ({ scheduled: 'info', ongoing: 'warn', completed: 'ok' } as any)[s] || 'info'
}
function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

async function load() {
  try {
    const res: any = await http.get('/exams', { schoolId })
    exams.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    exams.value = []
  }
}

function openCreate() {
  form.value = { name: '', type: 'monthly', startTime: '' }
  createPopup.value.open()
}
async function createExam() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  try {
    await http.post('/exams', {
      name: form.value.name,
      type: form.value.type,
      schoolId,
      startTime: form.value.startTime || undefined,
    })
    uni.showToast({ title: '创建成功', icon: 'success' })
    createPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '创建失败', icon: 'none' })
  }
}

async function genPaper(row: any) {
  try {
    await http.post('/exams/' + row.id + '/generate-paper', {
      subject: '综合',
      totalScore: 100,
      questionTypes: [
        { type: 'choice', count: 10, score: 3 },
        { type: 'fill', count: 5, score: 4 },
        { type: 'essay', count: 3, score: 10 },
      ],
    })
    uni.showToast({ title: '试卷已生成', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '组卷失败', icon: 'none' })
  }
}

async function viewAnalysis(row: any) {
  try {
    analysis.value = await http.get('/exams/' + row.id + '/analysis')
    analysisPopup.value.open()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '分析失败', icon: 'none' })
  }
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.ops { display: flex; gap: 12px; }
.op { font-size: 13px; color: #1e3a5f; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 24px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.warn { background: #fef3c7; color: #b07d0b; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog { width: 520px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; }
.seg-item { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; color: #6b7280; border-radius: 6px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }
.stat-grid { display: flex; flex-wrap: wrap; }
.stat { width: 33.33%; box-sizing: border-box; text-align: center; padding: 14px 0; }
.stat-n { display: block; font-size: 22px; font-weight: 700; color: #1e3a5f; }
.stat-l { font-size: 12px; color: #8a949c; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
