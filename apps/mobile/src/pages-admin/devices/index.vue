<template>
  <AdminLayout title="设备管理">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">教室盒子 / 教室管理</text>
        <button class="mini-btn" @click="openRegister">注册新设备</button>
      </view>

      <view class="seg">
        <view class="seg-item" :class="{ on: tab === 'boxes' }" @click="tab = 'boxes'">教室盒子</view>
        <view class="seg-item" :class="{ on: tab === 'rooms' }" @click="tab = 'rooms'">教室管理</view>
        <view class="seg-item" :class="{ on: tab === 'ota' }" @click="tab = 'ota'">OTA 管理</view>
      </view>

      <!-- 盒子 -->
      <template v-if="tab === 'boxes'">
        <SimpleTable :columns="boxCols" :rows="boxes">
          <template #cell-serialNumber="{ value }">
            <text class="serial">{{ value }}</text>
          </template>
          <template #cell-room="{ row }">{{ row.room?.name || '未分配' }}</template>
          <template #cell-type="{ value }">{{ typeText(value) }}</template>
          <template #cell-status="{ value }">
            <text class="tag" :class="value === 'online' ? 'ok' : 'info'">{{ value === 'online' ? '在线' : '离线' }}</text>
          </template>
          <template #cell-lastHeartbeat="{ value }">{{ fmtTime(value) }}</template>
          <template #cell-otaGroup="{ value }">
            <!-- OTA 灰度分组：canary=灰度 / stable=正式 -->
            <text class="tag" :class="value === 'canary' ? 'warn' : 'info'">{{ otaGroupText(value) }}</text>
          </template>
          <template #cell-op="{ row }">
            <text class="op" @click="openAssign(row)">分配教室</text>
            <!-- 按需求规格：切换按钮仅 super_admin / group_admin 显示（后端 RolesGuard 另允许 school_admin，此处从紧） -->
            <text v-if="canWriteOta" class="op gap-left" @click="toggleOtaGroup(row)">{{ row.otaGroup === 'canary' ? '设为正式' : '设为灰度' }}</text>
          </template>
        </SimpleTable>
        <view v-if="!boxes.length" class="empty">暂无设备</view>
      </template>

      <!-- 教室 -->
      <template v-else-if="tab === 'rooms'">
        <SimpleTable :columns="roomCols" :rows="rooms">
          <template #cell-code="{ value }">{{ value }}</template>
          <template #cell-name="{ value }">{{ value }}</template>
          <template #cell-capacity="{ value }">{{ value }} 人</template>
        </SimpleTable>
        <view v-if="!rooms.length" class="empty">暂无教室</view>
      </template>

      <!-- OTA 管理：发布历史 + 发布表单 + 回滚表单 -->
      <template v-else>
        <!-- a. 发布历史 -->
        <view class="ota-bar">
          <text class="f-label" style="margin:0">发布历史</text>
          <picker :range="channelOptions" :value="channelIdx" @change="pickChannel">
            <view class="picker-box small">{{ channelOptions[channelIdx] }}</view>
          </picker>
        </view>
        <SimpleTable :columns="otaCols" :rows="releases">
          <template #cell-version="{ row }">
            <text class="serial">V{{ row.version }}</text>
          </template>
          <template #cell-channel="{ value }">
            <text class="tag" :class="value === 'canary' ? 'warn' : 'info'">{{ value === 'canary' ? '灰度' : '正式' }}</text>
          </template>
          <template #cell-action="{ row }">
            <text v-if="row.action === 'rollback'" class="tag err">回滚到 {{ row.rollbackToVersion || '-' }}</text>
            <text v-else class="tag ok">发布</text>
          </template>
          <template #cell-note="{ value }">{{ value || '-' }}</template>
          <template #cell-createdAt="{ value }">{{ fmtDateTime(value) }}</template>
        </SimpleTable>
        <view v-if="!releases.length" class="empty">暂无发布记录</view>

        <!-- b. 发布新版本 + c. 回滚（仅 super_admin / group_admin 可写） -->
        <template v-if="canWriteOta">
          <view class="ota-form">
            <view class="ota-form-title">发布新版本</view>
            <text class="f-label">版本号</text>
            <uni-easyinput v-model="releaseForm.version" placeholder="如：1.2.0" />
            <text class="f-label">包地址</text>
            <uni-easyinput v-model="releaseForm.packageUrl" placeholder="https://.../firmware.bin" />
            <text class="f-label">校验和（可选）</text>
            <uni-easyinput v-model="releaseForm.checksum" placeholder="sha256 / md5" />
            <text class="f-label">通道</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: releaseForm.channel === 'canary' }" @click="releaseForm.channel = 'canary'">灰度 canary</view>
              <view class="seg-item" :class="{ on: releaseForm.channel === 'stable' }" @click="releaseForm.channel = 'stable'">正式 stable</view>
            </view>
            <text class="f-label">备注（可选）</text>
            <uni-easyinput v-model="releaseForm.note" placeholder="发布说明" />
            <button class="mini-btn ota-submit" @click="doPublishRelease">发布</button>
          </view>

          <view class="ota-form">
            <view class="ota-form-title">回滚通道</view>
            <text class="f-label">通道</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: rollbackForm.channel === 'canary' }" @click="rollbackForm.channel = 'canary'">灰度 canary</view>
              <view class="seg-item" :class="{ on: rollbackForm.channel === 'stable' }" @click="rollbackForm.channel = 'stable'">正式 stable</view>
            </view>
            <text class="f-label">回滚到版本</text>
            <uni-easyinput v-model="rollbackForm.rollbackToVersion" placeholder="如：1.1.0" />
            <text class="f-label">旧版本包地址</text>
            <uni-easyinput v-model="rollbackForm.packageUrl" placeholder="https://.../firmware-1.1.0.bin" />
            <text class="f-label">校验和（可选）</text>
            <uni-easyinput v-model="rollbackForm.checksum" placeholder="sha256 / md5" />
            <text class="f-label">备注（可选）</text>
            <uni-easyinput v-model="rollbackForm.note" placeholder="回滚原因" />
            <button class="mini-btn ota-submit danger" @click="doRollback">回滚</button>
          </view>
        </template>
        <!-- school_admin 只读：无发布/回滚表单（权限由后端 RolesGuard 强制） -->
      </template>
    </view>

    <!-- 注册设备 -->
    <uni-popup ref="registerPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">注册设备</view>
        <view class="dialog-body">
          <text class="f-label">序列号</text>
          <uni-easyinput v-model="regForm.serialNumber" placeholder="如：BOX-2026-001" />
          <text class="f-label">类型</text>
          <view class="seg">
            <view class="seg-item on">教室盒子</view>
          </view>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="registerPopup.close()">取消</button>
          <button class="d-btn ok" @click="doRegister">注册</button>
        </view>
      </view>
    </uni-popup>

    <!-- 分配教室 -->
    <uni-popup ref="assignPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">分配教室</view>
        <view class="dialog-body">
          <text class="f-label">选择教室</text>
          <picker :range="roomLabels" :value="assignIdx" @change="pickAssign">
            <view class="picker-box">{{ assignIdx >= 0 && roomLabels.length ? roomLabels[assignIdx] : '选择教室' }}</view>
          </picker>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="assignPopup.close()">取消</button>
          <button class="d-btn ok" @click="doAssign">确定</button>
        </view>
      </view>
    </uni-popup>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'

