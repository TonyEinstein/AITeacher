# 课堂行为识别缺口 —— 独立工作项

> 状态：**未开始（待排期）**
> 记录日期：2026-10-09
> 来源：C 工程增强项 E3 调查中发现的产品级缺口（详见 [验证报告](./2026-10-09-engineering-enhancements-verification.md) 第三、四节）

## 一、问题

**「课堂专注率」在真实数据链路上恒等于 100%，该指标目前不具信息量。**

同时受影响的还有两条产品能力：

| 受影响能力 | 现状 |
|---|---|
| 课堂专注率 | 恒 100%（`focusCount ≡ totalDetected`） |
| 课堂行为分布图 | `talking/sleeping/handRaise` 等序列恒为 0（曲线是平的） |
| 违纪当场提醒（走神/睡觉/玩手机） | `_process_violations()` 在真实数据上**永不触发** |

## 二、根因（三段链路断在两处）

```
教室摄像头 → 行为识别 → 每分钟聚合 → 前端专注率
```

| 环节 | 状态 | 证据 |
|---|---|---|
| ① 行为识别 | **断** | `edge-vision/src/detector.py` 构造 `TrackedPerson` 时不传 `behavior`，恒取默认值 `"focus"`；模型 `yolo26n.pt` 是 COCO **person 检测**，不做行为分类 |
| ② 每分钟聚合 | 逻辑正确但不适用 | `edge-vision/src/main.py::_aggregate_per_minute` 按 `f"{behavior}Count"` 归类；因 ① 所有 track 落进 `focusCount` |
| ③ 生产端上报 | **断** | 生产实现 `classroom-client/vision-service` 只发 WebSocket `/ws/box` 与 `POST /lesson-records/:id/behavior`，**不上报每分钟聚合** |

**关键认知**：`edge-vision` 的 README 明写自己是「模型训练/算法实验仓库，不是生产实现」。因此**修好 `edge-vision` 并不会让生产环境生效** —— 生产跑的是 `classroom-client/vision-service`。这是「改一行代码」无法解决的，故立为独立工作项。

## 三、现有资产盘点（2026-10-09 实测）

好消息：**基建比 README 声称的完整得多**，主要缺「跑过训练」。

| 资产 | 实际状态 |
|---|---|
| `edge-vision/scripts/train_yolo26.py` | **存在**（66 行；10 类、GPU 训练 `device=0`、含 `export_onnx()`）—— README 称「规划中/尚未实现」，与实际不符 |
| `edge-vision/configs/behaviors.yaml` | 10 类定义完整（`label_id`、normal/violation 分类、证据策略） |
| `datasets/build_merged.py` | **本次新增**：解压 + 合并 + 标签映射 + 生成 `data.yaml` |
| `datasets/label_mapping.py` | **本次修正**：原映射键与实下载数据不符，已按真实类名重写 |
| `datasets/scb5/` | 30G 已下载，含 4 个**检测**子集 + 1 个**分类**子集 |
| `datasets/merged/data.yaml` | **尚不存在** —— 需跑一次 `build_merged.py` 生成 |

## 四、数据现状与限制（重要）

`datasets/scb5/` 的 5 个子集**混装了两种数据集类型**：

| 子集 | 图/标签 | 类型 | 用途 |
|---|---|---|---|
| `SCB5-Discuss-2024-9-17` | 864 / 864 | 检测 | ✅ 可用 |
| `SCB5-Handrise-Read-write-2024-9-17` | 6864 / 6864 | 检测 | ✅ 可用 |
| `SCB5_Teacher_Behavior_...` | 12224 / 12224 | 检测（**教师**行为） | ⚠️ 仅 `stand` 可映射，其余丢弃 |
| `SCB_BowTurnHead_20250509` | 2410 / 2410 | 检测（姿态） | ⚠️ 默认全丢弃（语义模糊） |
| `SCB_LLM_202506` | 22G，每 zip ~1600 jpg，**0 标签** | **分类集** | ❌ **不能用于 YOLO 检测训练** |

### 合并后的类别覆盖（dry-run 实测）

运行 `python datasets/build_merged.py --dry-run`（2026-10-09）得到：

- 保留样本：**train 14,553 / val 5,078**
- 标注框映射：`read+write→writing` 33,919；`stand→standing` 18,899；`hand-raising→hand_raise` 13,453；`discuss→talking` 5,392
- 丢弃：教师行为（`teacher`/`blackBoard`/`screen`/`answer`/`guide`/`blackboard-writing`/`On-stage interaction`）与模糊姿态（`BowHead`/`TurnHead`）

**⚠️ 覆盖限制（必须知悉）**：

| 统一类 | 数据覆盖 |
|---|---|
| focus / hand_raise / writing / standing / talking | ✅ scb5 有数据 |
| **sleeping / using_phone / eating / leaving_seat** | ❌ **scb5 中不存在** |
| `BowHead`/`TurnHead` | 当前全丢弃（1,905+505 样本未被使用） |

### 四类违纪数据从哪来 —— **ARIC 数据集（尚未下载）**

**重要澄清（2026-10-09 修正）**：这四类**不是「无处可得」，而是「对应数据集尚未下载」**。

`datasets/download_datasets.py` 声明了两个数据集：

| key | 名称 | 规模 | 状态 |
|---|---|---|---|
| `scb5` | SCB-Dataset5 | 7,428 图 / 20 类 | ✅ 已下载（30G） |
| **`aric`** | **ARIC** | **36,453 图 / 32 类 / ~15GB** | ❌ **未下载** |

**ARIC 覆盖全部 10 类**，包含本项目的四个缺类（`sleeping` / `using_phone` / `eating` / `leaving_seat`）——
映射表已备在 `datasets/label_mapping.py::ARIC_CLASS_MAP`（见其注释，含 `head_down`→sleeping、
`playing_phone`→using_phone、`out_of_seat`→leaving_seat 等）。

