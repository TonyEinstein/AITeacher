"""
合并 SCB5 各检测子集（+ ARIC，若已下载）为 YOLO 训练集，生成
datasets/merged/{images,labels}/{train,val} 与 datasets/merged/data.yaml
（供 edge-vision/scripts/train_yolo26.py 使用）。

流程：
  1. 解压各 scb5 检测子集 zip 到 datasets/_extract/<子集>（已解压则跳过）
  2. 遍历每个子集的 images/{train,val} 与 labels/{train,val}
  3. 用原 yaml 的 names 把 .txt 里的类索引还原为类名
  4. 查 label_mapping 映射（scb5→SCB5_CLASS_MAP，aric→ARIC_CLASS_MAP）到统一 10 类；
     映射为 None（显式丢弃）或未登记（ARIC 未映射）→ 丢弃并计入统计
  5. 按 YOLO 约定重写 .txt（统一索引）；拷贝图像
  6. 汇总写出 data.yaml（nc=10, names=统一 10 类）

用法（在仓库根执行）：
  conda run -n ai-teacher --no-capture-output python datasets/build_merged.py
  加 --dry-run 只统计不落盘（推荐先跑）
  加 --aric-dir <路径> 指定 ARIC 根目录（默认 datasets/aric；可用假目录预演发现逻辑）

注意：
  - 未解压的 zip 会先解压（占用额外磁盘；SCB_LLM 22G 分类集不参与，不会解压）
  - 图像用拷贝而非硬链接，跨盘符安全；如需省空间可改 os.link

ARIC 支持（2026-10-11 代码先行——数据未下载，目标「下载后即可直接跑」）：
  - datasets/aric 不存在 → 打印 INFO 后跳过，scb5 流程与数字完全不受影响
  - 存在则自动发现（不预设固定路径，ARIC 确切布局未知），兼容常见 YOLO 布局：
      A. images/{train,val} + 平级 labels/{train,val}（YOLO 标准导出，顶层或子集目录下）
      B. {train,valid,validation,test}/images + 同名 labels（Roboflow 风格；
         valid/validation 归 val，test 并入 val）
      C. images/ + labels/ 平铺无切分（全部视为 train）
      D. labels/ 存在而图像直接平铺在其父目录（全部视为 train）
      E. 无 labels/ 目录、图像与 .txt 同目录平铺（如 <root>/train/*.jpg+*.txt）
  - 仓库若以 zip 分发，自动解压到 datasets/_extract/aric/<zip名>
  - 类名表（索引→类名）自动解析：优先 子集根 / 其父目录 / ARIC 根 的 data.yaml
    （names 支持列表与 {索引: 类名} 两种写法），其次 classes.txt / *.names
    （容忍 "0 类名" 带索引前缀的写法）
  - 类名映射两段式：先原样查 ARIC_CLASS_MAP；未命中则归一化
    （lower + trim + 空格/连字符/点 → 下划线；映射键同步归一化）再查一次；
    仍未命中按丢弃策略处理，统计里记为 UNMAPPED（与显式 DROP 区分，便于下载后人工补映射）
  - 跳过 .cache（huggingface_hub 下载缓存）目录，避免快照缓存被重复发现

TODO（ARIC 下载后人工核实清单）：
  1. 实际目录布局是否被 A~E 覆盖；若自动发现失败（「未发现任何 images/labels 结构」），
     把真实结构补进 find_aric_pairs()
  2. 类名表来源与顺序：控制台打印的「类名表 ← <文件>」须与 .txt 索引一致（顺序错=全错）
  3. 真实 32 类 vs ARIC_CLASS_MAP：dry-run 统计中的 UNMAPPED 行即未覆盖类，
     逐个按语义人工补入 label_mapping.ARIC_CLASS_MAP（勿臆改映射语义）
  4. 分割格式告警：stats 出现 [aric] <suspect-seg-format>（或落盘时的 <missing-image>）
     说明该行是 polygon/OBB 标注，若量大需先做 polygon→bbox 转换（取点集 min/max）再纳入

⚠️ 覆盖限制（2026-10-09 实测，ARIC 未下载期间依然成立）：
  仅 scb5 时合并结果只覆盖 5 类：focus / hand_raise / writing / standing / talking，
  **缺 sleeping / using_phone / eating / leaving_seat 四个关键违纪类**。
  ARIC 下载并入后此限制解除。在解除前不要据合并结果训练后上线。
  （背景与补齐路径详见 docs/plans/2026-10-09-classroom-behavior-model-gap.md）
"""
from __future__ import annotations

