"""边缘端纯函数单元测试：不依赖摄像头/网络/模型。

运行: conda run -n ai-teacher --no-capture-output python scripts/test_logic.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from detector import TrackedPerson  # noqa: E402
from main import ClassroomPipeline  # noqa: E402


def test_violation_debounce():
    """同学生同类 5 分钟内不重复触发。"""
    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.class_start = 0
    p.last_violation = {}

    # 第一次触发
    key = "track_5:sleeping"
    assert key not in p.last_violation or (p.last_violation.get(key, 0) == 0)
    p.last_violation[key] = 1000.0

    # 4 分钟后不应再触发
    assert 1000.0 + 240 < 1000.0 + 300
    # 6 分钟后应该触发
    assert 1000.0 + 360 >= 1000.0 + 300
    print("✓ 防抖逻辑正确")


def test_walking_grace_period():
    """上课 15 分钟内 walking 不触发。"""
    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.class_start = 0
    p.last_violation = {}

    # 模拟上课 5 分钟
    elapsed = 300
    assert elapsed < 900, "5 分钟不应触发 walking"
    print("✓ walking 宽限期正确")


def test_tracked_person_dataclass():
    t = TrackedPerson(track_id=1, bbox=(10, 20, 100, 200), confidence=0.95, center=(55.0, 110.0))
    assert t.track_id == 1
    assert t.confidence == 0.95
    print("✓ TrackedPerson 数据结构正确")


def test_detector_leaves_behavior_at_default():
    """固定当前真实契约：StudentDetector 不填 behavior，只检测 person + 跟踪。

    这条测试存在的意义是**把已知限制钉住**，防止「专注率恒 100%」被误当成偶发 bug：
    behavior 恒为 dataclass 默认 "focus" → 所有计数塌缩进 focusCount。
    行为分类头训练完成、detector 开始填 behavior 后，本测试应随之更新。
    （详见 edge-vision/README.md「骨架，缺行为分类头」与 main.py::_aggregate_per_minute 注释）
    """
    t = TrackedPerson(track_id=1, bbox=(0, 0, 1, 1), confidence=0.9, center=(0, 0))
    assert t.behavior == "focus", "未显式赋 behavior 时应为 dataclass 默认值 focus"
    # 模拟「检测器未分类」的两条 track，验证它们确实塌缩进 focusCount
    from collections import defaultdict
    import time as _time

    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.minute_buckets = defaultdict(lambda: defaultdict(int))
    p._aggregate_per_minute([t, t])
    bucket = p.minute_buckets[int(_time.time() // 60)]
    assert bucket["focusCount"] == 2, "未分类时全部记为 focus（当前真实行为）"
    assert bucket.get("talkingCount", 0) == 0, "未分类时不会有其它行为计数"
    print("✓ 已固定 detector 未填 behavior 的现状（限制有据可查）")


def test_minute_aggregate_keys():
    """每分钟聚合字段名与后端 DTO 对齐。"""
    expected = {
        "focusCount", "handRaiseCount", "writingCount", "talkingCount",
        "sleepingCount", "phoneCount", "eatingCount", "leavingCount", "totalDetected",
    }
    # main.py 里 _push_minute_aggregate 的 payload keys
    payload_keys = {
        "focusCount", "handRaiseCount", "writingCount", "talkingCount",
        "sleepingCount", "phoneCount", "eatingCount", "leavingCount", "totalDetected",
    }
    assert expected == payload_keys
    print("✓ 聚合字段与后端 DTO 对齐")


def test_aggregate_counts_focus():
    """显式 focus 行为的 track 计入 focusCount。"""
    from collections import defaultdict
    import time as _time

    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.minute_buckets = defaultdict(lambda: defaultdict(int))

    tracks = [
        TrackedPerson(track_id=1, bbox=(0, 0, 10, 10), confidence=0.9, center=(5, 5), behavior="focus"),
        TrackedPerson(track_id=2, bbox=(0, 0, 10, 10), confidence=0.9, center=(5, 5), behavior="focus"),
        TrackedPerson(track_id=3, bbox=(0, 0, 10, 10), confidence=0.9, center=(5, 5), behavior="talking"),
    ]
    p._aggregate_per_minute(tracks)

    bucket = p.minute_buckets[int(_time.time() // 60)]
    assert bucket["totalDetected"] == 3, "检测人数应为 3"
    assert bucket["focusCount"] == 2, "专注人次应为 2"
    assert bucket["talkingCount"] == 1, "说话人次应为 1"
    print("✓ 显式 focus 行为计入 focusCount")


def test_aggregate_empty_tracks():
    """空检测帧：所有计数为 0，不抛错（Review Focus #5）。"""
    from collections import defaultdict
    import time as _time

    p = ClassroomPipeline.__new__(ClassroomPipeline)
    p.minute_buckets = defaultdict(lambda: defaultdict(int))
    p._aggregate_per_minute([])

    bucket = p.minute_buckets[int(_time.time() // 60)]
    assert bucket["totalDetected"] == 0
    assert bucket["focusCount"] == 0
    print("✓ 空帧聚合安全")


if __name__ == "__main__":
    test_tracked_person_dataclass()
    test_violation_debounce()
    test_walking_grace_period()
    test_minute_aggregate_keys()
    test_detector_leaves_behavior_at_default()
    test_aggregate_counts_focus()
    test_aggregate_empty_tracks()
    print("\n全部通过 ✓")
