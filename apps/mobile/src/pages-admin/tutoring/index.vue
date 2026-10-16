<template>
  <AdminLayout title="个性化辅导">
    <view class="panel">
      <view class="seg">
        <view class="seg-item" :class="{ on: tab === 'subs' }" @click="tab = 'subs'">辅导订阅</view>
        <view class="seg-item" :class="{ on: tab === 'devices' }" @click="tab = 'devices'">穿戴设备</view>
        <view class="seg-item" :class="{ on: tab === 'practice' }" @click="tab = 'practice'">练习记录</view>
      </view>

      <!-- 订阅 -->
      <template v-if="tab === 'subs'">
        <!-- 护眼依从率卡片：点学生行「依从率」后展示（按学生维度） -->
        <view v-if="complianceStudentId" class="compliance-card">
          <view class="cc-left">
            <view class="cc-head">
              <text class="cc-title">护眼依从率</text>
              <text class="cc-name">{{ complianceStudentName }}</text>
            </view>
            <!-- complianceRate 为 null 表示该学生尚无「按提醒休息」反馈 -->
            <view class="cc-value" :class="{ none: compliance?.complianceRate == null }">
              {{ compliance?.complianceRate != null ? compliance.complianceRate + '%' : '暂无反馈' }}
            </view>
            <view class="cc-sub">已反馈 {{ compliance?.totalReminders || 0 }} 次 / 按提醒休息 {{ compliance?.restedCount || 0 }} 次</view>
          </view>
          <text class="cc-close" @click="closeCompliance">关闭</text>
        </view>
        <SimpleTable :columns="subCols" :rows="subscriptions">
          <template #cell-student="{ row }">{{ row.student?.name || '#' + row.studentId }}</template>
          <template #cell-class="{ row }">
            {{ row.student?.class?.grade?.name }}{{ row.student?.class?.name }}
          </template>
          <template #cell-plan="{ value }">{{ value }}</template>
          <template #cell-status="{ value }">
            <text class="tag" :class="value === 'active' ? 'ok' : 'info'">{{ subStatusText(value) }}</text>
          </template>
          <template #cell-endDate="{ value }">{{ fmtDate(value) }}</template>
          <template #cell-op="{ row }">
            <!-- 依从率：按学生维度加载护眼依从统计卡片 -->
            <text class="op" @click="showCompliance(row)">依从率</text>
            <text v-if="row.status === 'active'" class="op no gap-left" @click="cancel(row.studentId)">停用</text>
            <text v-else class="muted gap-left">-</text>
          </template>
        </SimpleTable>
        <view v-if="!subscriptions.length" class="empty">暂无辅导订阅</view>
      </template>

      <!-- 设备 -->
      <template v-else-if="tab === 'devices'">
        <button class="mini-btn" style="margin-bottom:14px" @click="openRegister">注册设备</button>
        <SimpleTable :columns="devCols" :rows="devices">
          <template #cell-serialNumber="{ value }"><text class="serial">{{ value }}</text></template>
          <template #cell-type="{ value }">{{ devTypeText(value) }}</template>
          <template #cell-model="{ value }">{{ value || '-' }}</template>
          <template #cell-bound="{ row }">{{ row.student?.name || '未绑定' }}</template>
          <template #cell-status="{ value }">
            <text class="tag" :class="value === 'online' ? 'ok' : 'info'">{{ devStatusText(value) }}</text>
          </template>
        </SimpleTable>
        <view v-if="!devices.length" class="empty">暂无穿戴设备</view>
      </template>

      <!-- 练习 -->
      <template v-else>
        <view class="practice-bar">
          <text class="f-label" style="margin:0">学生ID</text>
          <input class="num-input" type="number" v-model="practiceStudentId" placeholder="如：1" />
          <button class="mini-btn" @click="loadPractice">查询练习</button>
        </view>
        <SimpleTable :columns="pracCols" :rows="practiceRecords">
          <template #cell-question="{ value }">{{ value }}</template>
          <template #cell-isCorrect="{ value }">
            <text v-if="value === true" class="tag ok">正确</text>
            <text v-else-if="value === false" class="tag err">错误</text>
            <text v-else class="tag info">待判</text>
          </template>
          <template #cell-createdAt="{ value }">{{ fmtDateTime(value) }}</template>
        </SimpleTable>
        <view v-if="!practiceRecords.length" class="empty">暂无练习记录</view>
      </template>
    </view>

    <!-- 注册穿戴设备 -->
    <uni-popup ref="regPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">注册穿戴设备</view>
        <view class="dialog-body">
          <text class="f-label">设备类型</text>
          <picker :range="typeOptions" :value="regTypeIdx" @change="pickRegType">
            <view class="picker-box">{{ typeOptions[regTypeIdx] }}</view>
          </picker>
          <text class="f-label">序列号</text>
          <uni-easyinput v-model="regForm.serialNumber" placeholder="设备序列号" />
          <text class="f-label">型号</text>
          <uni-easyinput v-model="regForm.model" placeholder="如：Rokid Glass3" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="regPopup.close()">取消</button>
          <button class="d-btn ok" @click="doRegister">注册</button>
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

const schoolId = getUser()?.schoolId || 1
const tab = ref('subs')
const subscriptions = ref<any[]>([])
const devices = ref<any[]>([])

const practiceStudentId = ref<any>('')
const practiceRecords = ref<any[]>([])

// ===== 护眼依从率（近视提醒依从性统计）=====
// studentId 来源：与「停用」操作一致——取订阅列表行 row.studentId（该页按学生维度的列表）
const compliance = ref<any>(null)
const complianceStudentId = ref<number | null>(null)
const complianceStudentName = ref('')

