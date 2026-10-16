<template>
  <AdminLayout title="课表管理">
    <view class="panel">
      <view class="panel-head">
        <picker :range="classLabels" :value="classIdx" @change="pickClass">
          <view class="picker-box">{{ classIdx >= 0 && classLabels.length ? classLabels[classIdx] : '选择班级' }}</view>
        </picker>
        <view class="head-actions">
          <button class="mini-btn" @click="openAuto">AI自动排课</button>
          <button class="mini-btn ghost" @click="load">刷新</button>
        </view>
      </view>

      <SimpleTable :columns="cols" :rows="schedules">
        <template #cell-time="{ row }">{{ fmtTime(row.startTime) }} - {{ fmtClock(row.endTime) }}</template>
        <template #cell-lessonPlan="{ row }">{{ row.lessonPlan?.title || '未安排' }}</template>
        <template #cell-room="{ row }">{{ row.room?.name || '-' }}</template>
        <template #cell-status="{ value }">
          <text class="tag" :class="statusClass(value)">{{ statusText(value) }}</text>
        </template>
        <template #cell-op="{ row }">
          <view v-if="row.status === 'scheduled'" class="ops">
            <text class="op" @click="openReschedule(row)">改时间</text>
            <text class="op danger" @click="openCancel(row)">停课</text>
          </view>
          <text v-else class="muted">—</text>
        </template>
      </SimpleTable>
      <view v-if="!schedules.length" class="empty">请选择班级查看课表</view>
    </view>

    <!-- AI自动排课 -->
    <uni-popup ref="autoPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">AI自动排课</view>
        <view class="dialog-body">
          <text class="f-label">班级</text>
          <picker :range="classLabels" :value="autoClassIdx" @change="pickAutoClass">
            <view class="picker-box">{{ autoClassIdx >= 0 && classLabels.length ? classLabels[autoClassIdx] : '选择班级' }}</view>
          </picker>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="autoPopup.close()">取消</button>
          <button class="d-btn ok" @click="doAuto">开始排课</button>
        </view>
      </view>
    </uni-popup>

    <!-- 整体顺延 -->
    <uni-popup ref="postponePopup" type="center">
      <view class="dialog">
        <view class="dialog-title">课表整体顺延</view>
        <view class="dialog-body">
          <view class="note-info">只顺延未开始且未取消的课</view>
          <text class="f-label">顺延范围</text>
          <view class="seg">
            <view v-for="s in scopes" :key="s.v" class="seg-item" :class="{ on: postpone.scope === s.v }" @click="postpone.scope = s.v">{{ s.t }}</view>
          </view>
          <text class="f-label">从哪天起</text>
          <uni-datetime-picker type="datetime" v-model="postpone.fromDate" />
          <text class="f-label">顺延天数</text>
          <stepper v-model="postpone.days" :min="1" :max="60" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="postponePopup.close()">取消</button>
          <button class="d-btn ok" @click="doPostpone">确认顺延</button>
        </view>
      </view>
    </uni-popup>

    <!-- 临时停课 -->
    <uni-popup ref="cancelPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">临时停课</view>
        <view class="dialog-body">
          <text class="f-label">课次：{{ current?.lessonPlan?.title || '未安排' }}</text>
          <text class="f-label">停课原因</text>
          <uni-easyinput v-model="cancelForm.reason" placeholder="如：暴雨停课 / 设备检修" />
          <view class="switch-row">
            <text class="f-label" style="margin:0">安排补课</text>
            <switch :checked="cancelForm.withMakeup" @change="onMakeupSwitch" />
          </view>
          <template v-if="cancelForm.withMakeup">
            <text class="f-label">补课时间</text>
            <uni-datetime-picker type="datetime" v-model="cancelForm.makeupStart" />
            <text class="f-label">补课时长（分钟）</text>
            <stepper v-model="cancelForm.durationMin" :min="15" :max="180" :step="5" />
          </template>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="cancelPopup.close()">取消</button>
          <button class="d-btn danger-btn" @click="doCancel">确认停课</button>
        </view>
      </view>
    </uni-popup>

    <!-- 改时间 -->
    <uni-popup ref="reschedulePopup" type="center">
      <view class="dialog">
        <view class="dialog-title">调整上课时间</view>
        <view class="dialog-body">
          <text class="f-label">课次：{{ current?.lessonPlan?.title || '未安排' }}</text>
          <text class="f-label">新开始时间</text>
          <uni-datetime-picker type="datetime" v-model="rescheduleForm.start" />
          <text class="f-label">时长（分钟）</text>
          <stepper v-model="rescheduleForm.durationMin" :min="15" :max="180" :step="5" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="reschedulePopup.close()">取消</button>
          <button class="d-btn ok" @click="doReschedule">确认调整</button>
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