const schoolId = Number(uni.getStorageSync('active_school_id')) || getUser()?.schoolId || 1

// OTA 写操作（发布/回滚/切换分组）仅 super_admin / group_admin；
// 判断方式与 device-monitor 页一致：从本地登录用户取 role
const user = getUser()
const canWriteOta = user?.role === 'super_admin' || user?.role === 'group_admin'

const tab = ref('boxes')
const boxes = ref<any[]>([])
const rooms = ref<any[]>([])
const registerPopup = ref<any>(null)
const assignPopup = ref<any>(null)
const regForm = ref({ serialNumber: '' })
const currentBox = ref<any>(null)
const assignIdx = ref(-1)
const roomLabels = ref<string[]>([])

// ===== OTA 管理状态 =====
const releases = ref<any[]>([])
const channelIdx = ref(0)
const channelValues = ['', 'canary', 'stable']
const channelOptions = ['全部通道', '灰度 canary', '正式 stable']
const releaseForm = ref({ version: '', packageUrl: '', checksum: '', channel: 'canary', note: '' })
const rollbackForm = ref({ channel: 'canary', rollbackToVersion: '', packageUrl: '', checksum: '', note: '' })

const boxCols = [
  { key: 'serialNumber', title: '序列号', minWidth: '150px' },
  { key: 'room', title: '所在教室', minWidth: '120px' },
  { key: 'type', title: '类型', width: '90px' },
  { key: 'status', title: '状态', width: '80px' },
  { key: 'otaGroup', title: 'OTA 分组', width: '90px' },
  { key: 'lastHeartbeat', title: '最后心跳', minWidth: '140px' },
  { key: 'op', title: '操作', width: '170px' },
]
const roomCols = [
  { key: 'code', title: '教室编号', minWidth: '140px' },
  { key: 'name', title: '教室名称', minWidth: '140px' },
  { key: 'capacity', title: '容量', width: '100px' },
]
const otaCols = [
  { key: 'version', title: '版本', minWidth: '100px' },
  { key: 'channel', title: '通道', width: '90px' },
  { key: 'action', title: '操作类型', minWidth: '120px' },
  { key: 'note', title: '备注', minWidth: '180px' },
  { key: 'createdAt', title: '时间', minWidth: '150px' },
]

