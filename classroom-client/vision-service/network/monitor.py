"""
网络监控与双链路切换模块
主链路：有线网口 eth0
备用链路：4G 模块 usb0
"""

import logging
import asyncio
import subprocess
import platform

logger = logging.getLogger(__name__)


class NetworkMonitor:
    def __init__(self, config):
        self.primary = config.get('primary_interface', 'eth0')
        self.backup = config.get('backup_interface', 'usb0')
        self.current = 'primary'
        self.check_interval = int(config.get('check_interval', 5))

    async def check(self) -> str:
        """
        检查网络状态
        返回: 'ok' | 'primary_down' | 'primary_recovered'
        """
        primary_ok = await self._ping('primary')
        backup_ok = await self._ping('backup')

        if self.current == 'primary':
            if not primary_ok and backup_ok:
                return 'primary_down'
        elif self.current == 'backup':
            if primary_ok:
                return 'primary_recovered'

        return 'ok'

    async def _ping(self, link: str) -> bool:
        """通过指定网口 ping 测试"""
        interface = self.primary if link == 'primary' else self.backup
        try:
            if platform.system() == 'Windows':
                # Windows 开发环境直接 ping
                cmd = ['ping', '-n', '1', '-w', '1000', '114.114.114.114']
            else:
                cmd = ['ping', '-I', interface, '-c', '1', '-W', '1', '114.114.114.114']

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.wait()
            return proc.returncode == 0
        except Exception as e:
            logger.debug(f'ping 失败 ({interface}): {e}')
            return False

    async def switch_to_backup(self):
        """切换到4G备用链路"""
        logger.info(f'切换网络: {self.primary} -> {self.backup}')
        # 树莓派上实际切换路由
        if platform.system() != 'Windows':
            try:
                subprocess.run(['sudo', 'ifmetric', self.backup, '10'], check=False)
                subprocess.run(['sudo', 'ifmetric', self.primary, '100'], check=False)
            except Exception as e:
                logger.error(f'切换失败: {e}')
        self.current = 'backup'

    async def switch_to_primary(self):
        """切回主链路"""
        logger.info(f'切换网络: {self.backup} -> {self.primary}')
        if platform.system() != 'Windows':
            try:
                subprocess.run(['sudo', 'ifmetric', self.primary, '10'], check=False)
                subprocess.run(['sudo', 'ifmetric', self.backup, '100'], check=False)
            except Exception as e:
                logger.error(f'切换失败: {e}')
        self.current = 'primary'