const schedules = ref<any[]>([])
const classOptions = ref<any[]>([])
const classIdx = ref(-1)
const currentClassId = ref<number | null>(null)

const autoPopup = ref<any>(null)
const postponePopup = ref<any>(null)
const cancelPopup = ref<any>(null)
const reschedulePopup = ref<any>(null)
const current = ref<any>(null)

const autoClassIdx = ref(-1)
const scopes = [
  { v: 'class', t: '本班' },
  { v: 'grade', t: '本年级' },
  { v: 'school', t: '全校' },
]
const postpone = ref<any>({ scope: 'class', fromDate: nowStr(), days: 1 })
const cancelForm = ref<any>({ reason: '', withMakeup: false, makeupStart: nowStr(), durationMin: 45 })
const rescheduleForm = ref<any>({ start: nowStr(), durationMin: 45 })

function onMakeupSwitch(e: any) {
  cancelForm.value.withMakeup = e.detail.value
}

function nowStr() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 16)
}

const cols = [
  { key: 'time', title: '上课时间', minWidth: '180px' },
  { key: 'lessonPlan', title: '课程', minWidth: '160px' },
  { key: 'room', title: '教室', width: '90px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'op', title: '操作', width: '150px' },
]
const classLabels = ref<string[]>([])

function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getMonth() + 1 + '/' + x.getDate() + ' ' + fmtClock(d)
}
function fmtClock(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}
function statusText(s: string) {
  return ({ scheduled: '待上课', ongoing: '进行中', completed: '已完成', cancelled: '已停课' } as any)[s] || s
}
function statusClass(s: string) {
  return ({ scheduled: 'info', ongoing: 'warn', completed: 'ok', cancelled: 'err' } as any)[s] || 'info'
}

async function loadClasses() {
  try {
    const g: any = await http.get('/grades', { schoolId })
    const grades = Array.isArray(g) ? g : g?.list || []
    classOptions.value = grades.flatMap((gr: any) =>
      (gr.classes || []).map((c: any) => ({ id: c.id, name: c.name, gradeId: gr.id, gradeName: gr.name })),
    )
    classLabels.value = classOptions.value.map((c) => c.gradeName + ' ' + c.name)
  } catch (e) {
    classOptions.value = []
  }
}

function pickClass(e: any) {
  classIdx.value = Number(e.detail.value)
  currentClassId.value = classOptions.value[classIdx.value]?.id
  loadSchedule()
}
function pickAutoClass(e: any) {
  autoClassIdx.value = Number(e.detail.value)
}

async function loadSchedule() {
  if (!currentClassId.value) {
    schedules.value = []
    return
  }
  try {
    const res: any = await http.get('/schedules', { classId: currentClassId.value })
    schedules.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    schedules.value = []
  }
}
async function load() {
  await loadClasses()
  if (classIdx.value < 0 && classOptions.value.length) {
    classIdx.value = 0
    currentClassId.value = classOptions.value[0].id
  }
  loadSchedule()
}

function openAuto() {
  autoClassIdx.value = classIdx.value
  autoPopup.value.open()
}
async function doAuto() {
  if (autoClassIdx.value < 0) {
    uni.showToast({ title: '请选择班级', icon: 'none' })
    return
  }
  const classId = classOptions.value[autoClassIdx.value]?.id
  try {
    await http.post('/schedules/auto', { schoolId, classId, lessonPlanIds: [] })
    uni.showToast({ title: '排课完成', icon: 'success' })
    autoPopup.value.close()
    classIdx.value = autoClassIdx.value
    currentClassId.value = classId
    loadSchedule()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '排课失败', icon: 'none' })
  }
}