function typeText(t: string) {
  return ({ classroom: '教室盒子', camera: '摄像头', microphone: '麦克风' } as any)[t] || t
}
function otaGroupText(g: string) {
  return ({ canary: '灰度', stable: '正式' } as any)[g] || '正式'
}
function fmtTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}
function fmtDateTime(d: string) {
  if (!d) return '-'
  const x = new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

async function load() {
  try {
    const b: any = await http.get('/boxes', { schoolId })
    boxes.value = b?.list || b || []
    rooms.value = await http.get('/rooms', { schoolId })
    roomLabels.value = rooms.value.map((r) => r.name + '（' + r.code + '）')
  } catch (e) {
    boxes.value = []
    rooms.value = []
  }
}

/** 加载 OTA 发布历史（channel 筛选：空=全部） */
async function loadReleases() {
  try {
    const channel = channelValues[channelIdx.value]
    const params: any = {}
    if (channel) params.channel = channel
    const res: any = await http.get('/boxes/ota/releases', params)
    releases.value = res?.data || res || []
  } catch (e) {
    releases.value = []
  }
}

function pickChannel(e: any) {
  channelIdx.value = Number(e.detail.value)
  loadReleases()
}

/** 发布新版本 */
async function doPublishRelease() {
  const f = releaseForm.value
  if (!f.version.trim() || !f.packageUrl.trim()) {
    uni.showToast({ title: '请填写版本号和包地址', icon: 'none' })
    return
  }
  try {
    await http.post('/boxes/ota/releases', {
      version: f.version.trim(),
      packageUrl: f.packageUrl.trim(),
      checksum: f.checksum.trim() || undefined,
      channel: f.channel,
      note: f.note.trim() || undefined,
    })
    uni.showToast({ title: '已发布', icon: 'success' })
    releaseForm.value = { version: '', packageUrl: '', checksum: '', channel: f.channel, note: '' }
    loadReleases()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '发布失败', icon: 'none' })
  }
}

