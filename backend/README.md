# AI-Teacher 后端服务（backend）

AI Teacher 智能教学系统的服务端，基于 NestJS 提供管理后台、小程序、教室小盒子三类端的 REST API，负责鉴权、组织架构、教学调度、作业考试、课堂事件、辅导、订阅商务等全部业务逻辑。

## 技术栈

- **NestJS 12** + **TypeScript 6**
- **Prisma 5** ORM + **PostgreSQL 16**
- **Redis 7**（ioredis）+ **BullMQ 6** 队列
- **MinIO**（S3 兼容对象存储，教材/作业照片/人脸）
- **SRS 5** 流媒体（家长/巡课拉流）
- **JWT**（passport-jwt）鉴权，bcrypt 密码哈希
- **Swagger**（`@nestjs/swagger`）自动接口文档
- Socket.io（实时课堂事件）、Multer（文件上传）、class-validator（DTO 校验）

## 启动方式

环境要求：Node.js 20+，并已通过 `infra/docker` 启动 PostgreSQL / Redis / MinIO / SRS。

```bash
cd backend
npm install

# 配置环境变量（见下文）
cp .env.example .env   # 若没有 .env.example，参考下方变量手写 .env

# 首次：建表 + 种子数据
npx prisma db push
npx prisma db seed

# 开发启动（watch 模式）
npm run start:dev
```

服务默认端口 **3000**：

- 业务 API 前缀：<http://localhost:3000/api/v1>
- Swagger 文档：<http://localhost:3000/api/docs>
- 健康检查：`GET http://localhost:3000/api/v1/` 或 `/api/v1/health`

生产运行：

```bash
npm run build
npm run start:prod
```

## 环境变量（.env）

