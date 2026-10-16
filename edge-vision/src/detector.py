"""
学生检测与跟踪：YOLO26 检测 person + ByteTrack 分配 track_id。

输出每个被跟踪学生的：
- track_id: ByteTrack 分配的 ID
- bbox: [x1, y1, x2, y2] 像素坐标
- confidence: 检测置信度
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np
import torch
from ultralytics import YOLO


@dataclass
class TrackedPerson:
    track_id: int
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    center: tuple[float, float]       # cx, cy 用于判断走动
    behavior: str = "focus"           # 行为类别（训练后模型输出，默认 focus）


class StudentDetector:
    """YOLO26 person 检测 + ByteTrack 跟踪。"""

    PERSON_CLASS_ID = 0  # COCO person 类

    def __init__(
        self,
        model_name: str = "yolo26n.pt",
        confidence: float = 0.5,
        device: int | str | None = None,
    ):
        self.confidence = confidence
        if device is None:
            self.device = 0 if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.model = YOLO(model_name)
        self.model.to(self.device)

    def detect(self, frame: np.ndarray) -> list[TrackedPerson]:
        """对一帧图像做检测+跟踪，返回当前帧所有被跟踪的学生。"""
        results = self.model.track(
            frame,
            persist=True,          # 保持跟踪状态跨帧
            classes=[self.PERSON_CLASS_ID],  # 只检测 person
            conf=self.confidence,
            device=self.device,
            verbose=False,
        )

        persons: list[TrackedPerson] = []
        if not results or results[0].boxes.id is None:
            return persons

        boxes = results[0].boxes
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            track_id = int(box.id[0].item())
            conf = float(box.conf[0].item())
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            persons.append(
                TrackedPerson(
                    track_id=track_id,
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                    confidence=conf,
                    center=(cx, cy),
                )
            )
        return persons


def draw_tracks(frame: np.ndarray, persons: list[TrackedPerson]) -> np.ndarray:
    """在帧上画 track_id 和框，用于调试可视化。"""
    import cv2

    out = frame.copy()
    for p in persons:
        x1, y1, x2, y2 = p.bbox
        cv2.rectangle(out, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"ID:{p.track_id} {p.confidence:.2f}"
        cv2.putText(
            out, label, (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2,
        )
    return out
