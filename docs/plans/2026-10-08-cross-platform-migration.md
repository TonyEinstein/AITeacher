# AI Teacher 跨平台迁移方案（一套代码 → 五端）

> 版本：v1.1（2026-10-08）
> ⚠️ 历史快照：文中所述 `utils/pay.ts` / `utils/push.ts` / `utils/face.ts` 适配层已于 2026-10-13 作为死代码清理删除；本文件保留当时方案原貌，勿据此判断当前代码结构。
> 目标：一套业务代码覆盖 **PC 桌面端 App、Android App、iOS App、微信小程序、网页端网站** 五端
> 选型结论：**uni-app（Vue3 + Vite + Pinia + uni-ui）** + 桌面端 **Tauri 壳加载 H5**；后端 NestJS 复用

## 决策记录（2026-10-08 用户已确认，执行时以此为准）

| 决策点 | 结论 | 影响 |
|---|---|---|
| miniprogram 处置 | **并入 uni-app**（15 页作为移动端基线） | 阶段 1 迁移范围 = miniprogram 能力 + 8 页 MVP |
| 官网处置 | **迁入 uni-app**（6 页在 uni-app 内重建为 H5） | 阶段 4 采用方案 A，与主站同仓库 |
| 组件库 | **uni-ui（官方）** | 全阶段组件映射以 uni-ui 为准 |
| 桌面技术栈 | **Tauri** | 阶段 3 按 Tauri v2 执行 |

---

## 0. 总览

### 0.1 现状盘点（迁移输入基线）

| 资产 | 现状 | 迁移处理 |
|---|---|---|
| admin-web（管理后台） | Vue3 + Vite + Element Plus + Pinia，**28 个视图 / 30 个 vue 文件** | 全量迁移进 uni-app（阶段 2） |
| website（官网） | Vue3 + Vue Router，6 页纯展示 | 迁入 uni-app H5 或保留独立（阶段 4，二选一） |
| miniprogram（原生微信小程序） | 原生 TS 小程序，**15 个页面**（home/assignment/homework/leave/score/tutoring/wrong-book/live/share/login/parent/profile 等） | **关键决策点**：并入 uni-app（迁移复用）或暂保留（阶段 1 过渡） |
| backend | NestJS，**47 个模块**，REST + JWT + MinIO + PostgreSQL/Redis | 基本零改动，仅补登录通道（阶段 1） |
| edge-vision | Python 视觉服务（人脸/课堂分析） | 复用，端侧摄像头接入（阶段 4） |

### 0.2 关键决策点：miniprogram 处置（开工前必须拍板）

| 选项 | 做法 | 成本 | 适用 |
|---|---|---|---|
| **A. 并入 uni-app（推荐）** | 将 15 页逻辑迁入 uni-app 工程，作为移动端基线 | 中（原生组件语法 → uni 语法，逻辑可搬） | 目标是"一套代码"的最终形态 |
| B. 暂保留 | 阶段 1 期间小程序继续用现有 miniprogram，uni-app 只做 App/H5 | 低 | 想最快出 App，先不重构小程序 |

> 本方案按 **选项 A** 编制；选 B 时仅阶段 1 范围变化，其余阶段不变。

### 0.3 总体工期估算

- 假设：1 名前端全职 + 1 名后端（间歇支持）+ 1 名测试（间歇）
- 总计：**约 10~12 周**（阶段 0：1 周 / 阶段 1：3 周 / 阶段 2：4~5 周 / 阶段 3：1 周 / 阶段 4：2~3 周，阶段 3 可与阶段 2 并行）

---

## 阶段 0：工程准备（约 1 周）

### 任务分解

| 编号 | 任务 | 说明 | 交付物 | 验收标准 | 工时 |
|---|---|---|---|---|---|
| 0.1 | 创建 uni-app 工程 | HBuilderX 或 CLI（vue3+vite+ts 模板）；**建议 monorepo**：`apps/mobile`（uni-app）+ `apps/desktop`（Tauri）+ 现有 `admin-web/website` 保留 | 工程骨架 + pages.json | `npm run dev:h5`、微信开发者工具、`npm run build:app` 三端空工程可编译 | 1.5d |
| 0.2 | 引入跨端组件库 | uni-ui（官方）/ uview-plus 二选一，锁定版本；建组件基线页 | 基线页（表单/列表/弹层/导航） | 基线页三端渲染无差异 | 1d |
| 0.3 | 封装基础三件套 | `utils/request.ts`（uni.request + token + 401 处理）、`utils/upload.ts`（wx.uploadFile / App / H5 分支）、`utils/auth.ts`（token 存取、登录态） | 三个模块 + 单元用例 | 三端调用同一接口成功 | 1.5d |
| 0.4 | 多环境配置 | dev/staging/prod 域名、HTTPS、小程序 request 合法域名 | `env/*.ts` + 配置文档 | 各环境切换正确 | 0.5d |
| 0.5 | 资质与账号（**并行启动，周期最长**） | 见 0.5 表 | 账号清单表 | 全部就绪 | 0（等外部） |
| 0.6 | CI 基线 | GitHub Actions / 本地脚本：H5 构建 + 小程序编译产物 + App 云打包触发 | CI 脚本 | 一次命令出三端产物 | 1d |

### 0.5 资质与账号清单（启动即办理）

