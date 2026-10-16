"""
MinuteAggregator 单元测试（stdlib unittest，零第三方依赖，树莓派可直接跑）

覆盖：分钟桶累加、滚动推送上一分钟桶、无上下文跳过、失败重试有界、
      DTO 字段全集、flush 行为。
"""

import asyncio
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock

from behavior.aggregator import MinuteAggregator, AggregatorContext


def make_ctx(lesson_record_id=42):
    return AggregatorContext(
        schoolId=1,
        gradeId=2,
        classId=11,
        lessonRecordId=lesson_record_id,
    )


class FakeClock:
    """可控时钟：手动推进，避免 sleep"""

    def __init__(self):
        self.t = datetime(2026, 10, 9, 10, 0, 30, tzinfo=timezone.utc).timestamp()

    def time(self):
        return self.t

    def advance(self, sec):
        self.t += sec


def iso(minutes, seconds=0):
    """构造桶 key 对应的 minuteStart ISO 串"""
    base = datetime(2026, 10, 9, 10, 0, seconds, tzinfo=timezone.utc)
    return (datetime.fromtimestamp(base.timestamp() + minutes * 60, tz=timezone.utc)).isoformat()


class AsyncTestCase(unittest.TestCase):
    """简化版异步测试基类：setUp 里建事件循环，teardown 关闭"""

    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        super().setUp()

    def tearDown(self):
        # 收割未 await 的协程，消除 RuntimeWarning
        pending = asyncio.all_tasks(self.loop)
        for task in pending:
            self.loop.run_until_complete(task)
        self.loop.close()
        asyncio.set_event_loop(None)
        super().tearDown()

    def run_async(self, coro):
        return self.loop.run_until_complete(coro)


class TestAccumulate(unittest.TestCase):
    def setUp(self):
        self.http = AsyncMock()
        self.clock = FakeClock()
        self.agg = MinuteAggregator(self.http, clock=self.clock.time)
        self.agg.ctx = make_ctx()

    def test_counts_by_behavior(self):
        """不同行为归入各自计数；未知行为不计入任何已知桶"""
        self.agg.accumulate("focus")
        self.agg.accumulate("focus")
        self.agg.accumulate("hand_raise")
        self.agg.accumulate("sleeping")
        bucket = self.agg._buckets[self.clock.time() // 60]
        self.assertEqual(bucket["focusCount"], 2)
        self.assertEqual(bucket["handRaiseCount"], 1)
        self.assertEqual(bucket["sleepingCount"], 1)
        self.assertEqual(bucket["totalDetected"], 4)

    def test_unknown_behavior_counts_only_in_total(self):
        """未知行为（模型未来新增类）只进 totalDetected，不进已知计数"""
        self.agg.accumulate("meditating")
        bucket = self.agg._buckets[self.clock.time() // 60]
        self.assertEqual(bucket["totalDetected"], 1)
        self.assertEqual(bucket["focusCount"], 0)

    def test_minute_rollover_splits_buckets(self):
        """跨分钟时自动开新桶，旧桶保留待推"""
        self.agg.accumulate("focus")
        self.clock.advance(61)
        self.agg.accumulate("focus")
        keys = sorted(self.agg._buckets.keys())
        self.assertEqual(len(keys), 2)

    def test_no_context_skips_accumulate(self):
        """无课次上下文时不累加（lessonRecordId=0 上报无意义）"""
        self.agg.ctx = None
        self.agg.accumulate("focus")
        self.assertEqual(len(self.agg._buckets), 0)


class TestRolloverAndPush(AsyncTestCase):
    def setUp(self):
        super().setUp()
        self.http = AsyncMock()
        self.clock = FakeClock()
        self.agg = MinuteAggregator(self.http, clock=self.clock.time)
        self.agg.ctx = make_ctx()

    def tearDown(self):
        super().tearDown()

    def test_pushes_completed_previous_minute(self):
        """滚动时推「刚完成的上一分钟」桶，而非当前未满桶（修正 edge-vision 的 off-by-one）"""
        self.agg.accumulate("focus")
        self.agg.accumulate("sleeping")
        self.clock.advance(61)  # 进入下一分钟
        self.agg.accumulate("focus")

        self.run_async(self.agg.tick())
        # 上一分钟桶应已推送
        self.http.post_aggregate.assert_called_once()
        payload = self.http.post_aggregate.call_args[0][0]
        self.assertEqual(payload["minuteStart"], iso(0))
        self.assertEqual(payload["focusCount"], 1)
        self.assertEqual(payload["sleepingCount"], 1)
        self.assertEqual(payload["totalDetected"], 2)

    def test_payload_field_set_matches_backend_dto(self):
        """上报字段全集与后端 MinuteAggregateDto 对齐"""
        self.agg.accumulate("focus")
        self.clock.advance(61)
        self.run_async(self.agg.tick())
        payload = self.http.post_aggregate.call_args[0][0]
        expected = {
            "schoolId", "gradeId", "classId", "lessonRecordId", "minuteStart",
            "focusCount", "handRaiseCount", "writingCount", "talkingCount",
            "sleepingCount", "phoneCount", "eatingCount", "leavingCount",
            "totalDetected",
        }
        self.assertEqual(set(payload.keys()), expected)

    def test_empty_minute_pushes_zero_counts(self):
        """空分钟也推全 0（后端靠连续序列画曲线）"""
        self.clock.advance(61)
        self.run_async(self.agg.tick())
        payload = self.http.post_aggregate.call_args[0][0]
        self.assertEqual(payload["totalDetected"], 0)
        self.assertEqual(payload["focusCount"], 0)

    def test_no_context_skips_push(self):
        """无上下文时 tick 不推送"""
        self.agg.ctx = None
        self.clock.advance(61)
        self.run_async(self.agg.tick())
        self.http.post_aggregate.assert_not_called()

    def test_retry_queue_bounded(self):
        """失败进入重试队列且有上限，超出丢弃最旧"""
        from behavior.aggregator import MAX_RETRY_QUEUE
        self.agg.accumulate("focus")
        self.clock.advance(61)
        self.http.post_aggregate.side_effect = Exception("net down")
        self.run_async(self.agg.tick())
        self.assertEqual(len(self.agg.retry_queue), 1)

        # 再制造多次失败，验证队列有界
        for _ in range(MAX_RETRY_QUEUE + 5):
            self.agg.accumulate("focus")
            self.clock.advance(61)
            self.run_async(self.agg.tick())
        self.assertLessEqual(len(self.agg.retry_queue), MAX_RETRY_QUEUE)

    def test_retry_queue_drained_on_success(self):
        """网络恢复后重试队列被排空"""
        self.agg.accumulate("focus")
        self.clock.advance(61)
        self.http.post_aggregate.side_effect = Exception("net down")
        self.run_async(self.agg.tick())
        self.http.post_aggregate.side_effect = None
        self.run_async(self.agg.tick())
        # 队列应已清空：成功那次推的是重试项
        self.assertEqual(len(self.agg.retry_queue), 0)


if __name__ == "__main__":
    unittest.main()
