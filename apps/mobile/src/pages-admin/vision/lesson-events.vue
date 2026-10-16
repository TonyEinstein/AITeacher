<template>
  <AdminLayout title="课堂违纪事件">
    <view class="panel filter-panel">
      <view class="filter-row">
        <text class="filter-label">课次记录 ID</text>
        <input class="id-input" type="number" v-model="lessonRecordId" />
        <button class="mini-btn" @click="loadData">查询</button>
      </view>
    </view>

    <view v-if="events.length" class="panel">
      <view class="panel-title">违纪事件时间线（共 {{ events.length }} 条）</view>
      <view class="timeline">
        <view v-for="evt in events" :key="evt.id" class="tl-item">
          <view class="tl-dot" :class="evt.category === 'violation' ? 'danger' : 'primary'"></view>
          <view class="tl-body">
            <view class="tl-time">{{ fmtTime(evt.startTime) }}</view>
            <view class="event-head">
              <text class="tag" :class="behaviorClass(evt.type)">{{ behaviorLabel(evt.type) }}</text>
              <text class="meta">ID: {{ evt.edgeTrackId || '-' }}</text>
              <text class="meta">置信度 {{ Math.round((evt.confidence || 0) * 100) }}%</text>
              <text v-if="evt.durationSec" class="dur">持续 {{ evt.durationSec }}s</text>
            </view>
            <view v-if="parseShots(evt.snapshotUrls).length" class="shots">
              <image
                v-for="(url, i) in parseShots(evt.snapshotUrls)"
                :key="i"
                :src="url"
                class="shot"
                mode="aspectFill"
                @click="preview(evt, i)"
              />
            </view>
            <view v-if="evt.videoUrl" class="video-link" @click="copyVideo(evt.videoUrl)">查看违纪视频</view>
          </view>
        </view>
      </view>
    </view>
    <view v-else-if="!loading" class="panel empty-panel">
      <text class="empty">暂无违纪事件</text>
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { http } from '@/utils/request'

const lessonRecordId = ref<any>(1)
const loading = ref(false)
const events = ref<any[]>([])

function fmtTime(t: string) {
  if (!t) return ''
  const x = new Date(t)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') +
    ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0') + ':' + String(x.getSeconds()).padStart(2, '0')
}

const violationTypes = ['sleeping', 'using_phone', 'talking', 'eating', 'leaving_seat', 'walking']
function behaviorLabel(type: string) {
  return ({
    focus: '专注', hand_raise: '举手', writing: '写字', standing: '起立',
    sleeping: '睡觉', using_phone: '玩手机', talking: '交头接耳',
    eating: '吃东西', leaving_seat: '离开座位', walking: '走动',
  } as any)[type] || type
}
function behaviorClass(type: string) {
  return violationTypes.includes(type) ? 'err' : 'ok'
}

function parseShots(s: any): string[] {
  if (!s) return []
  if (Array.isArray(s)) return s
  try {
    const p = JSON.parse(s)
    return Array.isArray(p) ? p : []
  } catch (e) {
    return []
  }
}
function preview(evt: any, i: number) {
  const urls = parseShots(evt.snapshotUrls)
  uni.previewImage({ current: i, urls })
}
function copyVideo(url: string) {
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url })
  // #endif
}

async function loadData() {
  if (!lessonRecordId.value) return
  loading.value = true
  try {
    const res: any = await http.get('/vision/lessons/' + lessonRecordId.value + '/events', { limit: 100 })
    events.value = res?.data || res || []
  } catch (e) {
    events.value = []
  } finally {
    loading.value = false
  }
}

onShow(() => loadData())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); margin-bottom: 16px; }
.filter-panel { padding: 14px 16px; }
.filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-label { font-size: 14px; color: #606266; }
.id-input { width: 150px; background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.panel-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }

.timeline { padding-left: 4px; }
.tl-item { display: flex; gap: 14px; position: relative; padding-bottom: 20px; }
.tl-item:not(:last-child)::before {
  content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: #e8eaed;
}
.tl-dot { width: 16px; height: 16px; border-radius: 50%; margin-top: 3px; z-index: 1; flex-shrink: 0; }
.tl-dot.danger { background: #f56c6c; }
.tl-dot.primary { background: #409eff; }
.tl-body { flex: 1; }
.tl-time { font-size: 12px; color: #909399; margin-bottom: 6px; }
.event-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.meta { font-size: 12px; color: #909399; }
.dur { font-size: 12px; color: #e6a23c; }
.shots { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.shot { width: 88px; height: 66px; border-radius: 6px; }
.video-link { font-size: 13px; color: #2563a8; margin-top: 10px; }

.empty-panel { text-align: center; }
.empty { color: #999; font-size: 13px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.ok { background: #d1fae5; color: #0f8a5f; }
.tag.err { background: #fee2e2; color: #c0392b; }
</style>
