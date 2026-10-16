<template>
  <AdminLayout title="官网设置">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">官网公开配置</text>
        <button class="mini-btn" @click="save">保存配置</button>
      </view>
      <view class="tip">配置保存后官网实时生效：ICP 备案号留空则官网页脚隐藏备案位；电话/微信/工作时间/数据背书数值由官网直接读取展示。</view>

      <view class="group-title">合规（备案）</view>
      <text class="f-label">ICP 备案号</text>
      <uni-easyinput v-model="form.icpNo" placeholder="如：粤ICP备xxxxxxxx号（未备案请留空）" />
      <view class="form-tip">留空时官网页脚不显示备案信息；备案通过后在此填写即可，无需改官网代码。</view>

      <view class="group-title">联系方式</view>
      <text class="f-label">咨询电话</text>
      <uni-easyinput v-model="form.contactPhone" placeholder="400-xxx-xxxx" />
      <text class="f-label">工作时间</text>
      <uni-easyinput v-model="form.workHours" placeholder="周一至周五 9:00–18:00" />
      <text class="f-label">微信公众号</text>
      <uni-easyinput v-model="form.wechatName" placeholder="AI Teacher" />
      <text class="f-label">二维码图片 URL</text>
      <uni-easyinput v-model="form.qrCodeUrl" placeholder="微信二维码图片地址，留空则不展示二维码" />

      <view class="group-title">数据背书（首页展示，请填真实运营数据）</view>
      <text class="f-label">已服务学校数</text>
      <uni-easyinput v-model="form.schoolsCount" placeholder="如：10+" />
      <text class="f-label">覆盖学生数</text>
      <uni-easyinput v-model="form.studentsCount" placeholder="如：5,000+" />
      <text class="f-label">节支成本</text>
      <uni-easyinput v-model="form.costSave" placeholder="如：60%" />
    </view>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { http } from '@/utils/request'

const form = ref({
  icpNo: '', contactPhone: '', workHours: '', wechatName: '',
  qrCodeUrl: '', schoolsCount: '', studentsCount: '', costSave: '',
})

async function load() {
  try {
    const res: any = await http.get('/site-config')
    if (res) {
      form.value = {
        icpNo: res.icpNo || '', contactPhone: res.contactPhone || '',
        workHours: res.workHours || '', wechatName: res.wechatName || '',
        qrCodeUrl: res.qrCodeUrl || '', schoolsCount: res.schoolsCount || '',
        studentsCount: res.studentsCount || '', costSave: res.costSave || '',
      }
    }
  } catch (e) { /* 未配置为空表单 */ }
}

async function save() {
  try {
    await http.put('/site-config', { ...form.value })
    uni.showToast({ title: '保存成功，官网已生效', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' })
  }
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 18px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); max-width: 760px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.panel-title { font-size: 15px; font-weight: 600; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.tip { font-size: 12px; color: #2563a8; background: #eff6ff; border-radius: 8px; padding: 10px 12px; line-height: 1.6; margin-bottom: 8px; }
.group-title { font-size: 14px; font-weight: 600; color: #1e3a5f; border-left: 3px solid #1e3a5f; padding-left: 10px; margin: 22px 0 6px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.form-tip { font-size: 12px; color: #7a8a96; line-height: 1.6; margin-top: 6px; }
</style>