const regPopup = ref<any>(null)
const regForm = ref({ type: 'glasses', serialNumber: '', model: '' })
const regTypeIdx = ref(0)
const typeOptions = ['Rokid Glass3 智能眼镜', 'W377E 智能手表']
const typeValues = ['glasses', 'watch']

const subCols = [
  { key: 'student', title: '学生', minWidth: '110px' },
  { key: 'class', title: '班级', minWidth: '140px' },
  { key: 'plan', title: '套餐', width: '90px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'endDate', title: '到期时间', minWidth: '120px' },
  { key: 'op', title: '操作', width: '130px' },
]
const devCols = [
  { key: 'serialNumber', title: '序列号', minWidth: '160px' },
  { key: 'type', title: '类型', width: '110px' },
  { key: 'model', title: '型号', minWidth: '140px' },
  { key: 'bound', title: '绑定学生', minWidth: '110px' },
  { key: 'status', title: '状态', width: '90px' },
]
const pracCols = [
  { key: 'question', title: '提问内容', minWidth: '240px' },
  { key: 'isCorrect', title: '判题', width: '90px' },
  { key: 'createdAt', title: '时间', minWidth: '150px' },
]

function subStatusText(s: string) {
  return ({ active: '服务中', expired: '已过期', cancelled: '已取消' } as any)[s] || s
}
function devTypeText(t: string) {
  return ({ glasses: '智能眼镜', watch: '智能手表' } as any)[t] || t
}
function devStatusText(s: string) {
  return ({ online: '在线', offline: '离线', bound: '已绑定' } as any)[s] || s
}
function fmtDate(d: string) {
  if (!d) return ''
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')
}
function fmtDateTime(d: string) {
  if (!d) return ''
  const x = new Date(d)
  return fmtDate(d) + ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

async function loadSubs() {
  try {
    subscriptions.value = await http.get('/tutoring/subscriptions/school/' + schoolId)
  } catch (e) {
    subscriptions.value = []
  }
}
async function loadDevices() {
  try {
    devices.value = await http.get('/tutoring/devices/' + schoolId)
  } catch (e) {
    devices.value = []
  }
}
async function loadPractice() {
  if (!practiceStudentId.value) {
    uni.showToast({ title: '请输入学生ID', icon: 'none' })
    return
  }
  try {
    const res: any = await http.get('/tutoring/practice/' + practiceStudentId.value)
    practiceRecords.value = res?.data || res || []
  } catch (e) {
    practiceRecords.value = []
  }
}
async function cancel(studentId: number) {
  uni.showModal({
    title: '停用订阅',
    content: '确认停用该学生的辅导服务？',
    success: async (r) => {
      if (!r.confirm) return
      await http.post('/tutoring/cancel/' + studentId)
      uni.showToast({ title: '已停用', icon: 'success' })
      loadSubs()
    },
  })
}

/** 展示该学生的护眼依从率卡片（GET /tutoring/myopia/:studentId/compliance） */
async function showCompliance(row: any) {
  complianceStudentId.value = row.studentId
  complianceStudentName.value = row.student?.name || '#' + row.studentId
  compliance.value = null
  try {
    // 无反馈数据时后端返回 complianceRate: null，卡片显示「暂无反馈」
    compliance.value = await http.get('/tutoring/myopia/' + row.studentId + '/compliance')
  } catch (e) {
    compliance.value = null
  }
}

function closeCompliance() {
  compliance.value = null
  complianceStudentId.value = null
  complianceStudentName.value = ''
}

function openRegister() {
  regForm.value = { type: 'glasses', serialNumber: '', model: '' }
  regTypeIdx.value = 0
  regPopup.value.open()
}
function pickRegType(e: any) {
  regTypeIdx.value = Number(e.detail.value)
  regForm.value.type = typeValues[regTypeIdx.value]
}
async function doRegister() {
  if (!regForm.value.serialNumber.trim()) {
    uni.showToast({ title: '请输入序列号', icon: 'none' })
    return
  }
  try {
    await http.post('/tutoring/devices/register', { ...regForm.value, schoolId })
    uni.showToast({ title: '注册成功', icon: 'success' })
    regPopup.value.close()
    loadDevices()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '注册失败', icon: 'none' })
  }
}

onShow(() => {
  loadSubs()
  loadDevices()
})
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; margin-bottom: 14px; }
.seg-item { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; color: #6b7280; border-radius: 6px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }
.serial { font-family: Consolas, monospace; color: #4a4a4a; font-size: 13px; }
.op { font-size: 13px; }
.op.no { color: #c0392b; }
.gap-left { margin-left: 12px; }
.muted { color: #aaa; font-size: 13px; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

/* 护眼依从率卡片 */
.compliance-card {
  display: flex; justify-content: space-between; align-items: center;
  background: #f7faf8; border: 1px solid #dceee4; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 14px;
}
.cc-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.cc-title { font-size: 13px; font-weight: 600; color: #3a5548; }
.cc-name { font-size: 12px; color: #7a8a96; }
.cc-value { font-size: 28px; font-weight: 700; color: #0f8a5f; line-height: 1.2; }
.cc-value.none { font-size: 18px; color: #9aa8b2; font-weight: 500; }
.cc-sub { font-size: 12px; color: #7a8a96; margin-top: 4px; }
.cc-close { font-size: 12px; color: #9aa8b2; padding: 6px; }
.practice-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.num-input { width: 110px; background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog { width: 480px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 16px; font-size: 14px; color: #4a4a4a; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
