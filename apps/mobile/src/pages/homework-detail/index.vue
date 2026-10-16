<template>
  <view class="container" v-if="detail">
    <view class="card">
      <view class="title">{{ detail.title }}</view>
      <view class="meta">科目：{{ detail.lessonPlan?.subject?.name || '未分类' }}</view>
      <view class="meta">截止：{{ fmtDate(detail.dueDate) || '未设置' }}</view>
      <view class="desc" v-if="questions.length">
        <view v-for="(q, i) in questions" :key="i" class="q-line">{{ i + 1 }}. {{ q }}</view>
      </view>
      <view class="desc" v-else>暂无说明</view>
    </view>

    <view class="card" v-if="detail.submissions && detail.submissions.length > 0">
      <view class="section-title">我的提交</view>
      <view class="meta">提交时间：{{ detail.submissions[0].createdAt }}</view>
      <view class="meta">状态：{{ detail.submissions[0].status || '已提交' }}</view>
    </view>

    <view class="card">
      <view class="section-title">提交作业</view>
      <view class="img-row">
        <view v-for="(img, i) in images" :key="i" class="img-item" @click="removeImage(i)">
          <image :src="img" mode="aspectFill" class="img" />
          <view class="img-del">×</view>
        </view>
        <view class="img-add" v-if="images.length < 9" @click="chooseImage">+</view>
      </view>
      <button class="btn" :loading="submitting" :disabled="images.length === 0" @click="submit">提交作业</button>
      <view class="tip">支持拍照或从相册选择（最多 9 张）</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { http } from '@/utils/request'
import { uploadFile } from '@/utils/upload'
import { getStudentId } from '@/utils/student'

const id = ref(0)
const detail = ref<any>(null)
const images = ref<string[]>([])
const submitting = ref(false)

const questions = computed<string[]>(() => {
  const c = detail.value?.content
  if (c && typeof c === 'object' && Array.isArray(c.questions)) return c.questions
  return []
})

function fmtDate(s: string) {
  return s ? s.slice(0, 16).replace('T', ' ') : ''
}

onLoad((query) => {
  id.value = Number(query?.id || 0)
  load()
})

async function load() {
  try {
    detail.value = await http.get<any>('/assignments/' + id.value)
  } catch (e) {
    uni.showToast({ title: '作业详情加载失败', icon: 'none' })
  }
}

function chooseImage() {
  uni.chooseImage({
    count: 9 - images.value.length,
    success: (res) => {
      images.value.push(...res.tempFilePaths)
    },
  })
}

function removeImage(i: number) {
  images.value.splice(i, 1)
}

async function submit() {
  const studentId = getStudentId()
  if (!studentId) return
  if (submitting.value) return
  submitting.value = true
  try {
    // 逐张提交（后端为 multipart 文件上传，字段名 file）
    for (const filePath of images.value) {
      await uploadFile({
        url: '/assignments/' + id.value + '/submit/' + studentId,
        filePath,
        name: 'file',
      })
    }
    uni.showToast({ title: '提交成功', icon: 'success' })
    images.value = []
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
  background: #f5f6fa;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 12rpx;
}

.meta {
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 8rpx;
}

.desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.6;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.img-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.img-item,
.img-add {
  width: 180rpx;
  height: 180rpx;
  border-radius: 12rpx;
  position: relative;
  overflow: hidden;
}

.img {
  width: 100%;
  height: 100%;
}

.img-del {
  position: absolute;
  right: 0;
  top: 0;
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 0 0 0 12rpx;
}

.img-add {
  background: #f3f4f6;
  border: 2rpx dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  color: #9ca3af;
}

.btn {
  background: #1e3a5f;
  color: #fff;
  border-radius: 12rpx;
}

.tip {
  margin-top: 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
