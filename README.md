# AI Teacher 智能教学Agent系统

**[English](#english) | 中文**

AI Teacher 是一套用 AI 数字人替代教师完成 K12 教学与辅导的 SaaS 系统：云端按课表调度数字人自动上课，教室小盒子本地渲染 Live2D 并跑视觉 / ASR，实时识别举手、维持纪律、批改作业，同时为学生 / 家长 / 老师提供小程序、Web 管理后台与企业官网。

本仓库包含管理后台前端、官网前端、NestJS 后端、本地 / 生产部署编排与项目文档。

![AI Teacher 官网首页](docs/screenshots/website_viewport/home.png)

<p align="center"><sub>AI Teacher 企业官网首页（本机实测截图，1440×900 @2x）</sub></p>

> **📝 关于截图与演示数据**：本仓库 `docs/screenshots/` 中的所有界面截图均为**本地开发环境的演示数据**（演示账号、占位学校名、模拟统计数字），不含任何真实学校、教师、学生或家长信息；文中出现的账号密码均为本地开发种子数据，请勿用于生产环境。
>
> **📜 License**：本项目以 [MIT License](LICENSE) 开源。`docs/` 下的架构与 QA 文档为历史开发记录，描述以代码现状为准。

<a id="english"></a>
## English

**AI Teacher** is a SaaS platform that replaces teachers with AI digital humans for K12 teaching and tutoring: the cloud schedules digital-human lessons by timetable, while an in-classroom edge box renders Live2D locally and runs on-device vision / ASR to recognize raised hands, maintain discipline, and grade homework — with mini-program, web admin console, and marketing site for students, parents, and teachers.

**Highlights**: answer grounding against lesson transcripts (not free-form LLM generation) · edge-cloud collaboration usable on weak classroom networks · fully automated lesson pipeline (material upload → lesson planning → scheduled teaching → roll-call → interaction → assessment) · real-time classroom behavior sensing · four-tier multi-tenant data isolation · 130+ unit tests on a real database.

**Stack**: uni-app (Vue 3 + TS, five platforms from one codebase) · NestJS + Prisma + PostgreSQL · Tauri desktop shell · Electron classroom client · ONNX/Whisper edge inference · Docker deployment.

All docs are in Chinese; screenshots show demo data from a local dev environment. See the [MIT License](LICENSE).

## 为什么选择 AI Teacher

| 优势 | 说明 |
| --- | --- |
| **上课有根有据，不靠大模型编** | 数字人答疑前先用 2-gram 相关度检索**本课讲稿 + 学科知识点**组装上下文，系统提示词强制「只依据资料作答，资料未覆盖时如实说明」；讲稿本身来自教师上传的教材与教案解析，而不是让大模型自由发挥 |
| **端云协同，教室弱网可用** | 云端只做调度与内容，教室盒子**本地渲染 Live2D、本地跑视觉与语音推理**（ONNX / Whisper），对网络依赖低，云端故障不影响已开始的课堂 |
| **全流程自动，一条链路跑通** | 教材上传 → 教案 / 讲稿生成 → 按课表自动开课 → 点名 → 讲授 → 互动答疑 → 课后评估，全链路自动化；到点自动上下课，无需人工盯守 |
| **课堂可感知、可干预** | 举手、走神、违纪等视觉事件实时上报：违纪**当场点名提醒**，行为数据直接进入课堂评分、课后评估与预警引擎，而不是只存档 |
| **学情数据真实、可追溯** | 评估分全部来自真实考勤 / 行为 / 作业 / 考试四类数据源，无随机数；每个分数都能回溯到原始事件，家长看到的每一分都有出处 |
| **权限边界严格** | 学校 / 集团 / 年级 / 学科四级数据范围；集团管理员可跨校区汇总，且与其他集团**严格隔离**（伪造参数无效、未绑定学校直接拒绝），由 21 项权限矩阵测试守护 |
| **克制地用 AI** | 每个 AI 能力都有灰度开关与降级路径：LLM 缺 Key 自动走 mock、课堂 Agent 默认关闭且防双写——大模型不可用时系统整体仍可用 |
| **工程质量可验证** | **91 项单元测试 + 5 条端到端链路 95 项断言**，全部在真实数据库上跑通，脚本可重复执行（`backend/scripts/verify-*.ts`） |

## 技术栈总览



| 层       | 技术                                                            |
| ------- | ------------------------------------------------------------- |
| 五端业务代码  | **uni-app（Vue 3 + TypeScript + Vite + Pinia + uni-ui）** — 一套代码产出 PC 桌面 / Android / iOS / 微信小程序 / 网页五端 |
| 桌面端壳    | Tauri v2（加载 uni-app H5 产物，NSIS 安装包）                            |
| 后端服务    | NestJS 12 + TypeScript + Prisma 5 + BullMQ + Socket.io        |
| 数据库     | PostgreSQL 16（本地 Docker / 生产腾讯云托管）                            |
| 缓存 / 队列 | Redis 7 + BullMQ                                              |
| 对象存储    | MinIO                                                         |
| 直播流媒体   | SRS 5（RTMP / HTTP-FLV）                                        |
| 教室端（另仓） | 树莓派 5 + Electron + Live2D + 本地 ONNX/Whisper                   |
| 已归档（历史） | `archive/`：迁移前的 admin-web / website / miniprogram（见 `archive/README.md`） |

## 功能总览

### 教学核心



* **自动上课**：上传教材自动排课、生成 PPT 大纲与讲稿，到点数字人开讲，点名互动全流程自动。

* **数字人授课**：2D Live2D 形象按讲稿开讲，口型手势同步，PPT 自动翻页，到点自动上下课。

* **实时互动**：学生举手即识别、AI 现场答疑；走神违纪当场提醒并记录。

* **作业批改**：作业推送小程序，AI 批改出初评，教师复核即可。

* **个性化学情**：每课打分、长期追踪，每人一份成长报告；支持班级 / 年级 / 跨校排名。

* **课后辅导**：学生穿戴设备随问随答，辅导 Agent 跨科答疑，记录自动沉淀进学情。

* **家长看课**：家长小程序实时看孩子上课与在校表现。

### 管理后台（uni-app H5，5175）

学校 / 组织 / 用户 / 订阅管理、教材教案、课表、作业复核、考试、巡课旁听、报表驾驶舱、设备与工单管理、AI 教师与数字人形象、满意度问卷、**咨询留资**、**官网设置**等。页面位于 `apps/mobile/src/pages-admin/`，与移动端、桌面端**同一套代码**。

### 企业官网（uni-app H5，5175）

见下文「官网」章节。

## 目录结构



```
E:\AITeacher\\

├── apps\                       # 跨端工程（一套代码 → 五端）
│
│   ├── mobile\                 # uni-app 主工程（Vue3 + Vite + uni-ui，H5 端口 5175）
│
│   │   ├── src\pages\            # 移动端页面（学生 / 家长）
│
│   │   ├── src\pages-admin\      # 管理后台 30 页（迁移自原 admin-web）
│
│   │   ├── src\pages-site\       # 官网 8 页（仅 H5 条件编译，迁移自原 website）
│
│   │   ├── src\components\       # admin（后台组件）/ site（官网组件）/ chart（uCharts）
│
│   │   ├── Dockerfile            # H5 产物容器（nginx 托管 + /api 反代）
│
│   │   └── nginx.conf
│
│   └── desktop\                # Tauri v2 桌面壳（加载 mobile 的 H5 产物）
│
├── archive\                    # 已归档工程（admin-web / website / miniprogram，见其 README）
│
├── backend\                    # 后端服务（NestJS，端口 3000）

│   ├── README.md

│   ├── src\                    # 42 个业务模块 controller/service/module

│   └── prisma\\

│       ├── schema.prisma       # 51 张表（含 SiteConfig 官网配置、TrackingEvent 埋点、ClassMinuteAggregate 课堂聚合、StudentAlert 学生预警）

│       └── seed.ts             # 种子数据与测试账号

├── infra\\

│   ├── docker\                 # docker-compose 与启动脚本

│   └── pi\                     # 树莓派 systemd / OTA 脚本

├── docs\                       # 项目文档（api / database / deploy / development / plans / screenshots / architecture / product / qa / website / media）

│   ├── api\README.md           # API 概览

│   ├── database\README.md      # 数据库表说明

│   ├── deploy\README.md        # 部署说明

│   └── development\README.md  # 开发指南

├── scripts\                    # 一键启动 / 停止 / 健康检查（start-all、stop-all、一键启动.bat、一键停止.bat）

│   └── maintenance\            # 一次性修复脚本（add_* / fix_* / patch_* / update_*）

├── deliverables\               # 对外交付物（产品介绍 PPT 等）

├── edge-vision\                # 视觉服务（scripts/ 内含训练脚本 train_yolo26.py）

└── datasets\                   # 数据集（不入库）
```

## 快速启动

> ⚠️ **启停规则：一律优先使用一键脚本**（`scripts\start-all.ps1` / `stop-all.ps1`），不要手工拼命令启动或 taskkill 停止——脚本内置启动顺序（容器 → 后端 → 前端）、端口冲突清理与健康探测，手工操作容易漏步骤漏容器。AI 助手操作时同理。

### 方式一：一键启动（推荐）

双击 `scripts\一键启动.bat`，或执行：

```
powershell -File .\scripts\start-all.ps1
```

依次启动：Docker 容器（postgres/redis/srs/minio）→ 后端（3000）→ uni-app H5（5175，管理后台与官网同一产物）。

停止：双击 `scripts\一键停止.bat` 或执行 `powershell -File .\scripts\stop-all.ps1`（前端、后端、Docker 容器一并停止，数据保留）。

### 方式二：手动分步

> 仅当一键脚本故障需要分步排查时使用；日常启停请回到方式一。



```
\# 1. 启动中间件（PostgreSQL/Redis/MinIO/SRS）

cd E:\AITeacher\infra\docker

.\start.ps1

\# 2. 初始化数据库

cd ..\\..\backend

npm install

npx prisma db push

npx prisma db seed

\# 3. 启动后端（端口 3000）

npm run start:dev

\# 4. 另开终端，启动 uni-app H5（端口 5175，管理后台 + 官网）

cd ..\apps\mobile

npm install

npm run dev:h5
```

浏览器打开：管理后台 [http://localhost:5175](http://localhost:5175)、官网 [http://localhost:5175/#/pages-site/index](http://localhost:5175/#/pages-site/index)。

## 测试账号

密码统一为 `123456`。



| 账号             | 角色    | 说明                                 |
| -------------- | ----- | ---------------------------------- |
| `superadmin`   | 超级管理员 | 管所有学校 / 订阅 / 工单 / 留资 / 官网设置 / 全局监控 |
| `GZ001_admin`  | 学校管理员 | Sunshine High School                            |
| `GZ001_grade1` | 年级管理员 | Sunshine High School 高一年级主任                         |
| `GZ001_math`   | 学科管理员 | Sunshine High School 数学教研组长                         |
| `SZ001_admin`  | 学校管理员 | Maple Grove School                           |
| `FS001_admin`  | 学校管理员 | Riverside Academy（试用）                         |
| `DG001_admin`  | 学校管理员 | Cedar Hill High School                            |

## 官网

官网为 uni-app 工程内的 H5 页面（`apps/mobile/src/pages-site/`，随 H5 产物发布，端口 5175），水墨风设计，面向学校 / 老师 / 家长 / 学生展示产品并收集销售线索。官网页以 `#ifdef H5` 条件编译，仅在 H5 / 桌面端注册，小程序与 App 端不打包。

### 页面结构



| 路由                  | 页面          | 内容                                                         |
| ------------------- | ----------- | ---------------------------------------------------------- |
| `/`                 | 首页          | Hero、四方痛点、产品功能、四方解决方案、vs 真人教师对比、数据背书、FAQ 精选、联系区            |
| `/features`         | 功能介绍        | 七大能力详细分栏（自动上课 / 数字人授课 / 实时互动 / 课后辅导 / 作业批改 / 个性化学情 / 家长看课） |
| `/cases`            | 客户案例        | 合作学校案例展示（示意数据显著标注）                                         |
| `/faq`              | 常见问题        | 部署 / 断网 / 数据安全 / 辅导开通 / 如何合作 / 售后                          |
| `/about`            | 关于我们        | 产品与团队介绍                                                    |
| `/contact`          | 联系我们        | 留资表单 + 电话 / 工作时间 / 微信二维码                                   |
| `/privacy` `/terms` | 隐私政策 / 用户协议 | 合规页（正文待法务提供）                                               |

### 官网功能特性

* **水墨符号粒子背景**（`components/site/InkSymbols.vue`）：学科符号（π∑√、诗書春秋、李白杜甫、CO₂/H₂O 等）朱砂淡染漂浮，鼠标靠近 250px 内轻聚拢、静止 1.5s 温和散开，滚动每 0.9 视口随机换字；reduced-motion 自动降级为静态。官网首页与登录页共用。

* **滚动浮现动效**（`composables/useReveal.ts`）：内容块进入视口时 blur+上浮浮现（0.65s），threshold 0.05 + 视口内兜底，快速滚动不留空白带；深链锚点/浏览器恢复滚动位置时强制显示。

* **自托管宋体**：Noto Serif SC 700/900 官方 unicode-range 分片（`static/fonts/noto-serif-sc/` + `styles/fonts.css`），display 字面不依赖系统衬线兜底；新增文案出现缺字时重跑分片脚本扩展即可。

* **跳转语义**：官网/登录页间跳转 H5 端用 `uni.navigateTo`（浏览器后退可用），小程序/App 端保持 `reLaunch`（SiteHeader/SiteFooter/各页 `go()` 内条件编译）。

* **留资表单**：首页 / 联系页 / 全站浮窗三处共用，提交后写入后端 `POST /leads/public`，在管理后台「咨询留资」页实时查看（来源标记为官网）。

* **全站咨询浮窗**：右下角常驻，点开直接看到联系方式与预约表单。

* **后台可配置**（管理后台「官网设置」，super\_admin，保存即生效）：


  * ICP 备案号：**未备案留空时官网页脚自动隐藏备案位**，备案通过后填写即可，无需改代码；

  * 咨询电话 / 工作时间 / 微信公众号 / 二维码图片；

  * 数据背书数值（已服务学校数 / 覆盖学生数 / 节支成本）。

* **转化埋点**：pageview /lead\_submit 事件上报（含来源 referrer 与 utm 参数），落库 `TrackingEvent` 表，支撑流量与留资来源分析。

* **价格不公开**：全站不出现任何价格数字，FAQ 以「如何合作」引导留资；价格线下洽谈，谈妥后在后台按学校配置订阅（开通时长 / 价格 / 功能模块），灵活调价。

* **SEO**：每个页面独立 title /description/keywords，便于学校搜索「AI 老师」「智能教学」触达。

* **响应式**：手机端与电脑端完整适配。

### 常用地址



* 官网：[http://localhost:5175/#/pages-site/index](http://localhost:5175/#/pages-site/index)

* 管理后台：[http://localhost:5175](http://localhost:5175)

* 后端 API：[http://localhost:3000/api/v1](http://localhost:3000/api/v1)

* Swagger 文档：[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

* MinIO 控制台：[http://localhost:9001](http://localhost:9001)（minioadmin / minioadmin123）

## 界面截图

> 截图为本机实测（官网首页更新于 2026-09-30，其余为 2026-09-25），数据为演示种子数据；完整截图源文件在 `docs/screenshots/`。

### 官网

![官网首页](docs/screenshots/website_viewport/home.png)

<details>
<summary>更多官网页面截图（首页完整长图 + 全部页面）</summary>

![官网首页·完整长图](docs/screenshots/website/home.png)

![功能介绍](docs/screenshots/website_viewport/features.png)

![客户案例](docs/screenshots/website_viewport/cases.png)

![常见问题](docs/screenshots/website_viewport/faq.png)

![关于我们](docs/screenshots/website_viewport/about.png)

![联系我们](docs/screenshots/website_viewport/contact.png)

</details>

### 管理后台

#### 登录页

![登录页](docs/screenshots/admin/login.png)

> 学生/管理员登录页（`pages/login/index.vue`）与管理后台登录同布局：桌面端双栏（左侧品牌区：朱砂方章 + AI Teacher + 特性要点 + 价值胶囊；右侧白卡：欢迎登录 + 学生/管理员双 tab 表单 + 演示账号），窄屏（≤960px）退化为单栏；底色与官网同为宣纸白，共享水墨符号粒子背景。

#### 超级管理员 superadmin（全部功能）

![首页概览](docs/screenshots/admin/superadmin/dashboard.png)

<details>
<summary>更多 superadmin 功能页（学校 / 订阅 / 留资 / 官网设置 / 工单 / 设备 / 报表）</summary>

![学校管理](docs/screenshots/admin/superadmin/schools.png)

![订阅管理](docs/screenshots/admin/superadmin/subscription.png)

![咨询留资](docs/screenshots/admin/superadmin/leads.png)

![官网设置](docs/screenshots/admin/superadmin/site-config.png)

![售后工单](docs/screenshots/admin/superadmin/work-orders.png)

![设备管理](docs/screenshots/admin/superadmin/devices.png)

![全局报表](docs/screenshots/admin/superadmin/reports.png)

</details>

#### 学校管理员 school_admin（GZ001_admin，Sunshine High School）

<details>
<summary>学校管理员功能页（首页概览 / 课表 / 教材教案）</summary>

![学校管理员首页概览](docs/screenshots/admin/school_admin/dashboard.png)

![课表管理](docs/screenshots/admin/school_admin/schedules.png)

![教材教案](docs/screenshots/admin/school_admin/textbooks.png)

</details>

#### 年级管理员 grade_admin（GZ001_grade1，高一年级主任）

<details>
<summary>年级管理员功能页（首页概览 / 作业复核）</summary>

![年级管理员首页概览](docs/screenshots/admin/grade_admin/dashboard.png)

![作业复核](docs/screenshots/admin/grade_admin/assignments.png)

</details>

#### 学科管理员 subject_admin（GZ001_math，数学教研组长）

<details>
<summary>学科管理员功能页（首页概览 / 学科题库）</summary>

![学科管理员首页概览](docs/screenshots/admin/subject_admin/dashboard.png)

![学科题库](docs/screenshots/admin/subject_admin/question-bank.png)

</details>

#### 试用学校 trial（FS001_admin，Riverside Academy）

<details>
<summary>试用学校功能页（首页概览）</summary>

![试用学校首页概览](docs/screenshots/admin/trial_school/dashboard.png)

</details>

## 相关文档



* [已归档工程说明](archive/README.md)（迁移前的 admin-web / website / miniprogram）

* [后端服务 README](backend/README.md)

* [API 概览](docs/api/README.md)

* [数据库表说明](docs/database/README.md)

* [部署说明](docs/deploy/README.md)

* [开发指南](docs/development/README.md)

* [官网正式工程实施方案（含实施记录）](docs/product/官网正式工程实施方案.md)

* [PRD 与代码差异分析](docs/qa/PRD对照差异分析.md)

* [产品需求文档（PRD）](docs/product/AI-Teacher-产品需求文档.md)
