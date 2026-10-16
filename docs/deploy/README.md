# 部署说明

本地开发与生产部署均基于 Docker Compose，中间件（PostgreSQL / Redis / MinIO / SRS）在 `infra/docker/` 下编排。

## Docker Compose 服务

文件：`infra/docker/docker-compose.yml`（开发）、`infra/docker/docker-compose.prod.yml`（生产）。容器组名 `ai-tutor`。

| 服务 | 镜像 | 容器名 | 端口 | 用途 |
|---|---|---|---|---|
| PostgreSQL 16 | `postgres:16-alpine` | `ai-teacher-postgres` | 5433 → 5432 | 主数据库（开发环境宿主端口偏移） |
| Redis 7 | `redis:7-alpine` | `ai-teacher-redis` | 6380 → 6379 | 缓存 + BullMQ 队列（开发环境宿主端口偏移） |
| MinIO | `minio/minio:latest` | `ai-teacher-minio` | 9000（S3 API）/ 9001（控制台） | 对象存储 |
| SRS 5 | `ossrs/srs:5` | `ai-teacher-srs` | 1935（RTMP）/ 8080（HTTP-FLV）/ 1985（HTTP API） | 家长/巡课直播流 |

数据卷：`postgres_data`、`redis_data`、`minio_data`（`down` 不会删除，但 `down -v` 会）。

## 启动脚本（Windows PowerShell，位于 infra/docker/）

| 操作 | 命令 | 说明 |
|---|---|---|
| 启动 | `.\start.ps1` | 容器已存在则 start，不存在才 up -d |
| 停止 | `.\stop.ps1` | 仅 stop，保留容器与数据 |
| 状态 | `.\status.ps1` | 查看容器和数据卷 |
| 重建 | `.\rebuild.ps1` | **仅大版本变动时使用** |

> 规范：日常只用 `start.ps1` / `stop.ps1`，不要随便 `docker compose down`，否则下次启动要重新拉镜像、初始化，耗时很久。

## 首次初始化数据库

```powershell
cd E:\AITeacher\infra\docker
.\start.ps1

cd ..\..\backend
$env:DATABASE_URL = "postgresql://postgres:ai_teacher_dev_2026@127.0.0.1:5433/ai_teacher?schema=public"
npx prisma db push
npx prisma db seed
```

默认超管：`superadmin` / `123456`。

## 默认端口汇总

| 服务 | 端口 |
|---|---|
| 后端 API（NestJS） | 3000 |
| uni-app H5 开发（管理后台 + 官网） | 5175 |
| PostgreSQL | 5433 |
| Redis | 6380 |
| MinIO API / 控制台 | 9000 / 9001 |
| SRS RTMP / HTTP-FLV / API | 1935 / 8080 / 1985 |

## 官网部署

- 官网页面已迁入 uni-app（`apps/mobile/src/pages-site/`，`#ifdef H5` 条件编译），随主站 H5 产物发布；`apps/mobile/dist/build/h5/` 可直接部署到任意静态托管（腾讯云 COS / Nginx / CDN）。
- 生产建议直接用 `apps/mobile/Dockerfile` 构建镜像（compose 服务名 `mobile-web`，容器 `ait-web`，nginx 托管静态资源并把 `/api/` 反代到 `backend:3000`）。
- 上线前在管理后台「官网设置」填写 ICP 备案号、真实电话/微信/二维码与数据背书数值；未备案时官网自动隐藏备案位，备案通过后填写即可。
- 前后端接口地址由构建期 `VITE_API_BASE` 决定（见 `apps/mobile/src/config/env.ts`）：同域部署留空即走 `/api/v1`；若前后端不同域，构建时传入正式 HTTPS 域名并在后端 CORS 白名单加入该域名。
- 上线部署依赖域名 + ICP 备案（见任务 3.4.05）。

## 生产部署要点

- 生产用 `docker-compose.prod.yml`，容器组名 `ai-tutor-prod`，含后端与前端 build。
- 生产数据库建议用腾讯云托管 PostgreSQL，自建 Redis / MinIO / SRS 用 Docker 跑在 CVM。
- 服务器：Ubuntu 22.04，安装 Docker + Docker Compose 插件 + Nginx。
- 上线步骤：`git pull` → `docker compose build` → `docker compose up -d` → `docker compose exec backend npx prisma migrate deploy`。
- 详见 `infra/部署运维手册.md`。

## 树莓派教室端

教室小盒子相关脚本与 systemd 服务在 `infra/pi/`：

- `ait-vision.service`：视觉识别服务
- `ait-classroom.service`：课堂主程序
- `ota-update.sh`：远程 OTA 升级
- `pi-first-setup.sh`：首次开机初始化