import argparse
import shutil
import sys
import zipfile
from collections import Counter
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from label_mapping import (  # noqa: E402
    ARIC_CLASS_MAP,
    DETECTION_SUBSETS,
    SUBSET_NAMES,
    TARGET_CLASSES,
    map_class,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
SCB5_DIR = REPO_ROOT / "datasets" / "scb5"
ARIC_DIR = REPO_ROOT / "datasets" / "aric"  # download_datasets.py --aric 的默认目标
EXTRACT_DIR = REPO_ROOT / "datasets" / "_extract"
MERGED_DIR = REPO_ROOT / "datasets" / "merged"
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ARIC 分割名归并：valid/validation/test 归到 val（检测任务里验证集是唯一评估集，
# 多余的评估集并入不损失信息；不并入 train 是避免测试图混进训练造成泄漏）
ARIC_SPLIT_ALIASES: dict[str, str] = {
    "train": "train",
    "val": "val",
    "valid": "val",
    "validation": "val",
    "test": "val",
}


def extract_subset(name: str, zip_rel: str) -> Path | None:
    """解压子集（若未解压）。返回解压后的内容根目录。"""
    zip_path = SCB5_DIR / zip_rel
    if not zip_path.exists():
        print(f"  [跳过] 未找到 zip: {zip_rel}")
        return None
    target = EXTRACT_DIR / name
    # 判定是否已解压：存在任意 images 目录
    if target.exists() and any(target.rglob("images")):
        print(f"  [已解压] {name}")
        return target
    target.mkdir(parents=True, exist_ok=True)
    print(f"  [解压中] {name} <- {zip_rel}")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(target)
    return target


def find_split_dirs(root: Path) -> dict[str, tuple[Path, Path]]:
    """定位 {split: (images_dir, labels_dir)}。兼容多种层级。"""
    out: dict[str, tuple[Path, Path]] = {}
    for img_dir in root.rglob("images"):
        if not img_dir.is_dir():
            continue
        split = img_dir.parent.name if img_dir.name == "images" and img_dir.parent.name in ("train", "val") else None
        # 常见布局 A: <sub>/images/{train,val}/  （子集自带 yaml 指向此）
        for s in ("train", "val"):
            cand = img_dir / s
            lbl = img_dir.parent / "labels" / s
            if cand.is_dir() and lbl.is_dir():
                out[s] = (cand, lbl)
    # 常见布局 B: <sub>/images/ 与 <sub>/labels/ 并列（无 train/val 子目录）
    for img_dir in root.rglob("images"):
        if not img_dir.is_dir():
            continue
        lbl_dir = img_dir.parent / "labels"
        if lbl_dir.is_dir() and not any((img_dir / s).is_dir() for s in ("train", "val")):
            out.setdefault("train", (img_dir, lbl_dir))
    return out


def normalize_class_name(name: str) -> str:
    """类名归一化：lower + trim + 空格/连字符/点 → 下划线，连续下划线折叠。

    ARIC 真实类名未知，可能是 "Playing Phone"、"playing-phone"、
    "playing.phone"、"Playing_Phone " 等写法；归一化后统一为 playing_phone。
    """
    norm = name.strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")
    while "__" in norm:
        norm = norm.replace("__", "_")
    return norm.strip("_")


def map_aric_class(src_name: str) -> tuple[int | None, bool]:
    """ARIC 专用两段式映射。返回 (统一类索引或 None, 是否命中过映射表)。

    第一段原样查 ARIC_CLASS_MAP；未命中则归一化（lower + trim +
    空格/连字符/点→下划线）后用归一化键再查一次（表键同样归一化，
    故 "Playing Phone"/"playing-phone"/"playing_phone" 都能命中）。
    hit=False 表示该类名完全未登记（丢弃时统计记 UNMAPPED，
    与显式 DROP 区分，便于下载后人工补映射）。
    """
    if src_name in ARIC_CLASS_MAP:
        return ARIC_CLASS_MAP[src_name], True
    # 第二段：归一化后查归一化键视图。注意不能加「norm != src_name」守卫——
    # 类名可能本身就是归一化形式但不是映射表原始键（如表键为 "hand-raising"、
    # 实际类名为 "hand_raising"），此时 norm == src_name 也必须查归一化视图。
    norm = normalize_class_name(src_name)
    if norm in _aric_norm_map():
        return _aric_norm_map()[norm], True
    return None, False


@lru_cache(maxsize=1)
def _aric_norm_map() -> dict[str, int | None]:
    """ARIC_CLASS_MAP 的归一化键视图（lru_cache 避免每个标注框重建）。"""
    return {normalize_class_name(k): v for k, v in ARIC_CLASS_MAP.items()}


def convert_labels(
    lbl_dir: Path,
    names: list[str],
    stats: Counter,
    dataset: str = "scb5",
) -> list[tuple[Path, list[str]]]:
    """读入 .txt，按 names 还原类名 → 映射 → 重写为统一索引行。返回 [(txt_path, 行列表)]。

    dataset="aric" 时映射走 ARIC_CLASS_MAP 两段式（见 map_aric_class）；
    未登记类名按丢弃策略处理，但统计记 UNMAPPED-DROP（与显式 DROP 区分）。
    """
    results: list[tuple[Path, list[str]]] = []
    for txt in sorted(lbl_dir.rglob("*.txt")):
        new_lines: list[str] = []
        for raw in txt.read_text(encoding="utf-8").splitlines():
            parts = raw.split()
            if len(parts) < 5:
                continue
            try:
                src_idx = int(float(parts[0]))
            except ValueError:
                continue
            src_name = names[src_idx] if 0 <= src_idx < len(names) else f"<unknown:{src_idx}>"
            if dataset == "aric" and len(parts) > 5:
                # ARIC 若以 polygon（分割）格式发布，>5 列即多边形点集。
                # 无法可靠转为 bbox，先标记告警并丢弃，避免错误框污染训练集；
                # 下载后若此告警量大，需先做 polygon→bbox（取点集 min/max）再纳入。
                stats[f"[aric] <suspect-seg-format> {src_name}"] += 1
                continue
            if dataset == "aric":
                # ARIC：两段式映射；统计键带 [aric] 前缀，UNMAPPED-DROP 与显式 DROP 区分
                dst, hit = map_aric_class(src_name)
                outcome = TARGET_CLASSES[dst] if dst is not None else ("DROP" if hit else "UNMAPPED-DROP")
                stats[f"[aric] {src_name} -> {outcome}"] += 1
            else:
                # scb5：与旧版行为/输出格式完全一致
                dst = map_class(src_name, dataset)
                stats[f"{src_name} -> {'DROP' if dst is None else TARGET_CLASSES[dst]}"] += 1
            if dst is None:
                continue
            new_lines.append(" ".join([str(dst)] + parts[1:5]))
        results.append((txt, new_lines))
    return results


# ============================================================
# ARIC 支持（代码先行：数据未下载，要求「下载后即可直接跑」）
# ============================================================

def extract_aric_zip(root: Path) -> list[Path]:
    """若 ARIC 仓库以 zip 分发，自动解压到 datasets/_extract/aric/<zip名>。

    已解压判定：目标目录下存在 images 或 labels 目录即跳过（幂等，可重复执行）。
    返回需要参与后续发现扫描的目录（ARIC 根 + 解压产物）。
    注意：跳过 .cache（huggingface_hub 快照缓存）里的 zip，避免与正式文件重复。
    """
    aric_extract = EXTRACT_DIR / "aric"
    aric_extract.mkdir(parents=True, exist_ok=True)
    scan_roots = [root]
    for zf_path in sorted(root.rglob("*.zip")):
        if any(p.name == ".cache" for p in zf_path.parents):
            continue  # 快照缓存里的 zip 与正式路径是同一份，跳过
        target = aric_extract / zf_path.stem
        if target.exists() and (any(target.rglob("images")) or any(target.rglob("labels"))):
            print(f"  [已解压] {zf_path.name} -> {target}")
        else:
            target.mkdir(parents=True, exist_ok=True)
            print(f"  [解压中] {zf_path.name} -> {target}")
            with zipfile.ZipFile(zf_path) as zf:
                zf.extractall(target)
        scan_roots.append(target)
    return scan_roots


def find_aric_pairs(root: Path) -> list[tuple[str, Path, Path, Path]]:
    """在 root 下发现所有 (split, images_dir, labels_dir, subset_root)。

    以 rglob 找到的每个 labels 目录为锚点分类判定（ARIC 确切布局未知，
    覆盖常见 YOLO 布局；同一份 labels 只归入最先命中的形态）：
      A. {root}/images/{split} + {root}/labels/{split}   —— YOLO 标准导出
      B. {root}/{split}/images + {root}/{split}/labels   —— Roboflow 风格
         （valid/validation 归 val；test 并入 val，不并入 train，避免泄漏）
      C. images/ + labels/ 平铺无切分                     —— 全部视为 train
      D. labels/ 存在而图像平铺在其父目录                 —— 全部视为 train
      E.（兜底）无 labels/ 目录，图像与 .txt 同目录平铺   —— 如 <root>/train/*.jpg+*.txt
    跳过 .cache（huggingface_hub 快照缓存）下的目录。
    """
    found: list[tuple[str, Path, Path, Path]] = []

    def has_image_file(d: Path) -> bool:
        return any(p.suffix.lower() in IMG_EXT for p in d.iterdir() if p.is_file())

    def flat_pair(d: Path, split_hint: str | None) -> bool:
        """布局 E 探测：目录里同时有图像与 .txt → 视为一个平铺数据块。"""
        if not d.is_dir():
            return False
        has_img = has_img_txt = False
        for p in d.iterdir():
            if not p.is_file():
                continue
            sfx = p.suffix.lower()
            if sfx in IMG_EXT:
                has_img = True
            elif sfx == ".txt":
                has_img_txt = True
        if not (has_img and has_img_txt):
            return False
        canonical = ARIC_SPLIT_ALIASES.get((split_hint or d.name).lower(), "train")
        found.append((canonical, d, d, d.parent))
        return True

    for lbl_dir in sorted(root.rglob("labels")):
        if not lbl_dir.is_dir():
            continue
        if any(p.name == ".cache" for p in lbl_dir.parents):
            continue  # 快照缓存里是同一份数据的 blob 引用，跳过避免重复发现
        subset_root = lbl_dir.parent
        img_base = subset_root / "images"

        # 布局 A：labels 下有 split 子目录 ↔ images/{split}
        split_dirs = [d for d in sorted(lbl_dir.iterdir())
                      if d.is_dir() and d.name.lower() in ARIC_SPLIT_ALIASES]
        if split_dirs:
            for sub in split_dirs:
                img_dir = img_base / sub.name
                if img_dir.is_dir():
                    found.append((ARIC_SPLIT_ALIASES[sub.name.lower()], img_dir, sub, subset_root))
            continue
        # 布局 B：labels 的父目录名本身是 split（{split}/labels）
        split_name = subset_root.name.lower()
        if split_name in ARIC_SPLIT_ALIASES:
            img_dir = subset_root / "images"
            if img_dir.is_dir():
                found.append((ARIC_SPLIT_ALIASES[split_name], img_dir, lbl_dir, subset_root.parent))
            continue
        # 布局 C：平级 images/ 存在（无切分）→ 全部视为 train
        if img_base.is_dir():
            found.append(("train", img_base, lbl_dir, subset_root))
            continue
        # 布局 D：图像直接平铺在 subset_root（labels 的父目录）
        if has_image_file(subset_root):
            found.append(("train", subset_root, lbl_dir, subset_root))

    # 布局 E（兜底）：图像与 .txt 同目录平铺（无 labels/ 目录）。
    # 逐顶层目录判定而非全局兜底——兼容混合布局（部分子集标准、部分子集平铺）：
    # 只探测「未通过 labels 结构贡献过任何数据块」的目录。
    def contributed(d: Path) -> bool:
        return any(d == p or d in p.parents for _, img_dir, lbl_dir, _ in found for p in (img_dir, lbl_dir))

    for d in [*sorted(root.iterdir()), root]:
        if not d.is_dir() or d.name.startswith(".") or contributed(d):
            continue
        # 先看 d 下 split 名子目录（如 <root>/flat/train/*.jpg+*.txt），再看 d 本身
        hit = False
        for sub in sorted(d.iterdir()):
            if sub.is_dir() and sub.name.lower() in ARIC_SPLIT_ALIASES:
                hit = flat_pair(sub, sub.name) or hit
        if not hit:
            flat_pair(d, None)

    # 去重（同一 (split, images, labels) 只保留首个）
    seen: set[tuple[str, str, str]] = set()
    unique: list[tuple[str, Path, Path, Path]] = []
    for split, img_dir, lbl_dir, subset_root in found:
        key = (split, str(img_dir).lower(), str(lbl_dir).lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append((split, img_dir, lbl_dir, subset_root))
    return unique


def parse_aric_class_names(subset_root: Path, aric_root: Path) -> tuple[list[str], str]:
    """解析类名表（索引 → 类名）。返回 (names, 来源描述)。

    优先级（ARIC 确切类名来源未知，多级兜底）：
      1. data.yaml / data.yml 的 names —— 支持两种写法：
         a) names: [a, b, c]      （列表，顺序即索引）
         b) names: {0: a, 1: b}    （字典，按 int 键排序）
      2. classes.txt / classes.names / *.names —— 每行一个类名；
         容忍 "0 classname"（带索引前缀）的写法
      3. 全部失败 → 空表（调用方用 <unknown:N> 兜底，全部进 UNMAPPED 丢弃统计）
    查找范围（就近优先）：
      1. subset_root 自身（子集自带类名表，最可靠）
      2. 其父目录（Roboflow 风格嵌套时 yaml 常放在 images/labels 上一层）
      3. ARIC 根下同名子集目录（zip 解压产物与根下同名子集的表互通）
      4. ARIC 根（数据集级 data.yaml/classes.txt，对全部子集有效）
    ⚠️ 绝不借用**兄弟子集**的类名表：不同子集的索引↔类名顺序可能不同，错配=标注串类。
    """
    candidates: list[Path] = [subset_root]
    if subset_root != aric_root and subset_root.parent != aric_root \
            and aric_root in subset_root.parents:
        # 嵌套中间层（如 zip 解压出的 <stem>/<子集>/ 结构，表可能放在中间层）
        candidates.append(subset_root.parent)
    same_name = aric_root / subset_root.name
    if same_name != subset_root and same_name.is_dir():
        candidates.append(same_name)
    candidates.append(aric_root)

    # 1) data.yaml / data.yml
    for base in candidates:
        for fname in ("data.yaml", "data.yml"):
            f = base / fname
            if not f.is_file():
                continue
            try:
                import yaml  # 延迟导入：仅 ARIC 路径需要，scb5 流程无此依赖
            except ImportError:
                print("  [警告] 未安装 pyyaml（pip install pyyaml），无法解析 data.yaml")
                continue
            try:
                data = yaml.safe_load(f.read_text(encoding="utf-8"))
                raw_names = data["names"] if isinstance(data, dict) else None
            except Exception as exc:  # noqa: BLE001  # 单个文件解析失败不致命，走下一候选
                print(f"  [警告] 解析 {f} 失败（{exc}），尝试其他来源")
                continue
            if isinstance(raw_names, list):
                names = [str(x) for x in raw_names]
            elif isinstance(raw_names, dict):
                try:
                    names = [str(raw_names[k]) for k in sorted(raw_names, key=int)]
                except (TypeError, ValueError):
                    print(f"  [警告] {f} 的 names 键非整数索引，尝试其他来源")
                    continue
            else:
                continue
            if names:
                return names, str(f)
            print(f"  [警告] {f} 的 names 为空，尝试其他来源")

    # 2) classes.txt / *.names
    for base in candidates:
        for pattern in ("classes.txt", "classes.names", "*.names"):
            for f in sorted(base.glob(pattern)):
                if not f.is_file():
                    continue
                names: list[str] = []
                for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
                    toks = line.strip().split()
                    if not toks:
                        continue
                    if len(toks) == 1:
                        names.append(toks[0])
                    else:
                        # 容忍 "0 classname"（带索引前缀）的写法
                        first = toks[0].rstrip(",")
                        try:
                            int(first)
                            names.append(" ".join(toks[1:]))
                        except ValueError:
                            names.append(" ".join(toks))
                if names:
                    return names, str(f)

    # 3) 兜底：无类名表 → 空表（调用方走 <unknown:N> → 全部 UNMAPPED 统计）
    return [], "<未找到类名表>"


def collect_aric(
    aric_root: Path,
    stats: Counter,
    converted: list[tuple[Path, list[str], str, tuple[Path, ...]]],
    copied: Counter,
) -> None:
    """扫描 ARIC 根目录并纳入合并：自动发现 → 类名解析 → 标签转换。

    converted 条目为 (txt, 新行, split, 图像搜索目录元组)；
    ARIC 的图像搜索目录按发现的 img_dir + txt 相对结构镜像，labels 父目录兜底。
    """
    print(f"\n[aric] 根目录：{aric_root}")
    scan_roots = extract_aric_zip(aric_root)
    pairs: list[tuple[str, Path, Path, Path]] = []
    seen_key: set[tuple[str, str, str]] = set()
    for scan_root in scan_roots:
        for split, img_dir, lbl_dir, subset_root in find_aric_pairs(scan_root):
            key = (split, str(lbl_dir.resolve()).lower(), str(img_dir.resolve()).lower())
            if key in seen_key:
                continue
            seen_key.add(key)
            pairs.append((split, img_dir, lbl_dir, subset_root))
    if not pairs:
        print("  [警告] 未发现任何 images/labels 结构，跳过 ARIC。")
        print("         真实布局未被覆盖——请把实际目录结构补进 find_aric_pairs()（见文件头 TODO）")
        return
    print(f"  自动发现 {len(pairs)} 个数据块：")
    for split, img_dir, lbl_dir, _ in pairs:
        print(f"    [{split:5s}] {lbl_dir}  (images: {img_dir})")

    # 类名表按 subset_root 解析一次（不同子集可能各有 data.yaml）
    names_cache: dict[Path, tuple[list[str], str]] = {}
    for split, img_dir, lbl_dir, subset_root in pairs:
        if subset_root not in names_cache:
            names, src = parse_aric_class_names(subset_root, aric_root)
            names_cache[subset_root] = (names, src)
            if names:
                print(f"  类名表（{len(names)} 类）← {src}")
                print(f"    {', '.join(names)}")
            else:
                print(f"  [警告] {subset_root} 未找到类名表，该子集标注将全部按 UNMAPPED 丢弃")
                print("         （统计里的 <unknown:N> 即出现的索引，下载后请补类名表）")
        names, _ = names_cache[subset_root]
        pairs_lbl = convert_labels(lbl_dir, names, stats, dataset="aric")
        kept = 0
        for txt, lines in pairs_lbl:
            if not lines:
                continue  # 全部被丢弃的样本不参与训练
            try:
                rel_parent = txt.relative_to(lbl_dir).parent
            except ValueError:
                rel_parent = Path(".")
            # 图像搜索目录：发现的 img_dir（按 txt 相对结构镜像）+ labels 父目录兜底
            search_dirs = (img_dir / rel_parent, lbl_dir.parent)
            converted.append((txt, lines, split, search_dirs))
            copied[split] += 1
            kept += 1
        print(f"  {split}: {len(pairs_lbl)} 个标签文件（保留非空 {kept}）")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只统计不落盘")
    ap.add_argument("--val-ratio", type=float, default=0.0,
                    help=">0 时把 train 按比例切到 val（各子集无 val 时用）")
    ap.add_argument("--aric-dir", type=Path, default=None,
                    help="ARIC 根目录（默认 datasets/aric；指向假目录可预演发现逻辑）")
    args = ap.parse_args()

    aric_root = args.aric_dir.resolve() if args.aric_dir else ARIC_DIR

    print("=" * 60)
    print("合并 SCB5 检测子集 (+ ARIC) → datasets/merged")
    print("=" * 60)

    stats: Counter = Counter()
    copied: Counter = Counter()
    # (txt, 新行, split, 图像搜索目录元组)；scb5 的搜索目录为镜像推导 + 父目录
    converted: list[tuple[Path, list[str], str, tuple[Path, ...]]] = []

    for name, zip_rel in DETECTION_SUBSETS.items():
        print(f"\n[{name}]")
        root = extract_subset(name, zip_rel)
        if root is None:
            continue
        names = SUBSET_NAMES[name]
        splits = find_split_dirs(root)
        if not splits:
            print(f"  [警告] 未找到 images/labels 结构，跳过")
            continue
        for split, (img_dir, lbl_dir) in splits.items():
            pairs = convert_labels(lbl_dir, names, stats)
            for txt, lines in pairs:
                if not lines:
                    continue  # 全部被丢弃的样本不参与训练
                try:
                    rel_parent = txt.relative_to(lbl_dir).parent
                except ValueError:
                    rel_parent = Path(".")
                search_dirs = (img_dir / rel_parent, lbl_dir.parent)
                converted.append((txt, lines, split, search_dirs))
                copied[split] += 1
            print(f"  {split}: {len(pairs)} 个标签文件（保留非空 {sum(1 for _, l in pairs if l)}）")

    # ARIC（未下载则 INFO 跳过，不影响 scb5 数字）
    if aric_root.exists():
        collect_aric(aric_root, stats, converted, copied)
    else:
        print(f"\n[aric] 未找到目录 {aric_root}，跳过（ARIC 尚未下载，属预期）")
        print("       下载：python datasets/download_datasets.py --aric")

    print("\n" + "-" * 60)
    print("类映射统计（标注框数）：")
    for k, v in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {k:44s} {v}")
    print(f"\n保留样本：train={copied['train']} val={copied['val']}")
    print(f"统一类别数：{len(TARGET_CLASSES)}")

    if args.dry_run:
        print("\n[dry-run] 未落盘。")
        return 0

    if copied["train"] == 0:
        print("\n[中止] 无可用训练样本。")
        return 1

    # 落盘
    print("\n写入 datasets/merged ...")
    for split in ("train", "val"):
        (MERGED_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (MERGED_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    n = 0
    for txt, lines, split, search_dirs in converted:
        # YOLO 目录镜像：labels/x/y.txt ↔ images/x/y.<ext>
        stem = txt.stem
        src_img = None
        for d in search_dirs:
            src_img = next(
                (d / (stem + ext) for ext in IMG_EXT if (d / (stem + ext)).exists()),
                None,
            )
            if src_img is not None:
                break
        if src_img is None:
            stats["<missing-image>"] += 1
            continue
        # 目标名加序号前缀，避免跨子集重名
        prefix = f"{split}_{n:06d}"
        shutil.copy2(src_img, MERGED_DIR / "images" / split / f"{prefix}{src_img.suffix}")
        (MERGED_DIR / "labels" / split / f"{prefix}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        n += 1

    # data.yaml
    data_yaml = MERGED_DIR / "data.yaml"
    yaml_lines = [
        f"path: {MERGED_DIR.as_posix()}",
        "train: images/train",
        "val: images/val",
        "",
        f"nc: {len(TARGET_CLASSES)}",
        "names:",
    ] + [f"  {i}: {c}" for i, c in enumerate(TARGET_CLASSES)]
    data_yaml.write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")

    print(f"完成：{n} 个样本 → {MERGED_DIR}")
    print(f"data.yaml → {data_yaml}")
    if copied["val"] == 0:
        print("\n⚠️ val 为空：train_yolo26.py 需要验证集。")
        print("   请把部分 train 移至 val，或重跑并加 --val-ratio 0.1（待实现）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())