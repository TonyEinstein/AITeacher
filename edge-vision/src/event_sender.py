"""事件上报：把行为事件和每分钟聚合 POST 给后端。

断网续传：上报失败时写入本地 queue.jsonl，后台线程定期补传。
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any

import requests

from config import config

logger = logging.getLogger(__name__)


class VisionEventSender:
    def __init__(self, queue_file: str = "data/queue.jsonl"):
        self.base = config.BACKEND_BASE_URL.rstrip("/")
        self.headers = {"x-edge-token": config.EDGE_API_TOKEN}
        self.queue_file = queue_file
        self._lock = threading.Lock()
        os.makedirs(os.path.dirname(self.queue_file), exist_ok=True)
        # 启动后台补传线程
        self._stop = threading.Event()
        threading.Thread(target=self._flush_loop, daemon=True).start()

    def _append_queue(self, endpoint: str, payload: dict[str, Any]):
        """失败事件写入本地队列。"""
        with self._lock:
            with open(self.queue_file, "a", encoding="utf-8") as f:
                f.write(json.dumps({"endpoint": endpoint, "payload": payload}) + "\n")

    def _flush_loop(self):
        """每 10 秒尝试补传本地队列。"""
        while not self._stop.wait(10):
            self._flush_queue()

    def _flush_queue(self):
        if not os.path.exists(self.queue_file):
            return
        with self._lock:
            with open(self.queue_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
        if not lines:
            return
        remaining = []
        for line in lines:
            try:
                item = json.loads(line)
                resp = requests.post(
                    f"{self.base}{item['endpoint']}",
                    json=item["payload"],
                    headers=self.headers,
                    timeout=5,
                )
                resp.raise_for_status()
            except Exception:
                remaining.append(line)
        with self._lock:
            with open(self.queue_file, "w", encoding="utf-8") as f:
                f.writelines(remaining)
        if remaining:
            logger.warning(f"补传仍有 {len(remaining)} 条待发")
        else:
            logger.info("本地队列已清空")

    def report_event(self, payload: dict[str, Any]) -> dict | None:
        """上报单条行为事件。"""
        try:
            resp = requests.post(
                f"{self.base}/api/v1/vision/events",
                json=payload,
                headers=self.headers,
                timeout=5,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"上报事件失败，入本地队列: {e}")
            self._append_queue("/api/v1/vision/events", payload)
            return None

    def report_aggregate(self, payload: dict[str, Any]) -> dict | None:
        """上报每分钟聚合统计。"""
        try:
            resp = requests.post(
                f"{self.base}/api/v1/vision/aggregates",
                json=payload,
                headers=self.headers,
                timeout=5,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"上报聚合失败，入本地队列: {e}")
            self._append_queue("/api/v1/vision/aggregates", payload)
            return None

    def fetch_config(self) -> dict | None:
        """从后端拉取远程配置。"""
        try:
            resp = requests.get(
                f"{self.base}/api/v1/vision/config",
                headers=self.headers,
                timeout=5,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"拉取配置失败: {e}")
            return None