| 变量 | 说明 | 本地默认 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:ai_teacher_dev_2026@127.0.0.1:5433/ai_teacher?schema=public` |
| `PORT` | 监听端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥 | 代码兜底 `ai_teacher_jwt_secret_2026`，生产务必覆盖 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 地址 | `127.0.0.1` / `6380` |
| `MINIO_ENDPOINT` | MinIO 地址 | `127.0.0.1` |
| `MINIO_PORT` | MinIO API 端口 | `9000` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO 账号 | `minioadmin` / `minioadmin123` |
| `MINIO_BUCKET` | 默认 bucket | `ai-teacher` |
| `SRS_HOST` / `SRS_HTTP_PORT` / `SRS_RTMP_PORT` | SRS 流媒体地址 | `127.0.0.1` / `8080` / `1935` |
| `DEEPSEEK_API_KEY` | LLM（DeepSeek）Key | 无 |
| `WX_APPID` / `WX_SECRET` | 微信小程序 | 无 |
| `WX_TEMPLATE_HOMEWORK` | 微信订阅消息模板 ID（作业下发） | 无 |
| `OCR_PYTHON` / `OCR_SCRIPT_PATH` / `FFMPEG_PATH` | 教材 OCR / 转码工具 | `python` / 系统命令 |
| `OTA_VERSION` / `OTA_PACKAGE_URL` / `OTA_CHECKSUM` | 教室端 OTA 升级包 | 无 |

## 测试账号

密码统一 `123456`（`prisma/seed.ts` 初始化）：

| 账号 | 角色 |
|---|---|
| `superadmin` | super_admin 超级管理员 |
| `GZ001_admin` | school_admin 学校管理员 |
| `GZ001_grade1` | grade_admin 年级管理员 |
| `GZ001_math` | subject_admin 学科管理员 |

## 模块清单（按 controller 路由前缀）

全局前缀 `/api/v1`，所有受保护接口走 `JwtAuthGuard`，写操作再叠加 `RolesGuard` + `@Roles(...)`。

| 模块 | 路由前缀 | 主要职责 |
|---|---|---|
| 应用 | `/` | 根路径、`/health` 健康检查 |
| 认证 | `/auth` | 账号密码登录、当前用户 profile |
| 微信 | `/wechat` | 小程序 code2session 登录、订阅消息推送 |
| 学校 | `/schools` | 学校 CRUD（Super） |
| 校区 | `/campuses` | 校区列表/新建/编辑 |
| 年级 | `/grades` | 年级 CRUD |
| 班级 | `/classes` | 班级 CRUD |
| 学生 | `/students` | 学生 CRUD |
| 用户 | `/users` | 教师/管理员账号 CRUD |
| 家长 | `/parents` | 家长绑定、查自己 |
| 教材 | `/textbooks` | 上传、解析、章节、删除 |
| 教案 | `/lesson-plans` | 生成大纲/教案、编辑、确认锁版 |
| 课表 | `/schedules` | 手动/自动排课、当日课表 |
| 授课 Agent | `/agents` | Agent CRUD、风格调整 |
| 教室 | `/rooms` | 教室 CRUD |
| 小盒子 | `/boxes` | 注册、心跳、OTA、全量列表、绑教室 |
| 上课记录 | `/lesson-records` | 开始/结束、行为事件、考勤上报 |
| 作业 | `/assignments` | 生成/下发/提交/AI 批改/老师复核 |
| 题库 | `/question-bank` | 题目 CRUD、批量导入、知识点 |
| 错题本 | `/wrong-questions` | 学生错题查询/统计/删除 |
| 考试 | `/exams` | 考试 CRUD、组卷、锁卷、作弊记录、判分、分析 |
| 请假 | `/leaves` | 申请、审批、待审批列表 |
| 评估 | `/evaluations` | 打分、学生报告、纪律警告 |
| 排名 | `/rankings` | 班级/年级成绩、班级/年级表现、跨校排名 |
| 巡课 | `/live` | 教室推流/拉流地址 |
| 辅导 | `/tutoring` | 学生辅导订阅、设备注册/心跳、会话与对话 |
| 偏好 | `/preferences` | 学生风格/语速/近视提醒偏好 |
| 家长留言 | `/parent-messages` | 留言提交、待审、通过/驳回/已转达 |
| 通知 | `/notifications` | 列表、已读、未读数 |
| 分享 | `/shares` | 学生/班级/年级/学校分享快照、公开访问、留资 |
| 数字人形象 | `/avatars` | 形象列表、新建、学校定制 |
| 问卷 | `/surveys` | 发布、答题、统计 |
| 订阅 | `/subscriptions` | 列表、按校续期/配置/启停（Super） |
| 留资 | `/leads` | 公开留资、后台列表/删除（Super） |
| 官网配置 | `/site-config` | 官网公开配置读写：ICP 备案号/联系方式/数据背书；`GET /site-config/public` 无鉴权供官网读取 |
| 转化埋点 | `/tracking` | 官网 pageview/lead_submit 事件上报（无鉴权，含 referrer/utm/meta 白名单） |
| 工单 | `/work-orders` | 售后工单统计/流转（Super） |
| 驾驶舱 | `/dashboard` | 全局/学校/年级/班级驾驶舱、学校健康（Super）、LLM 用量、成本 ROI 报表 |
| 人脸库 | `/face-library` | 人脸照片上传、特征提取、按学生/班/校查询、下发盒子 |
| 学生预警 | `/alerts` | 预警扫描、列表、统计、处理（成绩下滑 / 连续缺课 / 纪律频发 / 出勤异常） |

## 常用脚本

```bash
npm run start:dev        # 开发 watch
npm run build            # 编译
npm run lint             # oxlint 检查
npm run test             # vitest 单测
npx prisma studio        # 可视化数据库
npx prisma db push       # 同步 schema 到数据库
npx prisma migrate dev   # 生成迁移
npx prisma db seed       # 灌种子数据（可重复执行）
```

### 端到端验证脚本

`scripts/` 下的验证脚本按真实依赖装配 Service（不加载 controller，避免拉起守卫依赖链），
在真实数据库上造数据 → 跑链路 → 断言，可重复运行，失败时以非零码退出。

| 脚本 | 覆盖链路 | 断言数 |
|---|---|---|
| `verify-evaluation-chain.ts` | 造课（考勤/正常+违纪行为/警告/作业）→ 打分 → 情绪 → 预警 → 排名 | 15 |
| `verify-lesson-agent-chain.ts` | 备课解析 → 启课 → 事件自动转发 → 答疑 → 评估 → 下课 + 防双写 | 25 |
| `verify-weakness-profile.ts` | 批改 → 错题（含知识点）→ 薄弱画像 → 学情报告落库 | 15 |
| `verify-schedule-adjust.ts` | 整体顺延 / 停课补课 / 改时间冲突 / 参数边界 | 21 |
| `verify-group-overview.ts` | 跨校区汇总 + 集团管理员数据范围与越权防护 | 19 |

```bash
npx ts-node --transpile-only scripts/verify-evaluation-chain.ts
```

权限矩阵单测：`src/auth/guards/roles.guard.spec.ts`（平台级接口 group_admin 必须被拒等 21 项）。
