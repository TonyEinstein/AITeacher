# vision-service · 教室端视觉/音频服务（生产实现）

教室小盒子上运行的 Python 服务，负责本地感知并把结构化事件上报后端。

## 定位

**本目录是视觉能力的生产实现。**

`edge-vision/`（仓库根目录）是 **YOLO26 模型训练与算法实验仓库**，其行为分类头尚未训练完成，不具备可用性。两者不要混用：

| | vision-service（本目录） | edge-vision（仓库根） |
|---|---|---|
| 角色 | 生产推理，跑在教室盒子 | 模型实验与训练 |
| 方案 | OpenCV / 规则 + 轻量模型 | YOLO26-N + ByteTrack |
| 状态 | 各模块已实现 | 骨架，缺行为分类头 |

## 模块

| 目录 | 文件 | 职责 |
|---|---|---|
| `face/` | `detector.py`、`recognizer.py` | 人脸检测与识别（学生到座、身份确认） |
| `behavior/` | `hand_raise.py`、`discipline.py` | 举手识别、纪律检测（说话/走动/睡觉/趴桌） |
| `audio/` | `mic_array.py` | 四麦阵列噪声检测 |
| `network/` | `monitor.py`、`ws_client.py` | 双链路切换（网线 ↔ 4G）、WebSocket 上报 |
| `ocr/` | `parse_textbook.py` | 教材扫描版 OCR 解析 |
| `main.py` | — | 服务入口 |
| `config.ini` | — | 运行配置 |

## 上报协议

- **WebSocket**：命名空间 `/ws`，事件名 `event`，处理逻辑见 `backend/src/realtime/realtime.gateway.ts`
- **HTTP 兜底**：`POST /api/v1/lesson-records/:id/behavior`，写入 `BehaviorEvent` 表

### ⚠️ 行为事件必须带 `category`

`BehaviorEvent.category` 取值：`normal` / `violation` / `violation_conditional`。

后端课后打分依赖该字段区分**正常行为**与**违纪行为** —— 只有 `violation` 会扣纪律分。
若把 `focus`（专注）、`hand_raise`（举手）等正常行为误标为 `violation`，会导致纪律分被错误扣减。

## 行为标签

| 标签 | category | 是否触发录证 |
|---|---|---|
| focus 专注 | normal | ❌ |
| hand_raise 举手 | normal | ❌ |
| writing 写字 | normal | ❌ |
| standing 起立 | normal | ❌ |
| sleeping 睡觉 | violation | ✅ |
| using_phone 玩手机 | violation | ✅ |
| talking 讲话 | violation | ✅ |
| eating 吃东西 | violation | ✅ |
| leaving_seat 离开座位 | violation | ✅ |
| walking 走动 | violation_conditional | ⚠️ 上课 15 分钟后 |

## 运行

依赖见 `requirements.txt`，配置见 `config.ini`。
树莓派上由 systemd `ait-vision.service` 托管，相关脚本见 `infra/pi/`。
