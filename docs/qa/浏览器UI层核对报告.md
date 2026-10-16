# 浏览器 UI 层核对报告

> 测试时间：2026-09-22
> 测试环境：前端 http://localhost:5174（Vite dev server），后端 http://localhost:3000/api/v1
> 测试方式：Chrome 浏览器自动化点击遍历，逐菜单截图
> 截图目录：`E:\AITeacher\docs\qa\shots\`（共 39 张）
> 测试账号（密码均为 123456）：superadmin / GZ001_admin / GZ001_grade1 / GZ001_math / GZ001_teacher

---

## 一、superadmin（超级管理员）

登录后进入 `/dashboard`，左侧共 **8 个菜单项**。

| 菜单名 | 路径 | 是否正常渲染 | 数据情况 | 备注 |
|---|---|---|---|---|
| 全局概览 | /dashboard | ✅ 正常 | 5 合作学校 / 365 学生 / 45 班级 / 53% 设备在线率 | 学校规模排名、即将到期订阅、设备状态均有数据 |
| 学校管理 | /schools | ✅ 正常 | 5 所学校列表 | 见下方按钮测试；**新增提交 500 报错** |
| 学校健康 | /health | ✅ 正常 | 5 校健康分（80~90）、设备/工单/小程序状态 | 卡片信息丰富 |
| 设备监控 | /device-monitor | ✅ 正常 | 15 台设备列表（在线/离线/故障） | 故障编码 E4004/E3003/E2002/E1001 正常展示 |
| 售后工单 | /work-orders | ✅ 正常 | 8 条工单 | 见下方按钮测试 |
| 订阅管理 | /subscription | ✅ 正常 | 5 条学校订阅 | 续费/配置年限/停用操作列正常 |
| 咨询留资 | /leads | ✅ 正常 | 8 条留资 | 手机号/留言/来源齐全 |
| 全局报表 | /reports | ✅ 正常 | 学校规模排名、平台概览统计 | 与 dashboard 数据一致 |

### 按钮测试
- **新增学校**：弹窗正常弹出（学校名称/学校编码/省份/城市/状态/订阅到期/联系人/电话/备注）。
  - 空表单提交：学校名称、学校编码红框 +「请输入学校名称」「请输入学校编码」校验提示 ✅
  - 填正常数据（UI测试中学 / UITEST001）提交：**toast 报「服务器内部错误 Request failed with status code 500」，列表未刷新** ❌（BUG #1）
- **新建工单**：弹窗正常弹出（所属学校/标题/类型/优先级/故障编码/问题描述/联系人/电话），未实际提交。

### 截图
`superadmin_dashboard.png`、`superadmin_schools.png`、`superadmin_school_modal.png`、`superadmin_school_validation.png`、`superadmin_school_created_500bug.png`、`superadmin_health.png`、`superadmin_devices.png`、`superadmin_workorders.png`、`superadmin_wo_modal.png`、`superadmin_subscription.png`、`superadmin_leads.png`、`superadmin_reports.png`

---

## 二、GZ001_admin（学校管理员）

登录后进入 `/dashboard`，显示「广州市第一中学管理员 / 学校管理员」。左侧共 **15 个菜单项**。

| 菜单名 | 路径 | 是否正常渲染 | 数据情况 | 备注 |
|---|---|---|---|---|
| 首页概览 | /dashboard | ✅ 正常 | 72 学生 / 9 班级 / 3 设备 | 今日待办空态正常 |
| 组织架构 | /organization | ✅ 正常 | 高一/高二/高三 3 个年级 | 年级班级/管理员账号 Tab 正常；新增年级按钮 |
| 教材教案 | /textbooks | ✅ 正常 | 空态「暂无数据」 | 上传教材按钮正常 |
| 课表管理 | /schedules | ⚠️ 渲染但报错 | 空态 | **toast「数据越权：无权访问其他学校的数据」**（BUG #2） |
| 作业复核 | /assignments | ⚠️ 渲染但报错 | 空态 | 同样「数据越权」toast（BUG #2） |
| 考试管理 | /exams | ✅ 正常 | 空态 | 创建考试按钮正常 |
| 巡课旁听 | /live | ⚠️ 渲染但报错 | 0 在线课堂 | 视频占位框正常；「数据越权」toast（BUG #2） |
| 报表驾驶舱 | /reports | ✅ 正常 | 72 学生 / 9 班级 / 各年级分布 | 学生预警空态正常 |
| 设备管理 | /devices | ✅ 正常 | GZ001-BOX1/2/3 共 3 台 | 在线/离线状态、心跳正常 |
| 辅导管理 | /tutoring | ✅ 正常 | 空态 | 辅导订阅/穿戴设备 Tab |
| 请假审批 | /leave-approval | ⚠️ 渲染但报错 | 空态 | 「数据越权」toast（BUG #2） |
| 学科题库 | /question-bank | ✅ 正常 | 空态 | 难度筛选/知识点搜索/新增题目 |
| AI教师管理 | /agents | ✅ 正常 | 空态 | 新建 AI 教师按钮 |
| 数字人形象 | /avatars | ✅ 正常 | 空态 | 学校定制按钮 |
| 满意度问卷 | /surveys | ✅ 正常 | 空态 | 创建问卷按钮 |

### 直连 URL 验证（此前 403 已修复项）
| 路径 | 结果 | 备注 |
|---|---|---|
| /leads | ✅ 加载 | 显示 8 条全局留资（含其他学校联系人） |
| /work-orders | ✅ 加载 | 显示 8 条全局工单（含东莞/深圳等校） |
| /subscription | ✅ 加载 | 显示 5 条全局订阅 |
| /schools | ⚠️ 加载但提示 | 仅显示 1 条「测试中学」，toast 权限提示 |

> 说明：leads/work-orders/subscription 三个页面 school_admin 直连均可加载（此前 403 已修复），但展示的是**跨校全局数据**，菜单中并未暴露这三项。

### 截图
`schooladmin_dashboard.png`、`schooladmin_org.png`、`schooladmin_textbooks.png`、`schooladmin_schedule.png`、`schooladmin_homework.png`、`schooladmin_exams.png`、`schooladmin_live.png`、`schooladmin_reports.png`、`schooladmin_devices.png`、`schooladmin_tutoring.png`、`schooladmin_leave.png`、`schooladmin_questionbank.png`、`schooladmin_agents.png`、`schooladmin_avatars.png`、`schooladmin_surveys.png`、`schooladmin_leads_direct.png`、`schooladmin_workorders_direct.png`、`schooladmin_subscription_direct.png`

---

## 三、GZ001_grade1（年级管理员）

登录后显示「广州市第一中学高一年级主任 / 年级管理员」。左侧共 **11 个菜单项**（比 school_admin 少：组织架构、设备管理、辅导管理、请假审批）。

| 菜单名 | 路径 | 是否正常渲染 | 数据情况 | 备注 |
|---|---|---|---|---|
| 首页概览 | /dashboard | ✅ 正常 | 72 学生 / 9 班级 | 与 school_admin 一致 |
| 教材教案 | /textbooks | ✅ 正常 | 空态 | — |
| 课表管理 | /schedules | ⚠️ 渲染但报错 | 空态 | 「数据越权」toast |
| 作业复核 | /assignments | ⚠️ 渲染但报错 | 空态 | 「数据越权」toast |
| 考试管理 | /exams | ✅ 正常 | 空态 | — |
| 巡课旁听 | /live | ⚠️ 渲染但报错 | 空态 | 「数据越权」toast |
| 报表驾驶舱 | /reports | ⚠️ 渲染但报错 | 空态 | 「数据越权」toast |
| 学科题库 | /question-bank | ⚠️ 渲染但报错 | 空态 | 「数据越权」toast |
| AI教师管理 | /agents | ✅ 正常 | 空态 | — |
| 数字人形象 | /avatars | ✅ 正常 | 空态 | — |
| 满意度问卷 | /surveys | ✅ 正常 | 空态 | — |

### schoolOnly 菜单重定向验证（重点）
| schoolOnly 路径 | 访问后落地 URL | 结果 |
|---|---|---|
| /organization（组织架构） | /dashboard | ✅ 自动重定向 |
| /devices（设备管理） | /dashboard | ✅ 自动重定向 |
| /tutoring（辅导管理） | /dashboard | ✅ 自动重定向 |
| /leave-approval（请假审批） | /dashboard | ✅ 自动重定向 |
| /device-monitor（设备监控） | /dashboard | ✅ 自动重定向 |

> 年级管理员直连 schoolOnly 路由全部正确重定向到 /dashboard，路由守卫生效 ✅

### 截图
`gradeadmin_dashboard.png`、`gradeadmin_exams.png`、`gradeadmin_redirect_dashboard.png`

---

## 四、GZ001_math（学科管理员）

登录后显示「广州市第一中学数学教研组长 / 学科管理员」。左侧菜单与年级管理员**完全一致（11 项）**。

### schoolOnly 菜单重定向验证（重点）
| schoolOnly 路径 | 访问后落地 URL | 结果 |
|---|---|---|
| /organization（组织架构） | /dashboard | ✅ 自动重定向 |
| /devices（设备管理） | /dashboard | ✅ 自动重定向 |
| /tutoring（辅导管理） | /dashboard | ✅ 自动重定向 |
| /leave-approval（请假审批） | /dashboard | ✅ 自动重定向 |
| /device-monitor（设备监控） | /dashboard | ✅ 自动重定向 |

> 学科管理员直连 schoolOnly 路由全部正确重定向到 /dashboard，路由守卫生效 ✅
> 可见菜单页面渲染情况与年级管理员一致（课表/作业复核/巡课旁听等有「数据越权」toast）。

### 截图
`subjectadmin_dashboard.png`、`subjectadmin_redirect_dashboard.png`

---

## 五、GZ001_teacher（教师）专项

登录后显示「王老师 / 教师」。

### 实际看到的菜单（15 项，与学校管理员完全一致）
首页概览、**组织架构**、教材教案、课表管理、作业复核、考试管理、巡课旁听、报表驾驶舱、**设备管理**、**辅导管理**、**请假审批**、学科题库、AI教师管理、数字人形象、满意度问卷

### 对照 PRD
PRD 预期教师应有：课表 / 作业 / 教案 / 学生查看等教学功能。

| PRD 预期功能 | 实际情况 |
|---|---|
| 教材教案 | ✅ 菜单可见，页面正常（空态） |
| 课表管理 | ⚠️ 菜单可见，但「数据越权」toast、列表空 |
| 作业复核 | ⚠️ 菜单可见，但「数据越权」toast、列表空 |
| 学科题库 | ✅ 菜单可见，页面正常（空态） |
| 组织架构 | ❌ **PRD 不应有，但菜单可见；点进去「权限不足，无权访问此资源」** |
| 设备管理 | ❌ PRD 不应有，菜单可见；点进去权限不足 |
| 辅导管理 | ❌ PRD 不应有，菜单可见；点进去权限不足 |
| 请假审批 | ❌ PRD 不应有，菜单可见；点进去权限不足 |
| AI教师管理 / 数字人形象 / 满意度问卷 | ❌ 管理类菜单对教师可见，未见数据 |

### 关键问题
- 教师角色**菜单项与学校管理员完全相同（15 项）**，未按角色收敛。
- 组织架构/设备管理/辅导管理/请假审批这 4 个 schoolOnly 菜单对教师**可见可点**，点进去后端返回「权限不足」但前端仍渲染了空页面（而非像年级/学科管理员那样自动重定向到 /dashboard）。这是**菜单权限与路由守卫不一致**的问题（BUG #3）。

### 截图
`teacher_dashboard.png`、`teacher_org_perm.png`、`teacher_questionbank.png`

---

## 六、UI Bug 清单

| # | 严重度 | 角色/页面 | 问题描述 | 复现步骤 |
|---|---|---|---|---|
| 1 | 高 | superadmin / 学校管理-新增学校 | 填写正常数据提交，POST /schools 返回 **500 服务器内部错误**，学校未创建，弹窗不关闭 | 学校管理 → 新增学校 → 填学校名称/编码 → 确定 |
| 2 | 中 | school_admin / grade_admin / subject_admin / teacher 多页面 | 课表管理、作业复核、巡课旁听、请假审批、报表驾驶舱、学科题库等页面加载时弹出 **「数据越权：无权访问其他学校的数据」** toast，列表为空。疑似学校数据 scoping 未正确带入当前校 school_id | 登录上述任一角色 → 进入课表/作业复核等页 |
| 3 | 高 | teacher / 组织架构等 | 教师角色左侧菜单**与学校管理员完全一致（15 项）**，含组织架构/设备管理/辅导管理/请假审批；点进去后端返回「权限不足」但前端渲染空页，未像年级/学科管理员那样重定向到 /dashboard。菜单权限未按角色收敛 | 以 GZ001_teacher 登录 → 查看左侧菜单 |
| 4 | 低 | 全局 | 控制台 Vue 警告：`ElTag` 的 `type` prop 收到空字符串 `""`（应为 primary/success/info/warning/danger）；`ElStatistic` 的 `value` prop 收到 `"0%"`、`"67%"` 字符串（应为 Number）。不影响功能但建议修复 prop 类型 | 打开 DevTools Console |
| 5 | 低 | 全局 | 右上角头像下拉菜单在自动化点击中未能展开（人工环境可能正常），建议人工复查退出登录交互 | 点击右上角头像 |
| 6 | 提示 | school_admin / 直连 URL | leads/work-orders/subscription 页面 school_admin 可直连加载，且显示**跨校全局数据**（其他学校的工单/留资/订阅），虽在菜单中隐藏，但需确认是否符合预期 | 学校管理员登录后手动访问 /leads /work-orders /subscription |

---

## 七、结论

1. **路由守卫（年级/学科管理员 schoolOnly 重定向）工作正常**：5 个 schoolOnly 路由均正确重定向到 /dashboard。
2. **superadmin 全局 8 个页面渲染正常**，仅「新增学校」提交 500 需后端排查。
3. **菜单权限最大问题在 teacher 角色**：菜单未与学校管理员区分，admin 菜单可见但点进去权限不足，应隐藏或重定向。
4. **多角色共有的「数据越权」toast** 影响课表/作业/巡课/请假等核心教学页面的数据加载，需后端确认 school_id 传参与数据隔离逻辑。
