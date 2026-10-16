"""
麦克风阵列模块
4麦阵列采集，计算课堂噪声水平，声源定位
"""

import logging
import asyncio
import numpy as np

logger = logging.getLogger(__name__)


class MicArray:
    def __init__(self, config):
        self.sample_rate = int(config['sample_rate'])
        self.channels = int(config['channels'])
        self.device = config['mic_device']
        self.stream = None

    async def get_noise_level(self) -> float:
        """
        获取当前课堂噪声水平 (0.0 ~ 1.0)
        开发环境返回模拟值
        """
        try:
            import sounddevice as sd
            duration = 0.5
            recording = sd.rec(
                int(duration * self.sample_rate),
                samplerate=self.sample_rate,
                channels=self.channels,
                device=self.device if self.device != 'default' else None,
            )
            sd.wait()
            rms = np.sqrt(np.mean(recording ** 2))
            level = min(1.0, rms * 5)
            return float(level)
        except ImportError:
            # 开发环境模拟
            await asyncio.sleep(0.1)
            return 0.15
        except Exception as e:
            logger.debug(f'音频采集失败: {e}')
            return 0.0

    async def record_segment(self, duration: float) -> np.ndarray:
        """录制一段音频，用于语音识别"""
        try:
            import sounddevice as sd
            recording = sd.rec(
                int(duration * self.sample_rate),
                samplerate=self.sample_rate,
                channels=1,
            )
            sd.wait()
            return recording.flatten()
        except ImportError:
            return np.zeros(int(duration * self.sample_rate))
