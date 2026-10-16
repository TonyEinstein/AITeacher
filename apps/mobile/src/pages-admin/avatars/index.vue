<template>
  <AdminLayout title="数字人形象">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">数字人形象管理</text>
        <button class="mini-btn" @click="openCustom">学校定制（另收费）</button>
      </view>
      <SimpleTable :columns="cols" :rows="list">
        <template #cell-name="{ value }">{{ value }}</template>
        <template #cell-gender="{ value }">{{ ({ male: '男', female: '女' } as any)[value] || '-' }}</template>
        <template #cell-subject="{ value }">{{ value || '-' }}</template>
        <template #cell-modelType="{ value }">{{ value === '2d' ? '2D' : '3D' }}</template>
        <template #cell-isCustom="{ value }">
          <text class="tag" :class="value ? 'warn' : 'info'">{{ value ? '学校定制' : '通用' }}</text>
        </template>
        <template #cell-price="{ value }">{{ value ? '¥' + value : '-' }}</template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无数字人形象，可点右上角提交学校定制需求</view>
    </view>

    <uni-popup ref="customPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">学校定制数字人</view>
        <view class="dialog-body">
          <text class="f-label">名称</text>
          <uni-easyinput v-model="form.name" placeholder="如：数学小艾老师" />
          <text class="f-label">性别</text>
          <picker :range="genderOptions" :value="genderIdx" @change="pickGender">
            <view class="picker-box">{{ genderOptions[genderIdx] }}</view>
          </picker>
          <text class="f-label">科目</text>
          <uni-easyinput v-model="form.subject" placeholder="如 数学老师" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="customPopup.close()">取消</button>
          <button class="d-btn ok" @click="doCustom">提交定制需求</button>
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

// 学校归属：active_school_id 优先，其次登录用户自身 schoolId（与其他管理页一致）
const schoolId =
  Number(uni.getStorageSync('active_school_id')) || Number(getUser()?.schoolId) || 1
const list = ref<any[]>([])
const customPopup = ref<any>(null)
const form = ref({ name: '', gender: 'female', subject: '' })
const genderOptions = ['女', '男']
const genderValues = ['female', 'male']
const genderIdx = ref(0)

const cols = [
  { key: 'name', title: '形象名称', minWidth: '160px' },
  { key: 'gender', title: '性别', width: '80px' },
  { key: 'subject', title: '科目', width: '110px' },
  { key: 'modelType', title: '类型', width: '80px' },
  { key: 'isCustom', title: '定制', width: '100px' },
  { key: 'price', title: '定制加价', width: '100px' },
]

function pickGender(e: any) {
  genderIdx.value = Number(e.detail.value)
  form.value.gender = genderValues[genderIdx.value]
}

async function load() {
  try {
    list.value = await http.get('/avatars', { schoolId })
  } catch (e) { list.value = [] }
}
function openCustom() {
  form.value = { name: '', gender: 'female', subject: '' }
  genderIdx.value = 0
  customPopup.value.open()
}
async function doCustom() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请填写名称', icon: 'none' })
    return
  }
  try {
    await http.post('/avatars/custom/' + schoolId, { ...form.value, modelType: '2d' })
    uni.showToast({ title: '定制需求已提交', icon: 'success' })
    customPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  }
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 22px; }

.tag { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #eef0f2; color: #555; }
.tag.warn { background: #fef3c7; color: #b8860b; }
.tag.info { background: #dbeafe; color: #2563a8; }

.dialog { width: 460px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 14px; font-size: 14px; color: #4a4a4a; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
