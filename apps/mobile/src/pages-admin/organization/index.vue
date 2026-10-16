<template>
  <AdminLayout title="组织架构">
    <!-- tab 切换 -->
    <view class="tabs">
      <view v-for="t in tabs" :key="t.key" class="tab" :class="{ on: active === t.key }" @click="switchTab(t.key)">
        {{ t.label }}
      </view>
    </view>

    <!-- 年级班级 -->
    <view v-if="active === 'grades'" class="panel">
      <view class="panel-head">
        <text class="panel-title">年级与班级</text>
        <button class="mini-btn" @click="openGrade">新增年级</button>
      </view>
      <SimpleTable :columns="gradeCols" :rows="grades">
        <template #cell-classes="{ row }">{{ row.classes?.length || 0 }}</template>
        <template #cell-op="{ row }">
          <text class="op" @click="viewClasses(row)">查看班级</text>
        </template>
      </SimpleTable>
      <view v-if="!grades.length" class="empty">暂无年级</view>
    </view>

    <!-- 学生管理 -->
    <view v-if="active === 'students'" class="panel">
      <view class="panel-head">
        <picker :range="classNames" :value="classIdx" @change="pickClass">
          <view class="picker-box">{{ classIdx >= 0 && classNames.length ? classNames[classIdx] : '请先查看班级' }}</view>
        </picker>
        <button class="mini-btn" @click="openStudent">新增学生</button>
      </view>
      <SimpleTable :columns="studentCols" :rows="students">
        <template #cell-gender="{ value }">{{ genderText(value) }}</template>
        <template #cell-op="{ row }">
          <text class="op danger" @click="removeStudent(row)">删除</text>
        </template>
      </SimpleTable>
      <view v-if="!students.length" class="empty">该班级暂无学生</view>
    </view>

    <!-- 管理员账号 -->
    <view v-if="active === 'users'" class="panel">
      <view class="panel-head"><text class="panel-title">管理员账号</text></view>
      <SimpleTable :columns="userCols" :rows="users">
        <template #cell-role="{ value }">{{ roleText(value) }}</template>
        <template #cell-email="{ value }">{{ value || '-' }}</template>
      </SimpleTable>
      <view v-if="!users.length" class="empty">暂无管理员</view>
    </view>

    <!-- 新增年级弹窗 -->
    <uni-popup ref="gradePopup" type="center">
      <view class="dialog sm">
        <view class="dialog-title">新增年级</view>
        <view class="dialog-body">
          <uni-easyinput v-model="gradeForm.name" placeholder="年级名称，如：高一" />
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="gradePopup.close()">取消</button>
          <button class="d-btn ok" @click="addGrade">确定</button>
        </view>
      </view>
    </uni-popup>

    <!-- 新增学生弹窗 -->
    <uni-popup ref="studentPopup" type="center">
      <view class="dialog sm">
        <view class="dialog-title">新增学生</view>
        <view class="dialog-body">
          <view class="f-item"><text class="f-label">学号</text>
            <uni-easyinput v-model="studentForm.studentNo" placeholder="学号" /></view>
          <view class="f-item"><text class="f-label">姓名</text>
            <uni-easyinput v-model="studentForm.name" placeholder="姓名" /></view>
          <view class="f-item"><text class="f-label">性别</text>
            <picker :range="['男', '女']" :value="studentForm.gender === 'female' ? 1 : 0" @change="pickGender">
              <view class="picker-box">{{ studentForm.gender === 'female' ? '女' : '男' }}</view>
            </picker>
          </view>
        </view>
        <view class="dialog-foot">
          <button class="d-btn cancel" @click="studentPopup.close()">取消</button>
          <button class="d-btn ok" @click="addStudent">确定</button>
        </view>
      </view>
    </uni-popup>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import SimpleTable from '@/components/admin/SimpleTable.vue'
import { http } from '@/utils/request'
import { getUser } from '@/utils/auth'
import { ROLE_TEXT } from '@/config/admin-menus'

const schoolId = getUser()?.schoolId || 1
const tabs = [
  { key: 'grades', label: '年级班级' },
  { key: 'students', label: '学生管理' },
  { key: 'users', label: '管理员账号' },
]
const active = ref('grades')

const grades = ref<any[]>([])
const users = ref<any[]>([])
const students = ref<any[]>([])
const currentClasses = ref<any[]>([])
const classIdx = ref(-1)

const gradePopup = ref<any>(null)
const studentPopup = ref<any>(null)
const gradeForm = ref({ name: '' })
const studentForm = ref({ studentNo: '', name: '', gender: 'male' })

const gradeCols = [
  { key: 'name', title: '年级名称', minWidth: '160px' },
  { key: 'classes', title: '班级数', width: '90px' },
  { key: 'op', title: '操作', width: '120px' },
]
const studentCols = [
  { key: 'studentNo', title: '学号', minWidth: '130px' },
  { key: 'name', title: '姓名', width: '100px' },
  { key: 'gender', title: '性别', width: '80px' },
  { key: 'op', title: '操作', width: '90px' },
]
const userCols = [
  { key: 'username', title: '用户名', minWidth: '140px' },
  { key: 'name', title: '姓名', width: '120px' },
  { key: 'role', title: '角色', width: '120px' },
  { key: 'email', title: '邮箱', minWidth: '160px' },
]

