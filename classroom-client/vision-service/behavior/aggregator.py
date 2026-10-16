"""
每分钟行为聚合计数器

职责：
- 每次检测 pass 把各 track 的行为累加进「当前分钟桶」
- 分钟滚动时把「刚完成的上一分钟桶」上报到后端
  POST /api/v1/vision/aggregates（后端 upsert 幂等，重推安全）
- 无课次上下文时跳过累加与上报（避免 lessonRecordId=0 的脏数据）
- 上报失败进有界重试队列，恢复后优先排空

口径说明（与 edge-vision/src/main.py::_aggregate_per_minute 一致）：
- 桶内计数为「该分钟内所有检测 pass 中各行为出现的次数」，
  focusCount 等于所有非违纪行为之和是正常现象（一个人一分钟内
  可以先举手后专注，两人次）。
- totalDetected 独立累加，可能大于人数。
"""

import logging
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# 重试队列上限：本地断网一小时也不至于内存膨胀（每分钟 1 条）
MAX_RETRY_QUEUE = 120

# 已知行为 → 计数字段名；字段全集以后端 MinuteAggregateDto 为准（无 standing 桶，
# standing 观测只进 totalDetected）；未知行为同样只进 totalDetected
BEHAVIOR_FIELD_MAP = {
    "focus": "focusCount",
    "hand_raise": "handRaiseCount",
    "writing": "writingCount",
    "talking": "talkingCount",
    "sleeping": "sleepingCount",
    "using_phone": "phoneCount",
    "eating": "eatingCount",
    "leaving_seat": "leavingCount",
}

# 上报 DTO 字段全集（与后端 MinuteAggregateDto 对齐）
COUNT_FIELDS = [
    "focusCount", "handRaiseCount", "writingCount", "talkingCount",
    "sleepingCount", "phoneCount", "eatingCount", "leavingCount",
]


@dataclass
class AggregatorContext:
    schoolId: int
    gradeId: int
    classId: int
    lessonRecordId: int


def _empty_bucket() -> dict:
    b = {f: 0 for f in COUNT_FIELDS}
    b["totalDetected"] = 0
    return b


class MinuteAggregator:
    def __init__(self, http_client, clock=time.time):
        """
        :param http_client: 需实现 await post_aggregate(payload)（见 network/http_client.py）
        :param clock: 时间函数，可注入假时钟做测试
        """
        self.http = http_client
        self.clock = clock
        self.ctx: AggregatorContext | None = None
        # minute_key -> 计数桶；key = epoch 分钟号
        self._buckets: dict[int, dict] = {}
        self._last_pushed_minute = -1
        # 上报失败待重试的 payload 列表（有界）
        self.retry_queue: list[dict] = []

    # ---------- 数据入口 ----------

    def set_context(self, ctx: AggregatorContext | None):
        """课次上下文由外部（config 轮询）注入；None 表示当前无课"""
        if ctx is None or ctx.lessonRecordId in (None, 0):
            self.ctx = None
            self._buckets.clear()
            return
        if self.ctx and self.ctx.lessonRecordId != ctx.lessonRecordId:
            # 换课：清桶，避免上一节课的计数串到新课
            self._buckets.clear()
        self.ctx = ctx

    def accumulate(self, behavior: str):
        """把一次观测到的行为累加进当前分钟桶；无上下文时静默跳过"""
        if self.ctx is None:
            return
        bucket = self._buckets.setdefault(int(self.clock() // 60), _empty_bucket())
        bucket["totalDetected"] += 1
        field = BEHAVIOR_FIELD_MAP.get(behavior)
        if field:
            bucket[field] += 1

    # ---------- 分钟滚动与上报 ----------

    async def tick(self):
        """分钟滚动检查：推「刚完成的上一分钟」桶。主循环每秒调用即可。"""
        if self.ctx is None:
            return
        # 有积压先尝试排空重试队列（网络恢复后即使无新桶也能补旧数据）
        if self.retry_queue:
            await self._drain_retry_queue()
        current_minute = int(self.clock() // 60)
        # 推送所有已完成（< current_minute）且未推过的桶，防止主循环卡顿漏分钟
        for minute_key in sorted(self._buckets):
            if minute_key >= current_minute:
                break
            if minute_key <= self._last_pushed_minute:
                continue
            await self._push_bucket(minute_key)
            self._last_pushed_minute = max(self._last_pushed_minute, minute_key)
        # 当前分钟桶不存在时也补一条全 0 上报，保证后端时间轴连续
        if self._last_pushed_minute < current_minute - 1:
            await self._push_empty_range(self._last_pushed_minute + 1, current_minute - 1)
            self._last_pushed_minute = current_minute - 1

    async def _drain_retry_queue(self):
        """逐条重试队头；失败即停（保序），成功则弹出继续"""
        while self.retry_queue:
            item = self.retry_queue[0]
            try:
                await self.http.post_aggregate(item)
            except Exception as e:
                logger.warning(f"聚合上报仍失败，保留 {len(self.retry_queue)} 条待重试: {e}")
                return
            else:
                self.retry_queue.pop(0)

    def _enqueue(self, payload: dict):
        """进入重试队列；超上限丢弃最旧（保内存有界）"""
        self.retry_queue.append(payload)
        if len(self.retry_queue) > MAX_RETRY_QUEUE:
            dropped = self.retry_queue.pop(0)
            logger.warning(f"重试队列超上限 {MAX_RETRY_QUEUE}，丢弃最旧一条（minuteStart={dropped.get('minuteStart')}）")

    async def _push_bucket(self, minute_key: int):
        bucket = self._buckets.pop(minute_key, None)
        if bucket is None:
            bucket = _empty_bucket()
        payload = self._build_payload(minute_key, bucket)
        await self._send(payload)

    async def _push_empty_range(self, from_minute: int, to_minute: int):
        """补推中间空缺的分钟（全 0），最多回补 5 分钟防启动风暴"""
        from_minute = max(from_minute, to_minute - 4)
        for m in range(from_minute, to_minute + 1):
            await self._send(self._build_payload(m, _empty_bucket()))

    def _build_payload(self, minute_key: int, bucket: dict) -> dict:
        from datetime import datetime, timezone

        minute_start = datetime.fromtimestamp(minute_key * 60, tz=timezone.utc)
        payload = {
            "schoolId": self.ctx.schoolId,
            "gradeId": self.ctx.gradeId,
            "classId": self.ctx.classId,
            "lessonRecordId": self.ctx.lessonRecordId,
            "minuteStart": minute_start.isoformat(),
        }
        payload.update({f: bucket.get(f, 0) for f in COUNT_FIELDS})
        payload["totalDetected"] = bucket.get("totalDetected", 0)
        return payload

    async def _send(self, payload: dict):
        if self.retry_queue:
            # 已有积压：新 payload 直接排队尾，由 _drain_retry_queue 保序补发
            self._enqueue(payload)
            return
        try:
            await self.http.post_aggregate(payload)
        except Exception as e:
            self._enqueue(payload)
            logger.warning(f"聚合上报失败，进入重试队列（{len(self.retry_queue)} 条）: {e}")

    def stop(self):
        """停机路径：把未满的当前分钟桶入重试队列，待下次启动/由 drain 补发。
        同步方法，事件循环关闭前调用；不直接发网络请求。"""
        if self.ctx is None:
            return
        current = int(self.clock() // 60)
        bucket = self._buckets.pop(current, None)
        if bucket and bucket.get("totalDetected", 0) > 0:
            self._enqueue(self._build_payload(current, bucket))