async function doPostpone() {
  if (!currentClassId.value) return
  const scope = postpone.value.scope
  const targetId =
    scope === 'class'
      ? currentClassId.value
      : scope === 'grade'
        ? classOptions.value[classIdx.value]?.gradeId
        : schoolId
  if (!targetId) {
    uni.showToast({ title: '无法确定范围', icon: 'none' })
    return
  }
  try {
    const res: any = await http.post('/schedules/postpone', {
      scope, targetId,
      fromDate: new Date(postpone.value.fromDate).toISOString(),
      days: postpone.value.days,
    })
    uni.showToast({ title: `顺延${res?.shifted ?? 0}节`, icon: 'none' })
    postponePopup.value.close()
    loadSchedule()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '顺延失败', icon: 'none' })
  }
}

function openCancel(row: any) {
  current.value = row
  cancelForm.value = { reason: '', withMakeup: false, makeupStart: nowStr(), durationMin: 45 }
  cancelPopup.value.open()
}
async function doCancel() {
  if (!current.value) return
  const f = cancelForm.value
  if (f.withMakeup && !f.makeupStart) {
    uni.showToast({ title: '请选补课时间', icon: 'none' })
    return
  }
  const payload: any = { reason: f.reason || undefined }
  if (f.withMakeup) {
    const start = new Date(f.makeupStart)
    payload.makeupStartTime = start.toISOString()
    payload.makeupEndTime = new Date(start.getTime() + f.durationMin * 60000).toISOString()
  }
  try {
    const res: any = await http.post('/schedules/' + current.value.id + '/cancel', payload)
    uni.showToast({ title: res?.makeup ? '已停课并补课' : '已停课', icon: 'success' })
    cancelPopup.value.close()
    loadSchedule()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '停课失败', icon: 'none' })
  }
}

function openReschedule(row: any) {
  current.value = row
  const start = new Date(row.startTime)
  const end = new Date(row.endTime)
  rescheduleForm.value = {
    start: start.toISOString().slice(0, 16),
    durationMin: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
  }
  reschedulePopup.value.open()
}
async function doReschedule() {
  const f = rescheduleForm.value
  if (!f.start) {
    uni.showToast({ title: '请选新时间', icon: 'none' })
    return
  }
  const start = new Date(f.start)
  const end = new Date(start.getTime() + f.durationMin * 60000)
  try {
    await http.put('/schedules/' + current.value.id + '/reschedule', {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    })
    uni.showToast({ title: '已调整', icon: 'success' })
    reschedulePopup.value.close()
    loadSchedule()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '调整失败', icon: 'none' })
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
  flex-wrap: wrap;
  gap: 10px;
}
.head-actions { display: flex; gap: 10px; }
.picker-box {
  background: #fafbfc;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 14px;
  color: #4a4a4a;
  min-width: 180px;
}
.mini-btn {
  background: #1e3a5f;
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  margin: 0;
}
.mini-btn.ghost { background: #f0f0f0; color: #4a4a4a; }
.ops { display: flex; gap: 12px; }
.op { font-size: 13px; color: #1e3a5f; }
.op.danger { color: #c0392b; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 20px; }
.muted { color: #7a8a96; font-size: 13px; }

.tag {
  font-size: 12px; padding: 2px 10px; border-radius: 6px;
  background: #eef0f2; color: #555;
}
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.warn { background: #fef3c7; color: #b07d0b; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog {
  width: 520px; max-width: 92vw;
  background: #fff; border-radius: 14px;
}
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.note-info {
  background: #eef5ff; color: #3a6ea5; font-size: 12px;
  border-radius: 8px; padding: 10px 14px; margin-bottom: 6px;
}
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; margin-bottom: 4px; }
.seg-item { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; color: #6b7280; border-radius: 6px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }
.switch-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
.d-btn.danger-btn { background: #c0392b; color: #fff; }
</style>
