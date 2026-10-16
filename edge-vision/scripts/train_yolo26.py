"""
YOLO26 训练脚本：在合并后的数据集上微调行为检测头。

前置:
  1. 运行 download_datasets.py 下载数据
  2. 运行 label_mapping.py 把标签统一到 10 类
  3. 准备 data.yaml（指向合并后的 images/labels 目录）

用法:
  conda run -n ai-teacher --no-capture-output python edge-vision/scripts/train_yolo26.py
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


# 我们的 10 类
CLASSES = [
    "focus", "hand_raise", "writing", "standing",
    "sleeping", "using_phone", "talking",
    "eating", "leaving_seat", "walking",
]


def train(data_yaml: str, model: str = "edge-vision/yolo26n.pt", epochs: int = 50, imgsz: int = 640):
    """启动训练。"""
    model = YOLO(model)  # 首次自动下载预训练权重
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=16,
        device=0,  # GPU 0
        project="runs/behavior",
        name="yolo26n_10class",
        patience=10,
        save=True,
        pretrained=True,
    )
    print(f"\n训练完成: {results.save_dir}")
    return results


def export_onnx(weights: str):
    """导出 ONNX 供边缘端部署。"""
    model = YOLO(weights)
    path = model.export(format="onnx", simplify=True)
    print(f"ONNX 导出: {path}")
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="datasets/merged/data.yaml", help="数据集 yaml")
    parser.add_argument("--model", default="edge-vision/yolo26n.pt")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--export", type=str, default="", help="导出 ONNX 的权重路径")
    args = parser.parse_args()

    if args.export:
        export_onnx(args.export)
    else:
        train(args.data, args.model, args.epochs)
