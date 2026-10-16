"""
模拟边缘端上报事件，验证后端 Vision API 是否正常工作。
用法: conda activate ai-teacher && python scripts/simulate_vision_event.py
"""
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from event_sender import VisionEventSender  # noqa: E402


def main():
    sender = VisionEventSender()

    # 1) 模拟一条违纪事件
    print("1) 上报违纪事件: talking ...")
    event = {
        "schoolId": 1,
        "gradeId": 1,
        "classId": 1,
        "lessonRecordId": 1,
        "edgeTrackId": "track-7",
        "studentId": None,
        "behavior": "talking",
        "category": "violation",
        "confidence": 0.87,
        "bbox": [120, 340, 200, 500],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "durationSec": 12,
        "videoUrl": None,
        "snapshotUrls": None,
    }
    r = sender.report_event(event)
    print(f"   响应: {r}")

    # 2) 模拟一条正常事件
    print("2) 上报正常事件: hand_raise ...")
    event2 = {**event, "behavior": "hand_raise", "category": "normal", "confidence": 0.92, "edgeTrackId": "track-3"}
    r2 = sender.report_event(event2)
    print(f"   响应: {r2}")

    # 3) 模拟每分钟聚合
    print("3) 上报每分钟聚合 ...")
    aggregate = {
        "schoolId": 1,
        "gradeId": 1,
        "classId": 1,
        "lessonRecordId": 1,
        "minuteStart": datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat(),
        "focusCount": 28,
        "handRaiseCount": 2,
        "writingCount": 5,
        "talkingCount": 3,
        "sleepingCount": 1,
        "phoneCount": 2,
        "eatingCount": 0,
        "leavingCount": 0,
        "totalDetected": 13,
    }
    r3 = sender.report_aggregate(aggregate)
    print(f"   响应: {r3}")

    print("\n✓ 模拟事件上报完成，请检查后端日志和数据库")


if __name__ == "__main__":
    main()