/** 回滚通道（危险操作，先弹窗确认） */
function doRollback() {
  const f = rollbackForm.value
  if (!f.rollbackToVersion.trim() || !f.packageUrl.trim()) {
    uni.showToast({ title: '请填写回滚版本和旧版本包地址', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认回滚',
    content: '将把「' + (f.channel === 'canary' ? '灰度' : '正式') + '」通道回滚到 V' + f.rollbackToVersion.trim() + '，确认执行？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.post('/boxes/ota/rollback', {
          channel: f.channel,
          rollbackToVersion: f.rollbackToVersion.trim(),
          packageUrl: f.packageUrl.trim(),
          checksum: f.checksum.trim() || undefined,
          note: f.note.trim() || undefined,
        })
        uni.showToast({ title: '已回滚', icon: 'success' })
        rollbackForm.value = { channel: f.channel, rollbackToVersion: '', packageUrl: '', checksum: '', note: '' }
        loadReleases()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '回滚失败', icon: 'none' })
      }
    },
  })
}

/** 切换盒子 OTA 分组（灰度⇄正式），二次确认 */
function toggleOtaGroup(box: any) {
  const next = box.otaGroup === 'canary' ? 'stable' : 'canary'
  uni.showModal({
    title: '切换 OTA 分组',
    content: '将 ' + box.serialNumber + ' 设为「' + (next === 'canary' ? '灰度' : '正式') + '」？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.put('/boxes/' + box.id + '/ota-group', { group: next })
        uni.showToast({ title: '已切换', icon: 'success' })
        load()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '切换失败', icon: 'none' })
      }
    },
  })
}

// 切到 OTA tab 时加载发布历史
watch(tab, (v) => {
  if (v === 'ota') loadReleases()
})

function openRegister() {
  regForm.value = { serialNumber: '' }
  registerPopup.value.open()
}
async function doRegister() {
  if (!regForm.value.serialNumber.trim()) {
    uni.showToast({ title: '请输入序列号', icon: 'none' })
    return
  }
  try {
    await http.post('/boxes/register', { ...regForm.value, type: 'classroom', schoolId })
    uni.showToast({ title: '注册成功', icon: 'success' })
    registerPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '注册失败', icon: 'none' })
  }
}

function openAssign(box: any) {
  currentBox.value = box
  assignIdx.value = rooms.value.findIndex((r) => r.id === box.roomId)
  assignPopup.value.open()
}
function pickAssign(e: any) {
  assignIdx.value = Number(e.detail.value)
}
async function doAssign() {
  if (!currentBox.value) return
  if (assignIdx.value < 0) {
    uni.showToast({ title: '请选择教室', icon: 'none' })
    return
  }
  const roomId = rooms.value[assignIdx.value].id
  try {
    await http.put('/boxes/' + currentBox.value.id + '/assign-room', { roomId })
    uni.showToast({ title: '分配成功', icon: 'success' })
    assignPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '分配失败', icon: 'none' })
  }
}

onShow(() => {
  load()
  // OTA tab 激活状态下重新可见时同步刷新发布历史
  if (tab.value === 'ota') loadReleases()
})
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; margin-bottom: 14px; }
.seg-item { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; color: #6b7280; border-radius: 6px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }
.serial { font-family: Consolas, monospace; color: #4a4a4a; font-size: 13px; }
.op { font-size: 13px; color: #1e3a5f; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }
.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.info { background: #dbeafe; color: #2563a8; }
.tag.warn { background: #fef3c7; color: #b45309; }
.tag.err { background: #fee2e2; color: #c0392b; }

/* OTA 管理区域 */
.ota-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.picker-box.small { min-width: 110px; padding: 8px 12px; font-size: 13px; }
.ota-form { border: 1px solid #eef0f2; border-radius: 10px; padding: 14px 16px 16px; margin-top: 18px; }
.ota-form-title { font-size: 14px; font-weight: 600; color: #2b2b2b; margin-bottom: 4px; }
.ota-submit { margin-top: 16px; }
.ota-submit.danger { background: #8b3a3a; }
.gap-left { margin-left: 12px; }

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
