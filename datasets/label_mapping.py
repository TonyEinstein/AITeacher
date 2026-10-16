"""
标签映射：把各数据集的**原始类名**映射到统一的 10 类。

统一标签（与 edge-vision/configs/behaviors.yaml 一致）:
  0 focus, 1 hand_raise, 2 writing, 3 standing,
  4 sleeping, 5 using_phone, 6 talking,
  7 eating, 8 leaving_seat, 9 walking

⚠️ 修订记录（2026-10-09，第二次修订）：
  第一次修订误删了 `aric` 映射 —— 理由是「与已下载的 scb5 数据不符」。
  但 ARIC 是 `download_datasets.py` 中的**计划数据集**（36,453 图 / 32 类 / ~15GB），
  且**恰好包含本项目的四个关键缺类**（sleeping / using_phone / eating / leaving_seat）。
  本次已恢复 ARIC 映射。**不要再凭「当前已下载」来判断映射是否有用**。

  另一个事实澄清：SCB_LLM_202506（22G）虽然类目多（听讲/举手/讨论/读写/讲授…），
  但**同样不含这四类违纪行为**，且是纯分类集（无 bbox），对本项目无用。

映射规则：
  - 值为 int  → 迁移为该统一类索引
  - 值为 None → **丢弃**该类标注（如教师行为、语义不明的姿态类）

注意：各子集 .txt 里的类别索引是**相对其自身 yaml 的 names 顺序**的，
      故 build_merged.py 会先用原 yaml 的 names 把索引还原成类名，再查本表。
"""
from __future__ import annotations

# 统一 10 类的类名（顺序即索引）
TARGET_CLASSES = [
    "focus", "hand_raise", "writing", "standing",
    "sleeping", "using_phone", "talking",
    "eating", "leaving_seat", "walking",
]

# 本项目四个「关键缺类」—— 违纪提醒的核心行为
CRITICAL_CLASSES = ["sleeping", "using_phone", "eating", "leaving_seat"]

# ============================================================
# 数据集 → (原始类名 → 统一类索引)。None = 丢弃
# ============================================================

# SCB5：**当前已下载**的检测子集（4 个）。注意它**不含四个关键缺类**。
SCB5_CLASS_MAP: dict[str, int | None] = {
    # 学生行为（明确）
    "discuss": 6,             # 讨论 → talking
    "hand-raising": 1,        # 举手
    "hand_up": 1,             # 兼容旧命名
    "read": 2,                # 朗读/低头看书 → writing（低头类）
    "write": 2,               # 写字
    "stand": 3,               # 起立
    # 教师行为（非学生，丢弃）
    "guide": None,
    "answer": None,
    "On-stage interaction": None,
    "blackboard-writing": None,
    "blackBoard": None,
    "teacher": None,
    "screen": None,
    # 语义模糊的姿态（默认丢弃）
    "BowHead": None,
    "TurnHead": None,
}

# ARIC：**尚未下载**（`download_datasets.py --aric`，~15GB）。
# 关键价值：**含本项目四个缺类**（sleeping / using_phone / eating / leaving_seat）。
# 原始类名为英文；下表按语义归类，未列出的类一律丢弃。
# ⚠️ TODO（下载后人工核实，勿臆改语义）：下表键是**推测的常见别名**，ARIC 真实
#    32 类类名未核实。下载后先跑 `build_merged.py --dry-run`，把统计中
#    `[aric] <类名> -> UNMAPPED-DROP` 的真实类名按语义逐个补入本表——
#    build_merged.py 查表前已做大小写/空格/连字符归一化，语义相同即可命中。
ARIC_CLASS_MAP: dict[str, int | None] = {
    # focus 组
    "focus": 0, "listening": 0, "attentive": 0, "on_task": 0,
    # 举手
    "hand_raise": 1, "raising_hand": 1, "hand-raising": 1, "raise_hand": 1,
    # 书写/阅读（低头类）
    "writing": 2, "taking_notes": 2, "reading": 2, "read": 2, "write": 2,
    # 起立
    "standing": 3, "stand": 3,
    # ★ 睡觉（本项目缺类）
    "sleeping": 4, "sleep": 4, "head_down": 4, "lying_on_desk": 4,
    # ★ 玩手机（本项目缺类）
    "using_phone": 5, "phone": 5, "mobile_phone": 5, "playing_phone": 5,
    # 说话/交谈
    "talking": 6, "chatting": 6, "conversation": 6, "discuss": 6, "discussion": 6,
    # ★ 吃东西（本项目缺类）
    "eating": 7, "eat": 7, "having_food": 7,
    # ★ 离座（本项目缺类）
    "leaving_seat": 8, "leave_seat": 8, "out_of_seat": 8, "absent_from_seat": 8,
    # 走动
    "walking": 9, "walking_around": 9, "walk": 9,
}