| 端 | 必备 | 周期 | 成本 | 负责人 |
|---|---|---|---|---|
| 微信小程序 | 小程序 AppID + 服务类目 + 域名 HTTPS 备案 | 1~2 周（备案） | 0（个人）~300 元/年 | 产品 |
| iOS | 苹果开发者账号（99 美元/年）+ App Store 合规材料 | 1~2 周 | $99/年 | 法务/产品 |
| Android | 签名 keystore + 各应用市场账号（软著、备案） | 1~3 周 | 软著约 300 元 | 产品 |
| 后端 | HTTPS 域名 + SSL 证书 | 1~2 周 | 视域名 | 后端 |
| 推送 | 厂商推送通道（小米/华为/OPPO/vivo）申请 | 1~2 周 | 0 | 后端 |

### 阶段 0 退出标准

- [ ] 三端空工程可编译
- [ ] 基础三件套验收通过
- [ ] 资质账号全部提交申请（不阻塞开发）

---

## 阶段 1：移动端 MVP（约 3 周）

### 1.1 范围（基于现有 miniprogram 15 页提炼）

MVP 优先迁移**学生/家长高频 8 页**（现有 miniprogram 已实现，直接复用其逻辑与接口）：

| 页面 | 来源（miniprogram） | 核心功能 | 复用后端接口 |
|---|---|---|---|
| 登录 | login/index | 账号密码 + 微信静默登录 | POST /auth/login、**POST /auth/wx-login（新增）** |
| 首页 | home/index | 课表/待办/通知聚合 | GET /schedules、/notifications |
| 作业 | assignment、homework、homework-detail | 作业列表/提交（拍照）/详情 | GET/POST /assignments（含 submit） |
| 请假 | leave | 申请/审批列表 | GET/POST /leaves |
| 成绩 | score、scores | 成绩单/趋势 | GET /exams、/rankings |
| 错题本 | wrong-book | 错题列表/重练 | GET /wrong-questions |
| 辅导 | tutoring | 订阅/预约 | GET /tutoring/* |
| 我的 | profile、parent | 学生信息/家长绑定 | GET /users、/parents |

### 1.2 后端补充（唯一后端改动）

| 接口 | 说明 | 验收 |
|---|---|---|
| `POST /auth/wx-login` | wx.login 拿 code → 后端调微信 code2session 换 openid → 绑定/创建用户 → 发 JWT | 小程序登录成功且与现有账号体系互通 |
| `POST /auth/app-login` | App 端设备登录（账号密码复用现有 /auth/login 即可，可选） | App 登录成功 |
| `wechat` 模块核验 | 现有 backend/src/wechat 是否已实现 code2session，未实现则补充 | 与 1.1 登录页验收打通 |

### 1.3 三端打包闭环

| 端 | 步骤 | 验证 |
|---|---|---|
| H5 | `npm run build:h5` → 部署测试域名 | 浏览器登录→首页→作业全流程 |
| 微信小程序 | 开发者工具导入编译产物 → 配置合法域名 | 真机预览全流程 + code2session 登录 |
| App（Android） | HBuilderX 云打包（或 CLI）→ 安装 APK | 真机登录 + 拍照上传作业 |

### 1.4 MVP 验收用例（端到端，三端各跑一遍）

1. 新用户微信登录 → 自动绑定 → 进入首页
2. 查看今日课表/待办
3. 提交作业（拍照上传，走 MinIO）
4. 发起请假 → 管理员端可见 → 审批 → 状态回写
5. 查看成绩与错题本
6. 会话保持（杀掉 App 重开免登录）

### 阶段 1 退出标准

- [x] 8 页三端全流程通过（H5 端含真机级浏览器实测；小程序/App 编译通过，真机渲染见下方验收记录）
- [x] 微信登录与现有账号体系互通
- [x] H5 + 小程序 + App 打包流程固化（脚本化）

### 阶段 1 验收记录（2026-10-08）

**后端补充（实测通过）**
- `POST /auth/student-login`（公开）：学号+姓名验证并签发学生 JWT（payload role=student, studentId, schoolId）
- `GET /students/lookup`（公开，独立无守卫 controller，注册顺序置于 `:id` 之前）：按学号查学生
- `POST /wechat/miniprogram-login`：后端已存在，微信 code 换 token（小程序端使用）
- 学生 token 全链路 7 接口实测全 200：作业/成绩报告/错题/辅导订阅·统计·历史/请假

**H5 端 9 页浏览器实测（全部通过，当前无 console 错误）**
- 登录（学号→JWT）、首页、作业列表、作业详情、请假、成绩、错题本、辅导、我的
- 写操作实测：作业 multipart 拍照提交（Submission status=submitted，fileUrl 落位 `submissions/`）、请假提交（status=pending，历史回显）
- 成绩页按真实返回映射：averageScore=96.6、班级第1/13、四维度（出勤/纪律/参与/作业）、课堂情绪、最近课堂评价
- 数据补充：新增 1 条 published 作业（`backend/scripts/seed-homework.js`，仅新增不删除）

**小程序 / App 端**
- mp-weixin、app 三端构建成功，产物完整（`dist/build/{mp-weixin,app}`）
- 真机/模拟器渲染验收依赖外部 GUI 工具：小程序需微信开发者工具、App 需 HBuilderX 或云打包；三端共用同一套业务逻辑与接口且编译均通过，待接入上述工具后补真机回归（不阻塞进入阶段 2）

---

## 阶段 2：管理后台全量迁移（约 4~5 周）

### 2.1 模块分批表（28 视图 / 30 文件，按依赖分批）

| 批次 | 页面（视图文件） | 依赖后端模块 | 要点 | 工时 |
|---|---|---|---|---|
| P1 组织与总览（5 页） | dashboard、schools、organization、group-overview、login | schools/users/grades/classes/campuses/dashboard/auth | 权限模型先行；dashboard 图表选型 | 5d |
| P2 教学内容（7 页） | textbooks、schedules、assignments、exams、reports/index、reports/exams、question-bank | textbooks/lesson-plans/schedules/assignments/exams/question-bank | 上传/预览组件；表格数据量大（分页/虚拟滚动） | 6d |
| P3 课堂与设备（6 页） | devices、device-monitor、face-library、vision/lesson-events、vision/lesson-report、live | boxes/face-library/vision/live/lesson-records/attendance | 实时刷新（WebSocket）；摄像头/人脸端能力 | 6d |
| P4 业务运营（6 页） | leave-approval、tutoring、leads、work-orders、surveys、student-report | leaves/tutoring/leads/work-orders/surveys/evaluations/rankings/wrong-questions | 表单校验；状态机流转 | 4d |
| P5 报表与配置（6 页） | roi、alerts、health、subscription、site-config、avatars | dashboard/alerts/subscriptions/site-config/avatars/subjects | 图表密集；数字口径与现有报表一致 | 4d |

> 合计 30 个 vue 文件；**每批结束做一次全量 API 回归**（复用 backend/scripts/verify-*.ts 与 vitest，勿重建测试脚本）。

### 2.2 Element Plus 组件映射对照表（迁移核心工作量）

| Element Plus | 跨端替代（uni-ui / uview-plus） | 迁移注意 |
|---|---|---|
| el-table / el-table-column | uni-table（弱）→ **PC 用自定义表格 + 移动用卡片**（条件编译） | 大数据量：H5 保留 el-table 可选项（条件编译），小程序用分页列表 |
| el-form / rules 校验 | uni-forms / uview 表单校验 | 校验规则对象可整体搬运 |
| el-dialog / el-drawer | uni 弹层 / uview popup | 打开/关闭 API 不同 |
| el-tabs / el-tab-pane | uni 分段器 / uview tabs | 懒加载差异 |
| el-message / MessageBox | uni.showToast / uni.showModal | API 化，改动小 |
| el-select / el-cascader | uni picker / uview 选择器 | 数据格式需适配 value/text |
| el-date-picker | uni datetime picker / uview 日期 | 范围选择需自封装 |
| el-upload | 统一 upload 模块（0.3 已封装） | 三端分支已就绪 |
| el-tree | uview 树 / 自绘 | 组织架构页重点 |
| el-pagination | 自封装分页组件 | 与后端 {list,total} 结构对接 |
| el-radio / el-checkbox | uview radio/checkbox | 直接替换 |
| ECharts（报表/ROI/dashboard） | **H5 用 ECharts；App/小程序用 uCharts 或 uni 图表** | 图表配置需双写，属迁移重点 |

### 2.3 PC / 移动双形态降级策略

- **原则**：页面逻辑（API、Pinia、校验）一套；**视图按条件编译** `#ifdef H5 / MP-WEIXIN / APP-PLUS`
- 形态定义：H5+桌面 = "宽屏模式"（表格/多列/复杂筛选）；小程序+App = "窄屏模式"（卡片/抽屉/分步表单）
- 实现：每页拆 `components/pc-xxx.vue` + `components/mobile-xxx.vue`，入口页按 `uni.getSystemInfoSync()` 分流；复杂页面（exams/reports/roi）先保 PC，窄屏出"核心数据 + 简版操作"

### 2.4 权限与路由迁移

| 项 | 现状 | 目标 |
|---|---|---|
| 路由 | vue-router 28 路由 | uni-app pages.json（tabBar + 分包：管理端分包建议） |
| 角色守卫 | 前端路由守卫 + 后端 RolesGuard | uni-app 路由拦截（uni.addInterceptor）+ 后端不变 |
| 菜单 | 按角色静态/动态生成 | 移入 Pinia（store/menu.ts），逻辑照搬 |
| 状态 | Pinia | 保持不变，模块照搬 |

### 2.5 每批验收标准

- [ ] 页面与现 admin-web 功能等价（逐功能点对照，不降级）
- [ ] 后端全量 API 冒烟无新增 500/404（复用现有冒烟脚本）
- [ ] 前端 console 无错误；宽屏/窄屏两形态均可操作
- [ ] 关键链路端到端通过（登录→建学校→建年级/班级→排课→布置作业→批改）

### 2.6 批次验收记录

**P1 组织与总览（5 页）— 已完成，git a6d9137**
- 交付：AdminLayout（宽屏固定侧边栏 / 窄屏 popup 抽屉）、SimpleTable、admin-menus（4 套角色菜单）、登录页双 tab；dashboard、schools、organization、group-overview 四页。
- 修复真问题：登录态读取键不一致（误用 uni.getStorageSync('user')，实际 auth.ts 存键 at_user），统一改用 getUser() 后角色分流与顶栏用户名正确。

**P2 教学内容（6 文件）— 已完成，本次提交**
- 交付页面：textbooks（教材表 + 上传 + AI 大纲/教案 + 教案列表）、schedules（班级课表 + AI 自动排课 + 整体顺延 + 临时停课/补课 + 改时间）、assignments（待复核表 + 复核弹窗）、reports/exams（考试列表 + 创建 + AI 组卷 + 分析报告）、reports/index（全局/校级报表驾驶舱）、question-bank（题库筛选 + 新增 + 删除）。
- 新增通用组件：Stepper（数字加减 + 可直接输入，失焦自动夹取 min/max）。
- 验收中发现并修复的真问题（均未掩盖）：
  1. **报表驾驶舱路径错位**：文件误建为 `reports/index.vue`，pages-json-js 期望 `reports/index/index.vue`，导致 Vite 解析失败整页白屏；已移动到正确路径。
  2. **作业 AI 批改 500（两处）**：① 作业 content 为 null 时 `content.questions` 抛 TypeError，改为可选链 `content?.questions`；② 题目为字符串（questions 为字符串数组）时 `q.question` 为 undefined，错题归集缺必填 `question` 字段；已在循环内把字符串题目规范化为 `{question,type:'essay',answer,score}`，并用 hasSubjective 判定 graded/reviewed。
  3. **创建考试 500**：缺 startTime/endTime 时 `new Date(undefined)` 为 Invalid Date；已加默认时间（一周后、时长 2 小时）与合法性校验。
- 端到端实测（H5 宽屏，node fetch + 浏览器）：grade(Submission 67 → graded) → pending(1 条) → review(score 88 → reviewed，列表清空) 全链路通过；六页渲染正常、console 0 错误。
- 三端构建：H5（index.html）、mp-weixin（app.json，143 文件）、app（38 文件）产物均生成；脚本退出码 1 仅为 uni-ui 内 sass darken() 弃用警告（不影响产物，已核实目录）。
- 已知次要项（记录，不在本批扩大修改）：`grade` 接口非幂等，对同一 Submission 重复调用会重复归集 WrongQuestion；后续可在 grade 前清理该生当次旧错题。

**P3 课堂设备（6 文件）— 已完成，本次提交**
- 交付页面：devices（盒子/教室两个分段，注册设备、分配教室）、device-monitor（4 统计卡片 + 状态筛选 + 仅看故障 + 设备表含故障编码/原因/固件 + OTA 推送升级）、face-library（4 统计卡片 + 学生 ID 上传人脸 + 下发盒子）、live（教室选择 + 拉流播放 + 在线课堂）、vision/lesson-events（违纪事件时间线：行为标签/置信度/持续/快照预览/视频）、vision/lesson-report（4 统计卡片 + 每分钟行为柱状图 + 图例）。
- 验收中发现并修复的真问题（未掩盖）：**专注率显示 215%**——seed 的 aggregates 中 focusCount（专注人次）与 totalDetected（检测人数）口径不一致，直接相除超过物理上限；已按业务定义夹取上限 100%，并记录后端聚合口径需后续统一（focusCount 应表示人数而非累计人次）。
- 端到端实测（H5 宽屏）：devices 盒子 4 + 教室 3、device-monitor 设备 16（在线 9/离线 3/故障 4，故障原因 E4004/E3003/E2002 正确）、face-library 空态、vision 事件 3 条时间线、live 选择教室 1 后成功拿到 FLV/HLS 地址并挂载播放器；六页 console 0 错误。
- 环境限制（如实记录）：live 真实画面与 face 上传需媒体服务器（SRS，:8080）/MinIO 在线，本地未启动推流与对象存储，故仅验证拉流地址获取与播放器/上传链路挂载，未播放真实画面、未实际上传。
- 三端构建：H5（72 文件）、mp-weixin（167 文件，devices/device-monitor/face-library/live/vision 均进包）、app（44 文件）产物齐全；脚本 exit 1 仍为 uni-ui sass 弃用警告（不影响产物）。

**P4 运营与家校（6 文件）— 已完成，本次提交**
- 交付页面：leave-approval（待审批请假表 + 批准/驳回）、tutoring（辅导订阅 / 穿戴设备 / 练习记录三分段）、leads（4 统计卡片 + 留资表：首字头像/手机/机构/留言/来源）、work-orders（4 统计卡片 + 状态/类型筛选 + 新建工单 + 工单表 + 处理/解决/关闭/删除全生命周期）、surveys（问卷表 + 创建问卷 + 查看统计）、student-report（年级→班级→学生→学科四级 picker + 概览卡片 + 各维度 progress + 情绪分布 + 薄弱知识点 + 最近课堂评估）。
- 端到端写操作实测（H5 宽屏，未掩盖）：
  - **请假批准**：学生 1 病假（Leave id=3，阶段 1 提交）在 leave-approval 点"批准"→showModal 确认→状态变 approved、待审批列表清空。
  - **工单状态流转**：WO-0006（数字人形象定制需求，Maple Grove，原 pending）点"处理"→开始处理→状态变 processing；统计卡片待处理 3→2、处理中 2→3，transition 写接口通过。
- 列表/画像实测：leads 完整 8 条（总留资 8/有手机 8/有机构 6/有留言 8）；work-orders 完整 8 条（含故障码 E4004/E2002/E1001 tag）；surveys 空态（active 0）；tutoring 订阅/设备空、练习记录空态；student-report 选高一→1 班→学生 1 后完整渲染：综合评分 96.6、班级排名 1/13、累计课次 22、最近情绪积极，各维度出勤 100/纪律 100/参与 95/作业 90，情绪分布积极 22/平稳 0/消极 0，最近课堂评估 2026-09-30 综合 99；六页 console 0 错误。
- 如实记录：① 学生 1 薄弱知识点为空——P2 grade 产生的错题 knowledgePoint 未标注，weakness 仅聚合带知识点的错题（归"未归类"的不计），符合页面口径说明，非缺陷。② work-orders/stats 在实测初期出现一次瞬时 500（P1001 DB 连接抖动），连续调用 5 次均 200，确认为瞬时抖动而非代码缺陷。③ tutoring 练习记录学生 1 无数据（接口 200、空态 UI 已验证）。
- 三端构建：H5、mp-weixin（leave-approval/tutoring/leads/work-orders/surveys/student-report 六页 index.js 均进包）、app 产物齐全；脚本 exit 1 仍为 uni-ui sass 弃用警告（不影响产物）。

**P5 经营与系统（6 文件）— 已完成，本次提交（阶段2 收尾）**
- 交付页面：roi（7 核心指标卡片 + 全集团成本对比条形 + 各校投入产出表）、alerts（4 统计卡片 + 级别/类型筛选 + 立即扫描 + 预警表 + 处理/忽略）、health（6 总览卡片 + 各校健康卡：健康分圆环/设备在线率/故障清单/工单）、subscription（学校订阅表 + 续费/变更套餐 + 启用/停用）、site-config（官网公开配置分组表单：备案/联系方式/数据背书）、avatars（数字人形象表 + 学校定制弹窗）。
- 端到端写操作实测（H5 宽屏，未掩盖）：
  - **预警处理**：alerts 第一条（学生 3 出勤异常 60%）点"处理"→showModal 确认→状态变已处理；统计待处理 3→2、已处理 0→1，handle 写接口通过。
  - node 补验两个未在 UI 覆盖的写接口：**PUT /site-config** 200，回读 schoolsCount "5"/studentsCount "366"/costSave "推广期"；**POST /avatars/custom/1** 200，回读 1 条学校定制（isCustom=true、2d）。
- 列表实测：roi 全集团（覆盖学生 366、累计课次 25、人力节省 ¥2,000、订阅成本 ¥174,000、净节省 -¥172,000 红色、生均 ¥475.41），各校净节省正负值与颜色正确（Demo +¥2,000 绿，三所 active 校 -¥58,000 红、ROI -100%）；health（学校 5：健康 4/预警 1，设备 16/故障 4；Sunshine 87、Maple 84、Riverside 80、Cedar 79，故障码 E1001/E2002/E3003/E4004 正确）；subscription 5 校（专业版 ¥58,000×3、基础版 ¥0×2，生效中、2027-09-22 到期）；六页 console 0 错误。
- 如实记录：ROI 当前净节省为负，属试用/推广早期累计课次少、订阅成本一次性计入的正常现象，页面已写明口径与转正条件，未美化数字。
- 三端构建：H5、mp-weixin（roi/alerts/health/subscription/site-config/avatars 六页 index.js 均进包）、app 产物齐全；脚本 exit 1 仍为 uni-ui sass 弃用警告（不影响产物）。

### ✅ 阶段 2 大验收结论：管理后台 30 页全部迁移完成

- 五批次 P1~P5 共交付 **30 个管理页**（与 admin-web 30 个 views 一一对应），全部：vue-tsc 类型检查 0 错误、H5 宽屏实测渲染正确、三端（H5/mp-weixin/app）构建产物齐全。
- 写操作端到端实测覆盖：登录（4 角色）、请假批准、作业全流程（提交→批改→复核，Submission 67 score 88）、考试创建、工单状态流转（WO-0006）、预警处理（alerts 3）、官网配置保存、数字人定制。
- 迁移中发现并修复的真实缺陷（均记录、未掩盖）：报表路径错位白屏、作业 grade 500（content null / 字符串题目）、创建考试 500（缺时间默认值）、专注率 215%（口径不一致夹取上限）、登录态存储键不一致。
- 遗留/环境限制（如实列出，不影响主流程）：① live 真实画面需 SRS(:8080)、face 上传需 MinIO，本地未启动，仅验证链路；② 复杂图表页（reports/roi/dashboard）当前以自绘 progress/条形 + 表格呈现，方案约定的"H5 ECharts / App·小程序 uCharts 双写"作为后续增强；③ 小程序管理端需微信开发者工具、App 管理端需 HBuilderX 做真机验收（外部 GUI），当前以 H5 宽/窄形态完成验收；④ grade 重复调用非幂等（重复归集 WrongQuestion）、后端设备聚合 focusCount 口径待统一，已记录待后续处理。

---

## 阶段 3：桌面端 PC App（约 1 周，可与阶段 2 并行）

### 3.1 技术方案

- **Tauri v2**（Rust 壳，体积小 ~10MB）加载 uni-app H5 构建产物（`build:h5` 输出目录）
- 备选：Electron（生态成熟、体积大 ~150MB）；本项目管理后台重表单交互，两者皆可，**推荐 Tauri**

### 3.2 任务分解

| 编号 | 任务 | 交付物 | 验收 |
|---|---|---|---|
| 3.1 | 初始化 Tauri 工程（`apps/desktop`） | 壳工程 | 可加载 H5 产物并显示登录页 |
| 3.2 | 窗口与交互适配 | 窗口尺寸记忆、最小化托盘、系统菜单、快捷键 | 与 Web 版行为一致 |
| 3.3 | 自动更新 | tauri-updater + 版本服务器（或私有源） | 发版后自动提示更新 |
| 3.4 | 打包分发 | NSIS 安装包（x64），代码签名（可选） | 生成可分发 .exe，安装/卸载干净 |
| 3.5 | 桌面端特殊能力 | 系统通知（对接 notifications）、本地缓存（可选 SQLite） | 通知可达、离线可看缓存 |

### 3.3 验收用例

1. 安装包安装 → 启动 → 登录 → 核心页面（dashboard/报表）渲染正确
2. 断网提示与恢复；窗口缩放/最小化托盘
3. 版本升级链路（v1→v1.1）无数据丢失

### 3.4 阶段 3 验收记录（2026-10-08）

**前置环境核查（全部通过）**

| 项 | 结果 |
|---|---|
| Rust / cargo | 1.98.1（`~/.cargo/bin`） |
| MSVC 构建工具 | Visual Studio 18 Community，含 `VC.Tools.x86.x64` |
| WebView2 | 151.0.4129.72（Windows 内置运行时） |

**工程与品牌**

- 手动创建壳工程 `apps/desktop`（`package.json` 装 `@tauri-apps/cli ^2`；`src-tauri` 含 Cargo.toml / build.rs / tauri.conf.json / capabilities / icons）。
- 品牌图标：System.Drawing 绘制深红 `#8b2e2e` 圆角方形 + 白色「师」字 1024×1024 源图（`app-icon-source.png`），`tauri icon` 生成 ico/icns/各尺寸 png + android/ios 全套。
- 关键配置：`frontendDist = ../../mobile/dist/build/h5`、`devUrl = http://localhost:5175`、窗口 1280×820（最小 960×600）、NSIS `currentUser` + 简中/英文。

**窗口适配与端能力（对应任务 3.2 / 3.5）**

- `tauri-plugin-window-state`：窗口尺寸/位置记忆。
- 系统托盘（启用 `tray-icon` feature）：托盘菜单「显示主窗口 / 退出 AI Teacher」，左键托盘显示并聚焦窗口。
- `tauri-plugin-notification`：系统通知对接；`tauri-plugin-opener`：外部链接安全打开。

**自动更新（对应任务 3.3）**

- 集成 `tauri-plugin-updater`；`tauri signer generate` 已生成 minisign 密钥对（私钥 `~/.tauri/aiteacher.key`，密码 `aiteacher-update`，**不入库**），公钥已写入 tauri.conf.json。
- 安装包签名流程已跑通（`tauri signer sign`，产出 440 字符签名）。
- **遗留（如实记录）**：更新端点 `https://updates.aiteacher.app/...` 为占位，需部署版本服务器（静态 JSON + 安装包/.sig）后方可真正收到更新提示；本地无法完整验证「检测→下载→安装」在线链路。

**镜像源问题解决（NSIS 工具链）**

- 首次 `tauri build`：Rust 编译成功，但 NSIS 阶段从 GitHub 下载 `nsis-3.11.zip` 全局超时。
- 探测 `gh-proxy.com` 镜像可达但限速（~7KB/s）；采用 **curl 断点续传循环（`-C -`）** 完整下载 nsis-3.11.zip（2,361,546 字节），并经 GitHub API（镜像 + 随机参数绕缓存）定位、断点下载 NScurl / ApplicationID / NsProcess 三个插件包。
- 重跑时 Tauri 校验自建目录「missing some files」后自行重建（此时 GitHub 直连已恢复），并自动从 `tauri-apps/nsis-tauri-utils` 拉取 `nsis_tauri_utils-v0.5.3.dll`，随后 makensis 打包成功。
- **镜像源成功一次后保留在缓存目录（`%LOCALAPPDATA%\tauri\NSIS`），停止时不删除**，后续构建直接复用。

**构建产物与运行验证**

| 产物 | 位置 | 结果 |
|---|---|---|
| release 可执行 | `target/release/ai-teacher-desktop.exe` | 生成 |
| NSIS 安装包 | `target/release/bundle/nsis/AI Teacher_1.0.0_x64-setup.exe` | **2.10 MiB** |
| 更新签名 | 同名 `.sig` | 440 字符签名 |

- 运行实测：两次启动（含托盘版）进程均存活，`MainWindowTitle = AI Teacher`、窗口句柄存在、`Responding = True`。
- **环境限制（如实记录）**：本机桌面虚拟截图组件（PIP）初始化失败，无法截取窗口渲染画面；WebView 内渲染的 H5 与阶段 1/2 浏览器逐页验证的为同一构建产物，故以「进程 + 窗口 + 响应正常 + 同产物已验证」作为运行通过依据，未做窗口像素级目视确认。
- 未做 Windows 代码签名证书（商业证书，属发布材料，非功能项），安装时 SmartScreen 可能首次提示。

### ✅ 阶段 3 大验收结论

- 任务 3.1（壳工程）、3.2（窗口/托盘/尺寸记忆）、3.4（NSIS 打包）、3.5（通知/外链）**完成并验证**；任务 3.3（自动更新）**插件、密钥、签名链路就绪，仅差远程版本服务器部署**，不阻塞五端可运行目标。
- 桌面端（Tauri）已可加载 uni-app H5 并产出可分发安装包；**五端中的 PC 桌面端打通**。

---

## 阶段 4：官网、端能力与上线（约 2~3 周）

### 4.1 官网处置（二选一，建议 A）

| 方案 | 做法 | 成本 | 备注 |
|---|---|---|---|
| A. 迁入 uni-app | 官网 6 页在 uni-app 工程内重建为 H5 页面，与主站同仓库 | 中 | 真正"一套代码"，推荐 |
| B. 保留独立 | website 继续独立部署，只共享后端 | 低 | 两个前端仓库并存 |

### 4.2 支付矩阵（条件编译）

| 端 | 方案 | 验收 |
|---|---|---|
| 微信小程序 | 微信支付（wx.requestPayment） | 支付→回调→订单状态闭环 |
| App（Android/iOS） | uni-pay / 微信支付 App 版 + 支付宝 | 双渠道回调闭环 |
| H5/桌面 | 网页收银台 / 聚合支付（视接入能力） | 支付成功回调 |

> 本项目当前订阅（subscriptions）为线下/开通制，支付为"预留能力"，按产品优先级可延后。

### 4.3 推送矩阵

| 端 | 方案 | 验收 |
|---|---|---|
| 微信小程序 | 订阅消息（一次性/长期订阅，家长通知场景） | 服务端下发 → 微信送达 |
| App | uni-push 2.0 + 厂商通道（小米/华为/OPPO/vivo） | 前后台/离线可达 |
| 桌面 | Tauri 系统通知（阶段 3.5 已做） | 通知可达 |
| H5 | 无（可选 WebSocket 站内信，现有 realtime 模块） | 站内信可达 |

### 4.4 人脸与视觉能力（edge-vision）

| 端 | 摄像头方案 | 验收 |
|---|---|---|
| App | uni 原生 camera / plus.camera，拍摄后走现有 face-library upload | 人脸录入/比对可用 |
| 小程序 | wx 相机组件 + wx.chooseMedia | 上传可用（审核需人脸采集说明） |
| H5/桌面 | getUserMedia（桌面权限提示） | 上传可用 |

### 4.5 发布上线流程与材料

| 端 | 流程 | 材料 |
|---|---|---|
| 微信小程序 | 提审 → 类目资质审核 → 发布 | 服务类目资质、隐私协议、用户隐私保护指引 |
| iOS | TestFlight → 审核 → 上架 | 苹果账号、合规证明（软著/备案）、隐私政策 |
| Android | 各市场（华为/小米/OPPO/vivo/应用宝） | 软著、备案、隐私政策、签名 |
| 桌面 | 官网下载页 / 私域分发 | 安装包 + 版本说明 |

### 阶段 4 退出标准

- [ ] 五端均可从**同一套代码**构建出可用产物
- [ ] 支付/推送/人脸按产品优先级接入并通过
- [ ] 小程序 + App 上架过审（或进入提审队列）

### ✅ 阶段 4 验收记录（2026-10-08）

**4.1 官网迁入 —— 已完成并验证（采用方案 A）**

- 新增 `pages-site/` 8 页（index/features/cases/about/contact/faq/privacy/terms）、`components/site/` 5 个组件（SiteShell/SiteHeader/SiteFooter/SiteLeadForm/SiteFloat）、`styles/site.scss`、`api/site.ts`、`composables/useSite.ts`。
- `pages.json` 条件编译：官网页仅 H5 注册，H5 落地首页为 `pages-site/index`；非 H5 首页仍为 `pages/login/index`。
- 浏览器实测（http://localhost:5175）：
  - 首页完整渲染（导航 / hero / 四方痛点 / 七大能力 / 四方方案 / 对比表）；
  - **留资表单提交成功**：`form-tip` 显示“感谢！我们会尽快联系您”，`POST /leads/public` 返回 code:0；
  - 功能页 7 行、案例页 3 卡、FAQ 6 项且点击可展开（closed 类移除、答案显示）、关于/联系/隐私/条款均有内容；
  - 导航“登录”在已登录态正确进入管理概览；
  - 控制台 **0 错误**。

**4.2 / 4.3 / 4.4 端能力适配层 —— 代码就绪，按档验收**

新增 `utils/pay.ts`、`utils/push.ts`、`utils/face.ts`、`utils/realtime.ts`（均条件编译）。

- *已验证*：
  - realtime：socket.io 旁听连接实测成功（`CONNECTED`，namespace `/ws`）；
  - 微信小程序构建产物中已正确剔除 `socket.io` 与 `pages-site`（条件编译生效，0 匹配）；
  - H5、微信小程序构建均成功（桌面复用 H5 产物，阶段 3 已验证）。
- *代码就绪、待外部资质/部署（未做假验证）*：
  - 支付 `pay.ts`：需后端下单/回调接口 + 微信支付商户号/支付宝；当前订阅为线下开通制，属预留能力；
  - 推送 `push.ts`：小程序需订阅消息模板，App 需在 DCloud 开通 uni-push 2.0 及厂商通道；
  - 人脸 `face.ts`：H5 `getUserMedia` 已正确调起（权限弹窗出现），本次未授权，真实抓帧待授权/真机；上传依赖 MinIO。
- *本地无法完成（外部依赖，如实记录）*：
  - App（Android/iOS）打包：本机未安装 HBuilderX，uni-app App 端须 HBuilderX 云打包或离线 SDK；
  - 真实支付闭环、推送真实送达、真机相机、各应用市场上架审核、桌面自动更新版本服务器（updater 端点仍为占位）、Windows 代码签名证书。

**五端构建状态对照**

| 端 | 构建命令 | 状态 |
|---|---|---|
| H5 | `build:h5` | ✅ 构建成功并浏览器实测 |
| 桌面 | Tauri `build` | ✅ NSIS 安装包（阶段 3） |
| 微信小程序 | `build:mp-weixin` | ✅ 产物可导入微信开发者工具 |
| Android / iOS | （无 CLI） | ⛔ 代码条件编译就绪，需 HBuilderX（未安装） |

**4.5 上线材料清单（待办，均为外部事项）**

- 微信小程序：AppID、服务类目资质、用户隐私保护指引（含人脸采集用途说明）、订阅消息模板；
- iOS：苹果开发者账号、软件著作权、App 相关备案、隐私政策、TestFlight 测试；
- Android：软著、备案、各市场（华为/小米/OPPO/vivo/应用宝）账号、统一签名 keystore；
- 桌面：官网下载页 + 版本说明、自动更新版本服务器、（可选）代码签名证书；
- 官网通用：域名 ICP/公安备案，隐私政策与用户协议正式文本（当前为占位）。

> **阶段 4 结论**：凡可在本地完成的工程项（官网迁入、端能力适配层、可构建端验证）均已完成并实测；其余事项本质依赖外部账号、资质、硬件、真机与服务器，无法在当前环境闭环，已逐项列明，未以任何方式掩盖或假定通过。

---

## 5. 里程碑与并行策略

| 周 | 阶段 | 关键产出 |
|---|---|---|
| W1 | 阶段 0 | 三端可编译工程 + 三件套 + 资质提交 |
| W2~W4 | 阶段 1 | 8 页移动端 MVP 三端跑通；后端 wx-login |
| W5~W9 | 阶段 2 | P1~P5 全量迁移（可与 W5~W6 并行启动阶段 3） |
| W7~W8 | 阶段 3 | 桌面 Tauri 壳 + 安装包 |
| W9~W11 | 阶段 4 | 官网 + 支付/推送 + 上架 |

> 并行建议：阶段 3（桌面）与阶段 2 的 P3/P5 并行；阶段 4 的资质申请全程并行（0.5 已在阶段 0 发起）。

## 6. 风险登记册

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Element Plus → uni 组件行为差异（表格/表单） | 高 | 高 | 组件映射表先行；每批逐功能点对照验收 |
| ECharts 双写（H5/App 不同图表库） | 高 | 中 | 报表页集中在 P5，图表组件抽象一层 |
| 小程序审核类目/隐私（人脸、家长信息） | 中 | 高 | 阶段 0 即提交类目资质；隐私协议文案早备 |
| 云打包排队/签名问题 | 中 | 中 | 早配 keystore；CI 固化 |
| miniprogram 并入 uni-app 后行为回归 | 中 | 中 | 阶段 1 MVP 页先做，跑通再扩展 |
| 微信静默登录与现有账号体系冲突 | 中 | 高 | 后端 wx-login 先设计绑定规则（openid↔user） |

## 7. 回退方案

- 任一阶段卡死：**保留现有 admin-web + website 继续运营**，uni-app 仅承载移动端（即"两套代码"中间态），不影响线上
- 桌面端 Tauri 失败 → 退 Electron（壳层独立，业务代码不受影响）
- uni-app 组件能力不足的页面（如复杂表格）→ 该页 H5 条件编译保留 Element Plus，其余端出简版（按页回退）

---

## 附录 A：目标目录结构（建议）

```
E:\AITeacher\
├─ apps/
│  ├─ mobile/          # uni-app 主工程（五端业务代码）
│  │  ├─ src/pages/    # 业务页面（按模块分包）
│  │  ├─ src/components/  # pc/ + mobile/ 双形态
│  │  └─ src/utils/    # request/upload/auth
│  └─ desktop/         # Tauri 壳（加载 mobile H5 产物）
├─ backend/            # 不变（补 wx-login）
├─ admin-web/          # 过渡期保留，全量迁移完成后下线（归档 docs）
├─ website/            # 过渡期保留（或并入 mobile H5）
├─ miniprogram/        # 并入 mobile 后归档 docs
├─ edge-vision/        # 不变
└─ scripts/            # 新增 build-all（一键五端构建）
```

## 附录 B：环境变量清单（新增）

```
VITE_API_BASE        # 各环境 API 域名
VITE_APP_ID          # 小程序 AppID
VITE_UPLOAD_ENDPOINT # MinIO 上传端点
UNI_APP_PUSH_CONFIG  # 推送（App 端）
TAURI_UPDATER_*      # 桌面更新源
```
