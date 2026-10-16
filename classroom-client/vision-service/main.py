"""
AI Teacher 教室端视觉服务主入口
运行在树莓派5上，负责：
1. 人脸识别与考勤
2. 举手检测
3. 纪律检测（说话、走动、睡觉）
4. 音频采集与音量检测
5. 双链路网络切换
6. 与后端 WebSocket 实时通信
"""

import asyncio
import configparser
import logging
import signal
import sys
from pathlib import Path

from network.monitor import NetworkMonitor
from network.ws_client import WsClient
from network.http_client import EdgeHttpClient
from face.detector import FaceDetector
from face.recognizer import FaceRecognizer
from behavior.hand_raise import HandRaiseDetector
from behavior.discipline import DisciplineDetector
from behavior.aggregator import MinuteAggregator, AggregatorContext
from behavior.classify import classify_persons
from audio.mic_array import MicArray

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)
logger = logging.getLogger('vision-service')


class VisionService:
    def __init__(self, config_path='config.ini'):
        self.config = configparser.ConfigParser()
        self.config.read(config_path, encoding='utf-8')
        self.running = False

        # 初始化各模块
        self.network = NetworkMonitor(self.config['network'])
        self.ws = WsClient(self.config['service'])
        self.face_detector = FaceDetector(self.config['face'])
        self.face_recognizer = FaceRecognizer(self.config['face'])
        self.hand_detector = HandRaiseDetector(self.config['behavior'])
        self.discipline = DisciplineDetector(self.config['behavior'])
        self.mic = MicArray(self.config['audio'])

        # HTTP 通道：每分钟聚合上报 + 远程配置轮询（与 WS 实时事件并行）
        api_url = self.config['service'].get('api_url', 'http://localhost:3000/api/v1')
        self.http = EdgeHttpClient(api_url, self.config['service'].get('edge_token', ''))
        self.aggregator = MinuteAggregator(self.http)

        # 远程配置轮询：刷新课次上下文（上课/下课自动感知）
        self.config_poll_interval = int(self.config['service'].get('config_poll_interval', '30'))

    async def start(self):
        """启动服务"""
        logger.info('=== AI Teacher 视觉服务启动 ===')
        self.running = True

        # 确保数据目录存在
        Path('./data/faces').mkdir(parents=True, exist_ok=True)

        # 启动网络监控
        asyncio.create_task(self.network_monitor_loop())

        # 启动 WebSocket
        asyncio.create_task(self.ws_loop())

        # 启动视觉检测主循环
        asyncio.create_task(self.vision_loop())

        # 启动音频检测
        asyncio.create_task(self.audio_loop())

        # 启动远程配置轮询（课次上下文自动感知）
        asyncio.create_task(self.config_loop())

        # 等待退出信号
        while self.running:
            await asyncio.sleep(1)

    async def network_monitor_loop(self):
        """网络监控与双链路切换"""
        while self.running:
            status = await self.network.check()
            if status == 'primary_down':
                logger.warning('主链路断开，切换到4G备用链路')
                await self.network.switch_to_backup()
                await self.ws.reconnect()
            elif status == 'primary_recovered':
                logger.info('主链路恢复，切回有线网络')
                await self.network.switch_to_primary()
            await asyncio.sleep(int(self.config['network']['check_interval']))

    async def ws_loop(self):
        """WebSocket 连接维护"""
        while self.running:
            try:
                await self.ws.connect()
                await self.ws.run_forever()
            except Exception as e:
                logger.error(f'WebSocket 断开: {e}，3秒后重连')
                await asyncio.sleep(3)

    async def config_loop(self):
        """轮询远程配置，刷新课次上下文（无课/下课自动清空）"""
        serial = self.config['service'].get('device_serial', 'DEV-BOX-001')
        while self.running:
            try:
                cfg = await self.http.fetch_config(serial)
                lesson = (cfg or {}).get('lessonContext')
                if lesson:
                    self.aggregator.set_context(AggregatorContext(
                        schoolId=lesson['schoolId'],
                        gradeId=lesson['gradeId'],
                        classId=lesson['classId'],
                        lessonRecordId=lesson['lessonRecordId'],
                    ))
                else:
                    self.aggregator.set_context(None)
            except Exception as e:
                logger.warning(f'配置轮询失败（保留现有上下文）: {e}')
            await asyncio.sleep(self.config_poll_interval)

    async def vision_loop(self):
        """视觉检测主循环"""
        import cv2
        cap = cv2.VideoCapture(int(self.config['service']['camera_id']))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, int(self.config['service']['camera_width']))
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, int(self.config['service']['camera_height']))

        frame_count = 0
        detect_interval = int(self.config['face']['detect_interval'])
        last_agg_tick = 0.0
        agg_tick_interval = 1.0  # 聚合器滚动检查频率（秒）

        while self.running and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                continue

            frame_count += 1

            if frame_count % detect_interval == 0:
                # 人脸检测
                faces = self.face_detector.detect(frame)
                recognized = self.face_recognizer.recognize(frame, faces)

                # 上报考勤
                if recognized:
                    await self.ws.send_event('attendance', {'students': recognized})

                # 举手检测
                hands = self.hand_detector.detect(frame, faces)
                for hand in hands:
                    await self.ws.send_event('hand_raise', hand)

                # 纪律检测
                events = self.discipline.detect(frame, faces)
                for event in events:
                    await self.ws.send_event('discipline', event)

                # —— 每分钟聚合累加（A2）——
                # 把本次检测 pass 归一成「每人一个行为」后累加进当前分钟桶
                hand_raised_ids = {hand['studentId'] for hand in hands if hand.get('studentId')}
                sleep_ids = {
                    ev['studentId'] for ev in events
                    if ev.get('type') == 'sleep' and ev.get('studentId')
                }
                for sid, behavior in classify_persons(
                    faces=recognized,
                    hand_raised_ids=hand_raised_ids,
                    sleep_ids=sleep_ids,
                ):
                    self.aggregator.accumulate(behavior)

            # 聚合器分钟滚动检查（每秒一次，轻量）
            now = asyncio.get_event_loop().time()
            if now - last_agg_tick >= agg_tick_interval:
                last_agg_tick = now
                try:
                    await self.aggregator.tick()
                except Exception as e:
                    logger.warning(f'聚合 tick 异常（已入重试队列或跳过）: {e}')

            await asyncio.sleep(1 / int(self.config['service']['camera_fps']))

        cap.release()

    async def audio_loop(self):
        """音频检测循环"""
        while self.running:
            noise_level = await self.mic.get_noise_level()
            if noise_level > float(self.config['behavior']['noise_threshold']):
                await self.ws.send_event('noise', {'level': noise_level})
            await asyncio.sleep(2)

    def stop(self):
        logger.info('服务停止中...')
        self.running = False
        # 停机前把未满的当前分钟桶入重试队列，避免最后一分钟数据丢失
        try:
            self.aggregator.stop()
        except Exception:
            pass


async def main():
    service = VisionService()

    def signal_handler(sig, frame):
        service.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await service.start()
    except Exception as e:
        logger.exception(f'服务异常: {e}')
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
