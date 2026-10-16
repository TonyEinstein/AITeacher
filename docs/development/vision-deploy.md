# AI Teacher 课堂视觉感知模块 — 部署文档

## 1. 组件一览

| 组件 | 技术栈 | 端口 | 说明 |
|---|---|---|---|
| edge-vision | Python 3.12 + YOLO26 + ByteTrack | — | 边缘盒子上跑，推事件到后端 |
| backend | NestJS + Prisma + Postgres | 3000 | 接收事件、存库、Agent 读取 |
| apps/mobile（H5） | uni-app（Vue3） | 5175 | 报表/时间线页面（`npm run dev:h5`） |
| PostgreSQL | Docker | 5433 | BehaviorEvent + ClassMinuteAggregate 表 |
| Redis | Docker | 6380 | BullMQ 队列 |
| MinIO | Docker | 9000 | 违纪视频/照片存储 |

## 2. 开发环境启动

```powershell
# 1. 起依赖
docker start ai-teacher-postgres ai-teacher-redis

# 2. 起后端
cd E:\AITeacher\backend
npm run start:dev

# 3. 起前端
cd E:\AITeacher\apps\mobile
npm run dev:h5

# 4. 健康检查
.\scripts\health-check.ps1
```

## 3. 边缘端部署（AI 盒子）

```powershell
# 1. 装 conda 环境
conda create -n ai-teacher python=3.12
conda activate ai-teacher
pip install -r edge-vision/requirements.txt

# 2. 配 .env
cd edge-vision
copy .env.example .env
# 编辑 .env：填 BACKEND_BASE_URL、EDGE_API_TOKEN、学校/班级 ID

# 3. 跑主循环
python src/main.py --source rtsp://摄像头IP:554/stream
```

## 4. API 一览

| 方法 | 路径 | 用途 | 鉴权 |
|---|---|---|---|
| POST | /api/v1/vision/events | 边缘端上报事件 | x-edge-token |
| POST | /api/v1/vision/aggregates | 上报每分钟聚合 | x-edge-token |
| GET | /api/v1/vision/config | 拉取远程配置 | x-edge-token |
| GET | /api/v1/vision/lessons/:id/events | 后台查事件 | JWT |
| GET | /api/v1/vision/lessons/:id/aggregates | 后台查聚合 | JWT |

## 5. 数据保留

- 违纪事件记录：90 天自动清理（后端定时任务）
- 违纪视频/照片：MinIO 生命周期规则 90 天
- 原始视频：默认不存，仅违纪片段 30 秒（前 10 + 后 20）

## 6. 10 类行为标签

| 英文 | 中文 | 类别 |
|---|---|---|
| focus | 专注 | 正常 |
| hand_raise | 举手 | 正常 |
| writing | 写字 | 正常 |
| standing | 起立 | 正常 |
| sleeping | 睡觉 | 违纪 |
| using_phone | 玩手机 | 违纪 |
| talking | 交头接耳 | 违纪 |
| eating | 吃东西 | 违纪 |
| leaving_seat | 离开座位 | 违纪 |
| walking | 走动 | 条件违纪（上课 15 分钟后） |