const classNames = computed(() => currentClasses.value.map((c) => c.name))

function switchTab(k: string) {
  active.value = k
}

function genderText(g: string) {
  return g === 'male' ? '男' : g === 'female' ? '女' : '-'
}
function roleText(r: string) {
  return ROLE_TEXT[r] || r
}

function viewClasses(grade: any) {
  currentClasses.value = grade.classes || []
  if (currentClasses.value.length) {
    classIdx.value = 0
    loadStudents(currentClasses.value[0].id)
  } else {
    students.value = []
    classIdx.value = -1
  }
  active.value = 'students'
}

function pickClass(e: any) {
  classIdx.value = Number(e.detail.value)
  const c = currentClasses.value[classIdx.value]
  if (c) loadStudents(c.id)
}

async function loadStudents(classId: number) {
  try {
    const res: any = await http.get('/students', { classId })
    students.value = Array.isArray(res) ? res : res?.list || []
  } catch (e) {
    students.value = []
  }
}

async function load() {
  try {
    const g: any = await http.get('/grades', { schoolId })
    grades.value = Array.isArray(g) ? g : g?.list || []
    const u: any = await http.get('/users', { schoolId })
    users.value = Array.isArray(u) ? u : u?.list || []
  } catch (e) {
    // 静默
  }
}

function openGrade() {
  gradeForm.value = { name: '' }
  gradePopup.value.open()
}
async function addGrade() {
  if (!gradeForm.value.name) {
    uni.showToast({ title: '请输入年级名称', icon: 'none' })
    return
  }
  try {
    await http.post('/grades', { name: gradeForm.value.name, schoolId })
    uni.showToast({ title: '添加成功', icon: 'success' })
    gradePopup.value.close()
    load()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '添加失败', icon: 'none' })
  }
}

function openStudent() {
  if (classIdx.value < 0 || !currentClasses.value.length) {
    uni.showToast({ title: '请先在年级班级中查看班级', icon: 'none' })
    return
  }
  studentForm.value = { studentNo: '', name: '', gender: 'male' }
  studentPopup.value.open()
}
function pickGender(e: any) {
  studentForm.value.gender = Number(e.detail.value) === 1 ? 'female' : 'male'
}
async function addStudent() {
  const f = studentForm.value
  if (!f.studentNo || !f.name) {
    uni.showToast({ title: '请填写学号和姓名', icon: 'none' })
    return
  }
  const classId = currentClasses.value[classIdx.value]?.id
  try {
    await http.post('/students', { ...f, classId })
    uni.showToast({ title: '添加成功', icon: 'success' })
    studentPopup.value.close()
    loadStudents(classId)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '添加失败', icon: 'none' })
  }
}

function removeStudent(row: any) {
  uni.showModal({
    title: '删除确认',
    content: `确认删除学生「${row.name}」吗？`,
    confirmColor: '#c0392b',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await http.delete('/students/' + row.id)
        uni.showToast({ title: '删除成功', icon: 'success' })
        const classId = currentClasses.value[classIdx.value]?.id
        loadStudents(classId)
      } catch (e: any) {
        uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

onShow(() => load())
</script>

<style>
.tabs {
  display: flex;
  background: #e5e7eb;
  border-radius: 10px;
  padding: 5px;
  margin-bottom: 16px;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 14px 0;
  font-size: 14px;
  color: #6b7280;
  border-radius: 8px;
}
.tab.on {
  background: #fff;
  color: #1e3a5f;
  font-weight: 600;
}

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
}
.panel-title { font-size: 15px; font-weight: 600; color: #2b2b2b; }
.mini-btn {
  background: #1e3a5f;
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  margin: 0;
}
.picker-box {
  background: #fafbfc;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 14px;
  color: #4a4a4a;
  min-width: 160px;
}
.op { font-size: 13px; color: #1e3a5f; }
.op.danger { color: #c0392b; }
.empty { text-align: center; color: #999; font-size: 13px; padding: 20px; }

.dialog {
  width: 520px; max-width: 92vw;
  background: #fff; border-radius: 14px;
}
.dialog.smile { width: 420px; }
.dialog-title { font-size: 16px; font-weight: 600; padding: 18px 22px; border-bottom: 1px solid #f0f0f0; }
.dialog-body { padding: 20px 22px; }
.f-item { margin-bottom: 16px; }
.f-label { display: block; font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 22px; }
.d-btn { font-size: 14px; border-radius: 8px; padding: 8px 24px; margin: 0; }
.d-btn.cancel { background: #f0f0f0; color: #555; }
.d-btn.ok { background: #1e3a5f; color: #fff; }
</style>
