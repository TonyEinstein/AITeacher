"""
数据集下载脚本：从 HuggingFace 自动拉取学生课堂行为数据集到 datasets/。

前置:
  pip install huggingface_hub

用法:
  python datasets/download_datasets.py --list         # 看列表
  python datasets/download_datasets.py --scb5        # 下 SCB5（~3GB）
  python datasets/download_datasets.py --all         # 全下
"""
from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download

TARGET_DIR = Path(__file__).resolve().parent

DATASETS = {
    "scb5": {
        "name": "SCB-Dataset5 (7428 图 / 20 类)",
        "repo": "wintonYF/SCB-Dataset",
        "size": "~3 GB",
        "desc": "主力数据集，学生课堂行为",
    },
    "aric": {
        "name": "ARIC (36453 图 / 32 类)",
        "repo": "wh0am1/ARIC-dataset",
        "size": "~15 GB",
        "desc": "主力数据集，教室场景学生行为",
    },
}


def list_datasets():
    print("可用数据集（HuggingFace）：\n")
    for key, d in DATASETS.items():
        print(f"  {key:8s}  {d['name']}  ({d['size']})")
        print(f"           {d['desc']}")
        print(f"           https://huggingface.co/datasets/{d['repo']}\n")


def has_real_data(directory: Path) -> bool:
    """判断目录里有没有实际数据文件（不只是 README）。"""
    if not directory.exists():
        return False
    for p in directory.rglob("*"):
        if p.is_file() and p.stat().st_size > 1024 * 1024:  # >1MB 算数据
            return True
    return False


def download(key: str):
    d = DATASETS[key]
    target = TARGET_DIR / key
    if has_real_data(target):
        print(f"已存在数据: {target}，跳过")
        return
    print(f"下载 {d['name']} -> {target}")
    snapshot_download(
        repo_id=d["repo"],
        repo_type="dataset",
        local_dir=str(target),
    )
    print(f"完成: {target}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--scb5", action="store_true")
    parser.add_argument("--aric", action="store_true")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.list:
        list_datasets()
    elif args.all:
        for k in DATASETS:
            download(k)
    else:
        if args.scb5:
            download("scb5")
        if args.aric:
            download("aric")
        if not any([args.scb5, args.aric]):
            list_datasets()
