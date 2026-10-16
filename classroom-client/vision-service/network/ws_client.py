"""
WebSocket 客户端
与后端实时通信，上报视觉事件，接收课堂指令
"""

import logging
import asyncio
import json
import time

logger = logging.getLogger(__name__)


class WsClient:
    def __init__(self, config):
        self.api_url = config.get('api_url', 'http://localhost:3000/api/v1')
        self.serial = config.get('device_serial', 'DEV-BOX-001')
        self.ws_url = self.api_url.replace('http', 'ws').replace('/api/v1', '/ws/box')
        self.ws = None
        self.connected = False
        self.reconnect_delay = 3
        self.event_queue = asyncio.Queue()

    async def connect(self):
        """建立 WebSocket 连接"""
        try:
            import websockets
            url = f'{self.ws_url}?serial={self.serial}'
            self.ws = await websockets.connect(url, ping_interval=30, ping_timeout=10)
            self.connected = True
            logger.info(f'WebSocket 已连接: {url}')
        except ImportError:
            logger.warning('websockets 未安装，使用 HTTP 轮询模式')
            self.connected = False
        except Exception as e:
            logger.error(f'WebSocket 连接失败: {e}')
            self.connected = False
            raise

    async def run_forever(self):
        """持续运行，接收服务端消息"""
        if not self.ws:
            return
        try:
            async for message in self.ws:
                data = json.loads(message)
                await self._handle_message(data)
        except Exception as e:
            logger.error(f'WebSocket 连接断开: {e}')
            self.connected = False

    async def _handle_message(self, data: dict):
        """处理服务端下发的指令"""
        event = data.get('event')
        payload = data.get('data', {})

        if event == 'start_lesson':
            logger.info(f'开始上课: {payload}')
        elif event == 'end_lesson':
            logger.info('下课')
        elif event == 'call_student':
            logger.info(f'点名学生: {payload.get("studentName")}')
        elif event == 'warning':
            logger.info(f'纪律警告: {payload}')
        elif event == 'ping':
            await self.send_raw({'event': 'pong'})

    async def send_event(self, event_type: str, data: dict):
        """上报事件"""
        msg = {
            'event': event_type,
            'serial': self.serial,
            'timestamp': int(time.time() * 1000),
            'data': data,
        }
        if self.connected and self.ws:
            try:
                await self.ws.send(json.dumps(msg, ensure_ascii=False))
            except Exception as e:
                logger.error(f'发送失败: {e}')
                await self.event_queue.put(msg)
        else:
            # 离线时缓存事件
            await self.event_queue.put(msg)

    async def send_raw(self, msg: dict):
        if self.ws:
            await self.ws.send(json.dumps(msg, ensure_ascii=False))

    async def reconnect(self):
        """重新连接"""
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
        await asyncio.sleep(self.reconnect_delay)
        await self.connect()
