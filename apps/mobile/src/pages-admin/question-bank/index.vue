<template>
  <AdminLayout title="学科题库">
    <view class="panel">
      <view class="panel-head">
        <text class="panel-title">题目列表</text>
        <button class="mini-btn" @click="openAdd">新增题目</button>
      </view>

      <view class="filters">
        <picker :range="difficultyOptions" :value="filter.difficulty || 0" @change="pickDifficulty">
          <view class="picker-box small">{{ difficultyOptions[filter.difficulty || 0] }}</view>
        </picker>
        <view class="search-box">
          <uni-easyinput v-model="filter.knowledgePoint" placeholder="知识点搜索" @confirm="load" />
        </view>
        <button class="mini-btn ghost" @click="load">搜索</button>
      </view>

      <SimpleTable :columns="cols" :rows="list">
        <template #cell-question="{ value }">{{ value }}</template>
        <template #cell-type="{ value }">{{ typeText(value) }}</template>
        <template #cell-knowledgePoint="{ value }">{{ value || '-' }}</template>
        <template #cell-difficulty="{ value }">
          <text class="stars">{{ '★'.repeat(value) }}{{ '☆'.repeat(Math.max(0, 5 - value)) }}</text>
        </template>
        <template #cell-op="{ row }">
          <text class="op danger" @click="remove(row)">删除</text>
        </template>
      </SimpleTable>
      <view v-if="!list.length" class="empty">暂无题目</view>
    </view>

    <!-- 新增题目 -->
    <uni-popup ref="addPopup" type="center">
      <view class="dialog">
        <view class="dialog-title">新增题目</view>
        <view class="dialog-body">
          <text class="f-label">题目</text>
          <uni-easyinput v-model="form.question" type="textarea" :maxlength="500" placeholder="请输入题干" />
          <text class="f-label">题型</text>
          <view class="seg">
            <view v-for="t in types" :key="t.v" class="seg-item" :class="{ on: form.type === t.v }" @click="form.type = t.v">{{ t.t }}</view>
          </view>
          <text class="f-label">答案</text>
          <uni-easyinput v-model="form.answer" type="textarea" :maxlength="300" placeholder="参考答案" />
          <text class="f-label">知识点</text>
          <uni-easyinput v-model="form.knowledgePoint" placeholder="如：光合作用" />
          <text class="f-label">难度</text>
          <Stepper v-model="form.difficulty" :min="1" :max="5" :step="1" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="addPopup.close()">取消</button>
          <button class="d-btn ok" @click="doAdd">保存</button>
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

const list = ref<any[]>([])
const addPopup = ref<any>(null)
const filter = ref<any>({ difficulty: 0, knowledgePoint: '' })
const form = ref<any>({ subjectId: 2, question: '', type: 'choice', answer: '', difficulty: 3, knowledgePoint: '' })

const difficultyOptions = ['全部难度', '1星难度', '2星难度', '3星难度', '4星难度', '5星难度']
const types = [
  { v: 'choice', t: '选择题' },
  { v: 'fill', t: '填空题' },
  { v: 'essay', t: '简答题' },
  { v: 'calculation', t: '计算题' },
]

const cols = [
  { key: 'question', title: '题目', minWidth: '200px' },
  { key: 'type', title: '题型', width: '90px' },
  { key: 'knowledgePoint', title: '知识点', width: '140px' },
  { key: 'difficulty', title: '难度', width: '130px' },
  { key: 'op', title: '操作', width: '80px' },
]

function typeText(t: string) {
  return ({ choice: '选择题', fill: '填空题', essay: '简答题', calculation: '计算题' } as any)[t] || t
}

function pickDifficulty(e: any) {
  filter.value.difficulty = Number(e.detail.value)
  load()
}

async function load() {
  const params: any = {}
  if (filter.value.difficulty > 0) params.difficulty = filter.value.difficulty
  if (filter.value.knowledgePoint) params.knowledgePoint = filter.value.knowledgePoint
  try {
    const res: any = await http.get('/question-bank', params)
    list.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    list.value = []
  }
}

function openAdd() {
  form.value = { subjectId: 2, question: '', type: 'choice', answer: '', difficulty: 3, knowledgePoint: '' }
  addPopup.value.open()
}
async function doAdd() {
  if (!form.value.question.trim()) {
    uni.showToast({ title: '请输入题干', icon: 'none' })
    return
  }
  try {
    await http.post('/question-bank', form.value)
    uni.showToast({ title: '已添加', icon: 'success' })
    addPopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '添加失败', icon: 'none' })
  }
}

function remove(row: any) {
  uni.showModal({
    title: '确认删除',
    content: '确定删除该题目？此操作不可恢复',
    confirmColor: '#c0392b',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.delete('/question-bank/' + row.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        load()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

onShow(() => load())
</script>

<style>
.panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; }
.mini-btn { background: #1e3a5f; color: #fff; font-size: 13px; border-radius: 8px; margin: 0; }
.mini-btn.ghost { background: #f0f0f0; color: #4a4a4a; }

.filters { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
.picker-box { background: #fafbfc; border: 1px solid #dcdfe6; border-radius: 8px; padding: 9px 16px; font-size: 14px; color: #4a4a4a; }
.picker-box.small { min-width: 120px; padding: 9px 12px; }
.search-box { flex: 1; min-width: 200px; }

.op { font-size: 13px; color: #1e3a5f; }
.op.danger { color: #c0392b; }
.stars { color: #f5a623; font-size: 14px; letter-spacing: 1px; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 24px; }

.dialog { width: 520px; max-width: 92vw; background: #fff; border-radius: 14px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 18px 22px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin: 12px 0 8px; }
.seg { display: flex; background: #eef0f2; border-radius: 8px; padding: 4px; flex-wrap: wrap; }
.seg-item { flex: 1; text-align: center; padding: 9px 4px; font-size: 13px; color: #6b7280; border-radius: 6px; min-width: 70px; }
.seg-item.on { background: #fff; color: #1e3a5f; font-weight: 600; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; border-top: 1px solid #f0f0f0; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
