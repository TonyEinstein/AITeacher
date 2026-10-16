# AI Teacher Docker 开发环境

容器组名称：**ai-tutor**

## 快速操作

| 操作 | 命令 | 说明 |
|------|------|------|
| 启动 | `.\start.ps1` | 容器已存在则 start，不存在才 up -d |
| 停止 | `.\stop.ps1` | 仅 stop，不删除容器和数据卷 |
| 状态 | `.\status.ps1` | 查看容器和数据卷状态 |
| 重建 | `.\rebuild.ps1` | **危险操作**，仅大版本变动时使用 |

## 包含的服务

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| PostgreSQL 16 | ai-teacher-postgres | 5433 → 5432 | 主数据库（宿主端口偏移） |
| Redis 7 | ai-teacher-redis | 6380 → 6379 | 缓存 + BullMQ 队列（宿主端口偏移） |
| MinIO | ai-teacher-minio | 9000 / 9001 | 对象存储（S3 API / 控制台） |
| SRS 5 | ai-teacher-srs | 1935 / 8080 / 1985 | 直播流媒体（RTMP / HTTP-FLV / API） |

## 操作规范（务必遵守）

### 日常只用 stop / start，绝不用 down / rm

- `docker compose stop` — 停止容器，容器和数据卷都保留，下次 start 秒级恢复
- `docker compose down` — **删除容器**，下次 up 时需重新创建，耗时久（拉镜像/初始化/健康检查）
- 本地虽有镜像，但重建过程仍然很慢，且容器内的临时状态、日志会丢失

### 什么时候才需要重建（rebuild.ps1）

1. `docker-compose.yml` 中服务配置有大变动（端口/环境变量/挂载/镜像版本）
2. 后端大版本升级，需要重新 build 镜像
3. 容器损坏无法启动，且修复无效
4. 除此之外，一律 stop / start

### 数据安全

- 数据卷（postgres_data / redis_data / minio_data）不会被 `down` 删除
- 但如果用了 `docker compose down -v` 或手动删除 volume，数据会丢失
- 生产环境数据库建议定期备份

## 数据库初始化

如果是新 volume（首次启动或重建后），需要初始化数据库：

```powershell
cd ..\..\backend
$env:DATABASE_URL = "postgresql://postgres:ai_teacher_dev_2026@127.0.0.1:5433/ai_teacher?schema=public"
npx prisma db push
npx prisma db seed
```

默认超级管理员：`superadmin` / `123456`

## 生产环境

生产环境使用 `docker-compose.prod.yml`，容器组名 `ai-tutor-prod`，包含后端和管理端的 build 配置。操作规范相同：日常 start/stop，大版本变动才重建。
