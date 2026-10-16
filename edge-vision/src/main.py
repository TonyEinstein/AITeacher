"""
边缘端主循环：读 RTSP 流 → YOLO 检测+跟踪 → 事件上报 → 每分钟聚合。

用法:
  python src/main.py --source rtsp://...
  python src/main.py --source 0  # 本地摄像头
"""
from __future__ import annotations

import argparse
import logging
import time
from collections import defaultdict
from datetime import datetime

import cv2

from config import config
from detector import StudentDetector, TrackedPerson
from event_sender import VisionEventSender
from storage import EvidenceStorage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("edge-main")

VIOLATION_BEHAVIORS = {"sleeping", "using_phone", "talking", "eating", "leaving_seat"}
WALKING_GRACE_SEC = 900  # 上课 15 分钟后才触发 walking
DEBOUNCE_SEC = 300  # 同学生同类 5 分钟不重复


class ClassroomPipeline:
    def __init__(self, source: str):
        self.source = source
        self.detector = StudentDetector()
        self.sender = VisionEventSender()
        self.storage = EvidenceStorage()
        self.class_start = time.time()
        self.last_violation: dict[str, float] = {}  # key=trackId:behavior, value=timestamp
        self.minute_buckets: dict[int, dict] = defaultdict(lambda: defaultdict(int))

    def run(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            logger.error(f"无法打开视频源: {self.source}")
            return

        logger.info("课堂视觉感知已启动")
        last_push = 0
        last_minute = -1

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.warning("帧读取失败，重连...")
                    cap.release()
                    time.sleep(2)
                    cap = cv2.VideoCapture(self.source)
                    continue

                tracks = self.detector.detect(frame)
                self._aggregate_per_minute(tracks)

                now = time.time()
                if now - last_push >= 1.0:
                    self._process_violations(tracks)
                    last_push = now

                # 每分钟上报一次聚合
                minute = int(now // 60)
                if minute != last_minute:
                    self._push_minute_aggregate(minute)
                    last_minute = minute

        except KeyboardInterrupt:
            logger.info("收到退出信号")
        finally:
            cap.release()

    def _aggregate_per_minute(self, tracks: list[TrackedPerson]):
        # 按 TrackedPerson.behavior 归类计数；字段名为 f"{behavior}Count"。
        #
        # ⚠️ 已知限制（2026-10-09 核实，勿按「已实现行为分类」理解本函数）：
        # `detector.py` 目前只跑 COCO person 检测 + ByteTrack，从不给 behavior 赋值，
        # 因此每条 track 都取 dataclass 默认值 "focus"。在本函数上的直接后果是：
        #   - focusCount == totalDetected（专注率恒 100%）
        #   - talkingCount / sleepingCount / handRaiseCount ... 恒为 0
        #   - _process_violations() 在真实数据上永不触发
        # 这不是本函数的缺陷 —— 它按契约正常工作；缺陷是「行为分类模型尚未训练」，
        # 属 edge-vision 的规划项（见 edge-vision/README.md「骨架，缺行为分类头」），
        # 且生产推理实际由 classroom-client/vision-service 承担（它当前也不上报每分钟聚合）。
        # 训练出行为分类头后，只需在 detector.py 里填充 behavior，本函数无需改动即可正确分流。
        minute = int(time.time() // 60)
        bucket = self.minute_buckets[minute]
        bucket["totalDetected"] = len(tracks)
        for t in tracks:
            key = f"{t.behavior}Count"
            bucket[key] = bucket.get(key, 0) + 1

    def _process_violations(self, tracks: list[TrackedPerson]):
        elapsed = time.time() - self.class_start
        for t in tracks:
            if t.behavior not in VIOLATION_BEHAVIORS:
                continue
            if t.behavior == "walking" and elapsed < WALKING_GRACE_SEC:
                continue

            key = f"{t.track_id}:{t.behavior}"
            last = self.last_violation.get(key, 0)
            if time.time() - last < DEBOUNCE_SEC and last > 0:
                continue

            # 首次必拍：存关键帧
            snapshot = self.storage.save_snapshot(
                f"ev_{int(time.time())}_{t.track_id}_{t.behavior}.jpg",
                self.detector.last_frame,
            )
            payload = {
                "schoolId": config.SCHOOL_ID,
                "gradeId": config.GRADE_ID,
                "classId": config.CLASS_ID,
                "lessonRecordId": config.LESSON_RECORD_ID,
                "edgeTrackId": str(t.track_id),
                "behavior": t.behavior,
                "category": "violation",
                "confidence": t.confidence,
                "bbox": list(t.bbox),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "snapshotUrls": [snapshot] if snapshot else [],
            }
            self.sender.report_event(payload)
            self.last_violation[key] = time.time()
            logger.info(f"违纪: track={t.track_id} behavior={t.behavior} conf={t.confidence:.2f}")

    def _push_minute_aggregate(self, minute: int):
        if minute not in self.minute_buckets:
            return
        b = self.minute_buckets[minute]
        payload = {
            "schoolId": config.SCHOOL_ID,
            "gradeId": config.GRADE_ID,
            "classId": config.CLASS_ID,
            "lessonRecordId": config.LESSON_RECORD_ID,
            "minuteStart": datetime.fromtimestamp(minute * 60).isoformat(),
            "focusCount": b.get("focusCount", 0),
            "handRaiseCount": b.get("hand_raiseCount", 0),
            "writingCount": b.get("writingCount", 0),
            "talkingCount": b.get("talkingCount", 0),
            "sleepingCount": b.get("sleepingCount", 0),
            "phoneCount": b.get("using_phoneCount", 0),
            "eatingCount": b.get("eatingCount", 0),
            "leavingCount": b.get("leaving_seatCount", 0),
            "totalDetected": b.get("totalDetected", 0),
        }
        self.sender.report_aggregate(payload)
        logger.info(f"第 {minute} 分钟聚合已上报: {payload['totalDetected']} 人")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="0", help="RTSP URL 或摄像头编号")
    args = parser.parse_args()

    pipeline = ClassroomPipeline(args.source)
    pipeline.run()


if __name__ == "__main__":
    main()
