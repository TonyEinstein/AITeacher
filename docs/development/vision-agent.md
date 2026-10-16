# 课堂视觉感知模块设计文档

## 1. 概述

教室摄像头实时识别学生行为，产生结构化事件推给 LessonAgent；违纪自动录像拍照存证。

## 2. 技术栈

- **检测模型**: YOLO26-N（Ultralytics 2026 官方，2.6M 参数）
- **跟踪**: ByteTrack（YOLO26 内置）
- **边缘推理**: Python 3.12 + PyTorch 2.14 (CUDA 13.2)
- **GPU**: RTX 5080 Laptop（sm_120，15.9GB 显存）
- **推理速度**: ~8.6ms/帧（116 FPS，1280x720）
- **后端**: NestJS + Prisma + BullMQ + MinIO

## 3. 10 类行为标签

| 标签 | 类别 | 触发录像 |
|---|---|---|
| focus | normal | ❌ |
| hand_raise | normal | ❌ |
| writing | normal | ❌ |
| standing | normal | ❌ |
| sleeping | violation | ✅ |
| using_phone | violation | ✅ |
| talking | violation | ✅ |
| eating | violation | ✅ |
| leaving_seat | violation | ✅（规则组合） |
| walking | violation_conditional | ⚠️ 上课 15 分钟后 |

## 4. 系统架构

```
[2 路 RTSP 摄像头]
    ↓
[边缘盒子 edge-vision]
  ├─ YOLO26 检测 person
  ├─ ByteTrack 分配 track_id
  ├─ 行为分类（8 类模型 + 2 类规则）
  ├─ 防抖：连续 N 帧稳定才确认
  ├─ 违纪检测 → 录 30s + 3 张关键帧 → MinIO
  └─ 事件 POST → 后端 /vision/events
                      ↓
[NestJS 后端]
  ├─ 写 BehaviorEvent 表
  ├─ 每分钟聚合 → ClassMinuteAggregate 表
  └─ Socket.IO 推老师端大屏
```

## 5. 违纪存证策略

- 视频长度：触发前 10 秒 + 触发后 20 秒 = 30 秒
- 照片：3 张关键帧（触发瞬间/最明显/结束）
- 保留：90 天自动删除
- 防抖：同学生同类 5 分钟内不重复录像，只计数
- 存储：MinIO bucket `classroom-evidence`

## 6. 数据集

| 角色 | 数据集 | 规模 |
|---|---|---|
| 主力 | ARIC | 36453 图 / 32 类 |
| 主力 | SCB-Dataset5 | 7428 图 / 20 类 |
| 补充 | MSCB | 5709 图 / 7 类 |
| 时序 | STSCB | 24628 帧 |
| 时序 | BNU-Wu | 128 节课 |

## 7. 数据库表

### BehaviorEvent（扩展）
- edgeTrackId, type(10类), category, confidence, bbox, videoUrl, snapshotUrls, acknowledged

### ClassMinuteAggregate（新建）
- lessonRecordId, minuteStart, 各行为计数, totalDetected
- 唯一约束: (lessonRecordId, minuteStart)

## 8. 边缘-云 API

### POST /vision/events
```json
{
  "schoolId": 1, "gradeId": 1, "classId": 1, "lessonRecordId": 1,
  "edgeTrackId": "track-7", "behavior": "talking",
  "category": "violation", "confidence": 0.87,
  "bbox": [120,340,200,500], "timestamp": "2026-09-26T10:00:00Z",
  "durationSec": 12, "videoUrl": null, "snapshotUrls": null
}
```
Header: `x-edge-token: <token>`

### POST /vision/aggregates
每分钟上报一次班级聚合统计。

## 9. 硬件配置

- 每教室 2 个摄像头：前墙（正面+全景）+ 后墙（俯拍背影）
- 边缘盒子：硬件到后定（候选 Jetson Orin Nano / RK3588）

## 10. 待办

- [ ] 下载数据集做标签映射
- [ ] 用 SCB5+ARIC 微调 YOLO26 行为分类头
- [ ] 边缘端 RTSP 接入
- [ ] 真实教室采数据微调
- [ ] 90 天自动清理定时任务
- [ ] 老师端实时大屏前端页面
