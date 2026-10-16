# edge-vision · 课堂视觉感知模块

> ⚠️ **本项目是「模型训练 / 算法实验仓库」，不是生产实现。**
>
> 生产可用的视觉识别在 **`classroom-client/vision-service/`**（人脸检测与识别、举手识别、纪律检测、麦克风阵列、双链路切换、教材 OCR 均已实现）。
> 本目录的目标是验证 **YOLO26-N + ByteTrack** 的行为识别方案，**行为分类头尚未训练** ——
> `src/detector.py` 中 `behavior` 字段目前是占位默认值 `focus`，没有真实分类能力。
> 因此下文目录结构里列出的 `src/behavior_classifier.py` **尚不存在**，属规划项。
>
> 两者分工：**vision-service 跑在教室盒子上做生产推理；edge-vision 做模型实验与训练**。不要混用。

教室摄像头实时识别学生行为，产生结构化事件推给后端 LessonAgent。

## 环境

- Python 3.12（conda env: `ai-teacher`）
- GPU: RTX 5080 Laptop（CUDA 13.0, sm_120）
- 模型: YOLO26-N/S + ByteTrack

## 目录结构

```
edge-vision/
├── src/                    # 主程序
│   ├── config.py           # 配置加载
│   ├── detector.py         # YOLO26 检测+跟踪
│   ├── behavior_classifier.py  # 【规划中·尚未实现】行为分类头
│   ├── event_sender.py     # 事件上报后端
│   ├── storage.py          # MinIO 上传视频/照片
│   └── main.py             # 入口：读 RTSP → 推理 → 推事件
├── configs/
│   └── behaviors.yaml      # 10 类行为定义 + 阈值
├── data/                   # 数据集存放（.gitignore）
├── models/                 # 模型权重（.gitignore）
├── scripts/                # 验证/工具脚本
├── output/                 # 调试输出（.gitignore）
├── .env.example
└── requirements.txt
```

## 快速开始

```powershell
conda activate ai-teacher
python scripts/test_yolo_gpu.py
```

## 10 类行为标签

| 标签 | 类别 | 触发录像？ |
|---|---|---|
| focus | 正常 | ❌ |
| hand_raise | 正常 | ❌ |
| writing | 正常 | ❌ |
| standing | 正常 | ❌ |
| sleeping | 违纪 | ✅ |
| using_phone | 违纪 | ✅ |
| talking | 违纪 | ✅ |
| eating | 违纪 | ✅ |
| leaving_seat | 违纪 | ✅（规则组合判） |
| walking | 违纪（条件） | ⚠️ 上课 15 分钟后触发 |
