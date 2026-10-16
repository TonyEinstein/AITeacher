# 开发指南

## 环境准备

- **Node.js 20+**（建议 20 LTS）
- **Docker Desktop / Docker Engine + Compose 插件**
- **Git**
- 可选：Python（教材 OCR 脚本用到）、ffmpeg（媒体转码）

## 启动顺序

### 方式一：一键启动（推荐）

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

依次启动：Docker 容器 → 后端（3000）→ uni-app H5（5175，管理后台 + 官网同一产物）。停止用 `.\scripts\stop-all.ps1`。

### 方式二：手动分步

1. 启动中间件：
   ```powershell
   cd E:\AITeacher\infra\docker
   .\start.ps1
   ```
   等待 PostgreSQL / Redis / MinIO / SRS 全部 healthy。

2. 初始化数据库与种子数据：
   ```powershell
   cd E:\AITeacher\backend
   npm install
   # 确认 .env 中 DATABASE_URL=postgresql://postgres:ai_teacher_dev_2026@127.0.0.1:5433/ai_teacher?schema=public
   npx prisma db push
   npx prisma db seed
   ```

3. 启动后端（端口 3000）：
   ```powershell
   npm run start:dev
   ```
   看到 `🚀 后端服务启动成功: http://localhost:3000/api/v1` 即就绪。

4. 启动 uni-app H5（端口 5175，管理后台 + 官网同一产物）：
   ```powershell
   cd E:\AITeacher\apps\mobile
   npm install
   npm run dev:h5
   ```

5. 浏览器打开 <http://localhost:5175>（管理后台）、<http://localhost:5175/#/pages-site/index>（官网），用测试账号登录。

## 测试账号（密码均为 123456）

| 账号 | 角色 | 用途 |
|---|---|---|
| `superadmin` | 超级管理员 | 全校/订阅/工单/留资/全局监控 |
| `GZ001_admin` | 学校管理员 | Sunshine High School |
| `GZ001_grade1` | 年级管理员 | 高一 |
| `GZ001_math` | 学科管理员 | 数学 |
| `SZ001_admin` / `FS001_admin` / `DG001_admin` | 学校管理员 | 其他学校 |

## 常用地址

- 管理后台 / 官网（uni-app H5）：<http://localhost:5175>
- 后端 API：<http://localhost:3000/api/v1>
- Swagger 接口文档：<http://localhost:3000/api/docs>
- Prisma Studio：在 `backend` 目录执行 `npx prisma studio`
- MinIO 控制台：<http://localhost:9001>（minioadmin / minioadmin123）

## 调试技巧

- **改了 Prisma schema**：`npx prisma db push`（开发）或 `npx prisma migrate dev`（要生成迁移），再 `npx prisma generate` 刷新客户端类型。
- **改了后端代码**：`start:dev` 自动 watch 重启；想打断点用 `npm run start:debug`。
- **改了前端代码**：Vite 热更新自动生效。
- **接口报错**：先看终端日志；前端 Axios 在 `src/utils/request.ts` 统一处理错误。
- **数据库连不上**：确认 `.\start.ps1` 里 postgres 容器是 healthy；连接串密码是 `ai_teacher_dev_2026`。
- **重新灌种子数据**：seed.ts 全部用 `upsert`/按手机号去重，重复执行不会重复插。
- **MinIO 上传失败**：确认 bucket `ai-teacher` 已建（首次可手动在控制台建，或后端启动时自动建）。
- **SRS 拉流黑屏**：确认有教室在推流（`GET /live/push/room/:roomId` 返回推流地址），否则前端就是空画面。

## 代码结构速览

```
E:\AITeacher\
├── apps\mobile\      # uni-app 五端业务代码（H5 / 小程序 / App / 桌面复用）
├── apps\desktop\     # Tauri v2 桌面壳（加载 mobile 的 H5 产物）
├── archive\          # 已下线工程（admin-web / website / miniprogram）
├── backend\          # NestJS 后端
│   ├── src\
│   │   ├── <模块>\   # 每个业务模块 controller/service/module
│   │   ├── auth\     # JWT 鉴权、RolesGuard
│   │   ├── common\   # 拦截器、异常过滤器
│   │   ├── minio\    # 对象存储
│   │   ├── queue\    # BullMQ
│   │   ├── llm\      # LLM 调用
│   │   └── main.ts   # 启动入口（全局前缀 /api/v1、Swagger /api/docs）
│   └── prisma\
│       ├── schema.prisma
│       └── seed.ts
├── infra\            # Docker 与树莓派部署
├── scripts\           # 一键启动 / 停止 / 健康检查
├── deliverables\      # 对外交付物（产品介绍 PPT）
└── docs\              # 项目文档（架构图 / PRD / QA 报告 / 官网原型 / 媒体）
```
