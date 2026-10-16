<template>
  <AdminLayout title="巡课旁听">
    <view class="live-wrap">
      <!-- 视频区 -->
      <view class="video-col">
        <view v-if="!watching" class="video-box">
          <text class="video-tip">选择右侧教室开始巡课</text>
        </view>
        <view v-else class="video-box">
          <!-- #ifdef H5 -->
          <video v-if="stream.hls" :src="stream.hls" class="video-el" controls autoplay object-fit="contain" />
          <text v-else class="video-tip">暂无拉流地址</text>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <live-player v-if="stream.flv" :src="stream.flv" class="video-el" mode="live" autoplay object-fit="contain" />
          <video v-else-if="stream.hls" :src="stream.hls" class="video-el" controls object-fit="contain" />
          <text v-else class="video-tip">暂无拉流地址</text>
          <!-- #endif -->
        </view>
        <view v-if="watching" class="stream-meta">
          <text class="meta-line">FLV：{{ stream.flv || '-' }}</text>
          <text class="meta-line">HLS：{{ stream.hls || '-' }}</text>
        </view>
      </view>

      <!-- 侧栏 -->
      <view class="side-col">
        <text class="f-label">选择教室</text>
        <picker :range="roomLabels" :value="roomIdx" @change="pickRoom">
          <view class="picker-box">{{ roomIdx >= 0 && roomLabels.length ? roomLabels[roomIdx] : '选择教室' }}</view>
        </picker>
        <button class="mini-btn full" @click="startWatch">开始巡课</button>

        <view class="divider"></view>
        <text class="side-title">在线课堂</text>
        <view v-for="r in rooms" :key="r.id" class="room-line">
          <text class="room-name">{{ r.name }}</text>
          <text class="tag ok">在线</text>
        </view>
        <view v-if="!rooms.length" class="empty">暂无教室</view>
      </view>
    </view>

    <!-- B6 桌位求助提醒：学生按求助键时弹出，可关闭 -->
    <view v-if="helpAlert" class="help-mask">
      <view class="help-card">
        <view class="help-title">
          <text class="help-badge">求助</text>
          <text class="help-close" @click="closeHelpAlert">✕</text>
        </view>
        <view class="help-seat">{{ helpAlert.seatNo ? '桌位 ' + helpAlert.seatNo : '未标桌位' }}</view>
        <view class="help-meta">{{ helpStudentText }}</view>
        <view class="help-meta" v-if="helpAlert.deviceSerial">设备：{{ helpAlert.deviceSerial }}</view>
        <button class="help-btn" @click="closeHelpAlert">知道了</button>
      </view>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'
import { watchHelpKey, type HelpKeyData } from '@/utils/realtime'

const schoolId = Number(uni.getStorageSync('active_school_id')) || getUser()?.schoolId || 1

const rooms = ref<any[]>([])
const roomLabels = ref<string[]>([])
const roomIdx = ref(-1)
const watching = ref(false)
const stream = ref<any>({})

// ===== B6 桌位求助提醒 =====
// 学生按桌位求助键 → 后端 /ws 推 help_key_notice（盒子）/ classroom_event{help_key}（旁听者）。
// 本页是 mobile 端唯一有 WS 监听基础设施的页面（巡课旁听），弹窗挂这里；
// 教室盒子本体（classroom-client）不在本次改动范围（只动 apps/ 下文件）。
const helpAlert = ref<HelpKeyData | null>(null)
let helpWatcher: { disconnect: () => void } | null = null

const helpStudentText = computed(() => {
  const d = helpAlert.value
  if (!d) return ''
  return d.studentId ? '学生 #' + d.studentId : '未绑定学生（匿名桌位键）'
})

function closeHelpAlert() {
  helpAlert.value = null
}

onUnmounted(() => {
  // 离开页面断开求助监听，避免泄漏
  helpWatcher?.disconnect()
  helpWatcher = null
})

async function load() {
  try {
    const res: any = await http.get('/rooms', { schoolId })
    rooms.value = Array.isArray(res) ? res : (res?.list || [])
    roomLabels.value = rooms.value.map((r) => r.name + '（' + r.code + '）')
  } catch (e) {
    rooms.value = []
  }
}

function pickRoom(e: any) {
  roomIdx.value = Number(e.detail.value)
}
async function startWatch() {
  if (roomIdx.value < 0) {
    uni.showToast({ title: '请选择教室', icon: 'none' })
    return
  }
  const room = rooms.value[roomIdx.value]
  const roomId = room.id
  try {
    stream.value = await http.get('/live/pull/room/' + roomId)
    watching.value = true
    // 开始巡课时挂上桌位求助监听：用该教室盒子的序列号（rooms 接口已 include boxes）
    startHelpWatch(room)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '获取拉流失败', icon: 'none' })
  }
}

/** 挂载桌位求助 WS 监听（重复调用先断开旧连接） */
function startHelpWatch(room: any) {
  helpWatcher?.disconnect()
  helpWatcher = null
  // 教室盒子序列号：classroom 型盒子优先，没有则取第一个盒子
  const boxes: any[] = room?.boxes || []
  const box = boxes.find((b) => b.type === 'classroom') || boxes[0]
  if (!box?.serialNumber) return
  helpWatcher = watchHelpKey(box.serialNumber, (data) => {
    // 弹提醒：桌位号 + 学生标识（新事件覆盖旧弹窗）
    helpAlert.value = { ...data }
  })
}

onShow(() => load())
</script>

<style>
.live-wrap { display: flex; gap: 16px; flex-wrap: wrap; }
.video-col { flex: 2; min-width: 300px; }
.side-col { flex: 1; min-width: 260px; background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }

.video-box {
  background: #000; height: 56vh; min-height: 300px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.video-el { width: 100%; height: 100%; }
.video-tip { color: #9aa; font-size: 14px; }
.stream-meta { margin-top: 10px; }
.meta-line { display: block; font-size: 12px; color: #6b7280; word-break: break-all; margin-bottom: 4px; }

.f-label { display: block; font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 16px; font-size: 14px; color: #4a4a4a; margin-bottom: 12px; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 14px; border-radius: 8px; margin: 0; }
.mini-btn.full { width: 100%; }
.divider { height: 1px; background: #f0f0f0; margin: 16px 0; }
.side-title { font-size: 14px; font-weight: 600; color: #2b2b2b; display: block; margin-bottom: 10px; }
.room-line { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #f6f6f6; }
.room-name { font-size: 14px; color: #3a3a3a; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 18px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }

/* ===== B6 桌位求助提醒弹窗 ===== */
.help-mask {
  position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
}
.help-card {
  width: 340px; max-width: 86vw;
  background: #fff; border-radius: 14px; padding: 20px 22px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  border-top: 4px solid #f59e0b;
}
.help-title {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.help-badge {
  font-size: 14px; font-weight: 700; color: #b45309;
  background: #fef3c7; border-radius: 6px; padding: 3px 12px;
}
.help-close {
  font-size: 16px; color: #9aa; cursor: pointer; padding: 2px 6px;
}
.help-seat {
  font-size: 26px; font-weight: 700; color: #1e3a5f; margin-bottom: 6px;
}
.help-meta { font-size: 14px; color: #6b7280; margin-top: 4px; }
.help-btn {
  margin-top: 18px; background: #1e3a5f; color: #fff;
  font-size: 14px; border-radius: 8px;
}
</style>