# 按数据集名索引（build_merged.py 用）
DATASET_CLASS_MAPS: dict[str, dict[str, int | None]] = {
    "scb5": SCB5_CLASS_MAP,
    "aric": ARIC_CLASS_MAP,
}

# 输出目录（相对仓库根）
OUTPUT_DIR = "datasets/merged"

# 需要合并的**已下载**检测子集（scb5 内）。
# 只含「有 bbox 标注」的子集；SCB_LLM_202506 为纯分类集（无 .txt），不参与检测训练。
DETECTION_SUBSETS: dict[str, str] = {
    "discuss": "SCB5-Discuss-2024-9-17/SCB5-Discuss-2024-9-17.zip",
    "handrise_read_write": "SCB5-Handrise-Read-write-2024-9-17/SCB5-Handrise-Read-write-2024-9-17.zip",
    "teacher_behavior": "SCB5_Teacher_Behavior_Stand_BlackBoard_Sreen_20250406/SCB5_Teacher_Behavior_Stand_BlackBoard_Sreen_20250406-2.zip",
    "bow_turn_head": "SCB_BowTurnHead_20250509/SCB_BowTurnHead_20250509.zip",
}

# 各 scb5 子集自带 yaml 中的 names 顺序（索引 → 类名）。与 *.yaml 的 names 一致（已核对）。
SUBSET_NAMES: dict[str, list[str]] = {
    "discuss": ["discuss"],
    "handrise_read_write": ["hand-raising", "read", "write"],
    "teacher_behavior": [
        "guide", "answer", "On-stage interaction", "blackboard-writing",
        "teacher", "stand", "screen", "blackBoard",
    ],
    "bow_turn_head": ["BowHead", "TurnHead"],
}

# 各数据集覆盖的统一类（用于覆盖率自检）
DATASET_COVERAGE: dict[str, list[str]] = {
    "scb5": ["focus", "hand_raise", "writing", "standing", "talking"],
    "aric": TARGET_CLASSES,  # 计划覆盖全部 10 类（含 4 个关键缺类）
}


def map_class(source_name: str, dataset: str = "scb5") -> int | None:
    """原始类名 → 统一类索引；未登记的类名返回 None（丢弃）。"""
    return DATASET_CLASS_MAPS.get(dataset, {}).get(source_name)


def missing_critical_classes() -> list[str]:
    """返回当前**已下载**数据（scb5）尚未覆盖的关键缺类。"""
    covered = set(DATASET_COVERAGE["scb5"])
    return [c for c in CRITICAL_CLASSES if c not in covered]


if __name__ == "__main__":
    print("统一 10 类：", ", ".join(f"{i}={n}" for i, n in enumerate(TARGET_CLASSES)))
    print(f"\n关键缺类（违纪提醒核心）：{', '.join(CRITICAL_CLASSES)}")
    print(f"当前已下载数据（scb5）未覆盖：{', '.join(missing_critical_classes()) or '无'}")
    print("\n各数据集覆盖：")
    for ds, cov in DATASET_COVERAGE.items():
        tag = "已下载" if ds == "scb5" else "未下载"
        print(f"  {ds:6s}（{tag}）覆盖 {len(cov)}/{len(TARGET_CLASSES)} 类: {', '.join(cov)}")
    print("\n注：SCB_LLM_202506（22G 纯分类集，无 bbox）不含四类违纪行为，对本项目无用。")
    print("\nscb5 类名映射：")
    for src, dst in SCB5_CLASS_MAP.items():
        label = "丢弃" if dst is None else f"→ {dst} {TARGET_CLASSES[dst]}"
        print(f"  {src:24s} {label}")