补齐只需：

```bash
pip install huggingface_hub   # 若未装
conda run -n ai-teacher --no-capture-output python datasets/download_datasets.py --aric
```

> ⚠️ 另需澄清：`SCB_LLM_202506`（22G）虽然类目看着多（听讲/举手/讨论/读写/讲授/板书…），
> 但**同样不含这四类违纪行为**，且是纯分类集（无 bbox），对本项目无用。它是本次唯一被排除的子集。

**另外**：`BowHead`/`TurnHead`（低头/转头）当前全丢弃，但低头可人工核对后映射为 `sleeping` 或 `writing`，
转头可映射为 `talking` —— 这 2,410 张已下载样本是**白送的补充数据**，值得人工复核。

## 五、解决方案（按顺序）

### 步骤 1：补齐数据（**当前阻塞点 —— 只需下载 ARIC**）

四类缺类（sleeping / using_phone / eating / leaving_seat）**在 ARIC 中已具备**，无需自行标注：

```bash
pip install huggingface_hub
conda run -n ai-teacher --no-capture-output python datasets/download_datasets.py --aric
# ~15GB，36,453 图 / 32 类；下载后映射表 ARIC_CLASS_MAP 直接可用
```

> 下载后 `build_merged.py` 需扩展以纳入 ARIC（当前 `DETECTION_SUBSETS` 只列 scb5 的 4 个子集；
> ARIC 的子集名与目录布局需先核实，再补入 `DETECTION_SUBSETS` / `SUBSET_NAMES`）。

可选补充：
- 已下载但被丢弃的 `BowHead`/`TurnHead`（2,410 张）：人工核对语义后可映射（低头→`sleeping`/`writing`，转头→`talking`）
- `SCB_LLM_202506`（22G）：**不含这四类**，且无 bbox，不适用；不要在它上面浪费时间

### 步骤 2：生成合并数据集

```bash
# 仓库根执行（会解压 4 个检测 zip 到 datasets/_extract，约 2.8G）
conda run -n ai-teacher --no-capture-output python datasets/build_merged.py --dry-run   # 先看统计
conda run -n ai-teacher --no-capture-output python datasets/build_merged.py             # 落盘
```

产物：`datasets/merged/{images,labels}/{train,val}` + `datasets/merged/data.yaml`

> 注意：解压出的子集**无 val 或 val 为空时**需自行切分；`build_merged.py` 当前直接沿用各子集自带的 train/val。

### 步骤 3：训练

```bash
conda run -n ai-teacher --no-capture-output python edge-vision/scripts/train_yolo26.py \
  --data datasets/merged/data.yaml --epochs 50
```

需 **CUDA GPU**（脚本用 `device=0`）。产物在 `runs/behavior/yolo26n_10class/`。

### 步骤 4：导出 ONNX

```bash
conda run -n ai-teacher --no-capture-output python edge-vision/scripts/train_yolo26.py \
  --export runs/behavior/yolo26n_10class/weights/best.pt
```

### 步骤 5：接入生产（**关键，此前无人做**）

1. 把 ONNX 放到生产端 `classroom-client/vision-service` 的模型目录
2. 在 `vision-service` 的检测输出中填充 `behavior` 字段
3. **在 `vision-service` 补每分钟聚合上报** —— 复用后端已有的 `POST /api/v1/vision/aggregates`（契约见 `backend/src/vision/vision.service.ts::MinuteAggregateDto`）
4. 前端**无需再改**：本次已移除 `Math.min(100,…)` 夹取，口径写在 `lesson-report.vue` 注释里

### 步骤 6（可选）：让 edge-vision 与生产端一致

若决定让 `edge-vision` 也承担生产推理，需同步修改其 README（当前自称「非生产实现」）与部署脚本，避免两个「生产端」并存。

## 六、本次已完成的部分（不含训练）

- ✅ 移除前端的专注率夹取、补零除兜底（前端不再掩盖问题）
- ✅ 后端增加 Redis 聚合快照 + `/vision/config.lastAggregates`，打通「上报 → 可见」的可观测链路（已实测）
- ✅ `edge-vision/src/main.py` 加显式限制注释（说明塌缩机制）
- ✅ 测试固定现状：`test_detector_leaves_behavior_at_default`，行为分类头落地后应更新该测试
- ✅ `datasets/label_mapping.py` 按真实类名修正映射
- ✅ `datasets/build_merged.py` 新增，dry-run 验证通过

## 七、验收标准（未来）

1. `datasets/merged/data.yaml` 生成，含 **10 类**
2. 训练完成，`best.pt` 与 ONNX 导出成功
3. `vision-service` 每分钟聚合上报到后端，`ClassMinuteAggregate.focusCount < totalDetected` 且各行为计数非零
4. 前端专注率显示为真实值（0~100 之间，且随课堂变化）
5. 违纪事件（sleeping/using_phone/talking/eating/leaving_seat）在真实链路产生 `BehaviorEvent`
6. `test_detector_leaves_behavior_at_default` 更新为「behavior 已由模型填充」

## 八、依赖与风险

| 项 | 说明 |
|---|---|
| 数据补齐 | 四类违纪行为无标注数据，是**主要阻塞点**；自行标注成本高 |
| GPU | 训练需 CUDA 环境 |
| 标注质量 | `BowHead`/`TurnHead` 的语义映射需人工核对，错映射会污染标签 |
| 生产接入 | `vision-service` 是另一套代码，需单独开发与测试 |
| 工作量 | 评估为**独立工作项**（数据 + 训练 + 生产接入），非工程增强范围 |