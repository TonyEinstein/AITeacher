"""
验证 YOLO26 在 GPU 上的推理速度和正确性。
用法: conda activate ai-teacher && python scripts/test_yolo_gpu.py
"""
import time
import torch
from ultralytics import YOLO

MODEL_NAME = "yolo26n.pt"  # 首次运行会自动下载
DEVICE = 0 if torch.cuda.is_available() else "cpu"


def main():
    print("=" * 60)
    print("环境信息")
    print("=" * 60)
    print(f"PyTorch:    {torch.__version__}")
    print(f"CUDA 可用:  {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU:        {torch.cuda.get_device_name(0)}")
        print(f"计算能力:   {torch.cuda.get_device_capability(0)}")
        print(f"显存:       {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    print(f"设备:       {DEVICE}")
    print()

    print("=" * 60)
    print(f"加载模型: {MODEL_NAME}")
    print("=" * 60)
    model = YOLO(MODEL_NAME)
    model.to(DEVICE)
    print(f"模型已加载到 {'GPU' if DEVICE == 0 else 'CPU'}")
    print()

    # 用一张随机图跑推理，测速度
    import numpy as np
    dummy_frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)

    # 预热 3 次
    print("预热中...")
    for _ in range(3):
        _ = model(dummy_frame, verbose=False, device=DEVICE)
    if DEVICE == 0:
        torch.cuda.synchronize()

    # 测速 20 次
    print("测速 20 次...")
    times = []
    for _ in range(20):
        t0 = time.perf_counter()
        results = model(dummy_frame, verbose=False, device=DEVICE)
        if DEVICE == 0:
            torch.cuda.synchronize()
        times.append((time.perf_counter() - t0) * 1000)

    avg_ms = sum(times) / len(times)
    fps = 1000 / avg_ms
    print()
    print("=" * 60)
    print("推理速度结果")
    print("=" * 60)
    print(f"平均耗时:  {avg_ms:.1f} ms/帧")
    print(f"帧率:      {fps:.1f} FPS")
    print(f"输入:      1280x720")
    print()

    # 显示检测到的类别数（COCO 80 类）
    r = results[0]
    print(f"模型类别数: {len(model.names)}")
    print(f"前 10 类:   {list(model.names.values())[:10]}")
    print()
    print("✓ GPU 推理验证通过" if DEVICE == 0 else "⚠ 用的是 CPU，CUDA 未生效")


if __name__ == "__main__":
    main()
