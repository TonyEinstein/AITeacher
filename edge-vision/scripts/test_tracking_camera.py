"""
用本地摄像头测试 person 检测 + ByteTrack 跟踪。
按 q 退出，或跑满 300 帧自动退出。
"""
import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from detector import StudentDetector, draw_tracks  # noqa: E402


def main():
    print("初始化检测器...")
    detector = StudentDetector(model_name="yolo26n.pt", confidence=0.5)

    # 打开本地摄像头（笔记本内置摄像头通常是 0）
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("✗ 无法打开摄像头，尝试用测试图...")
        # 退而求其次：用 YOLO 自带的 bus.jpg 跑单帧
        from ultralytics import YOLO
        model = YOLO("yolo26n.pt")
        img = "https://ultralytics.com/images/bus.jpg"
        results = model(img, verbose=False)
        print(f"单帧检测到 {len(results[0].boxes)} 个目标")
        return

    print("摄像头已打开，开始检测（按 q 退出）...")
    fps_counter = 0
    fps_start = time.time()
    unique_ids: set[int] = set()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            t0 = time.perf_counter()
            persons = detector.detect(frame)
            infer_ms = (time.perf_counter() - t0) * 1000

            for p in persons:
                unique_ids.add(p.track_id)

            vis = draw_tracks(frame, persons)
            cv2.putText(
                vis,
                f"persons={len(persons)} infer={infer_ms:.0f}ms",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2,
            )
            cv2.imshow("Tracking Test (q to quit)", vis)

            fps_counter += 1
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
            if fps_counter >= 300:
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    elapsed = time.time() - fps_start
    print(f"\n跑了 {fps_counter} 帧，耗时 {elapsed:.1f}s，平均 {fps_counter/elapsed:.1f} FPS")
    print(f"检测到的 track_id 总数: {len(unique_ids)}")
    print(f"track_id 列表: {sorted(unique_ids)}")


if __name__ == "__main__":
    main()
