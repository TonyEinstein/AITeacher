"""
边缘端 HTTP 客户端

只用 Python 标准库（urllib + asyncio.to_thread），零第三方依赖，
树莓派无需额外安装任何包。与 WebSocket 通道并行存在：
- WS：实时事件（考勤/举手/纪律）
- HTTP：每分钟聚合上报 + 远程配置拉取（本模块）
"""

import asyncio
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)


class EdgeHttpClient:
    def __init__(self, base_url: str, edge_token: str = "", timeout: float = 10.0):
        """
        :param base_url: 如 http://localhost:3000/api/v1
        :param edge_token: x-edge-token 鉴权头（后端 EDGE_API_TOKEN）
        :param timeout: 单请求超时秒数
        """
        self.base_url = base_url.rstrip('/')
        self.edge_token = edge_token
        self.timeout = timeout

    # ---------- 公开 API ----------

    async def post_aggregate(self, payload: dict) -> bool:
        """每分钟聚合上报。2xx 返回 True；非 2xx / 网络错误抛异常（供重试队列）。"""
        await self._request(
            'POST',
            '/vision/aggregates',
            body=payload,
        )
        return True

    async def fetch_config(self, serial: str) -> dict:
        """拉取远程配置；带 serial 时后端附带当前课次上下文 lessonContext。"""
        return await self._request(
            'GET',
            f'/vision/config?{urllib.parse.urlencode({"serial": serial})}',
        )

    # ---------- 内部 ----------

    async def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        url = f'{self.base_url}{path}'
        headers = {'Content-Type': 'application/json'}
        if self.edge_token:
            headers['x-edge-token'] = self.edge_token
        data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        def _blocking():
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read()
                return json.loads(raw.decode('utf-8')) if raw else {}

        try:
            # urllib 是阻塞的，丢进线程避免卡事件循环
            return await asyncio.to_thread(_blocking)
        except urllib.error.HTTPError as e:
            logger.warning(f'HTTP {method} {path} 失败: {e.code}')
            raise
        except Exception as e:
            logger.warning(f'HTTP {method} {path} 异常: {e}')
            raise
