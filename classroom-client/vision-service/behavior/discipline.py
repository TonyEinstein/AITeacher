"""
纪律检测模块
检测：说话、走动、睡觉/趴桌、缺课
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)


class DisciplineDetector:
    def __init__(self, config):
        self.sleep_threshold = float(config['sleep_threshold'])
        self.noise_threshold = float(config['noise_threshold'])
        self.history = {}  # studentId -> {'positions': [], 'states': []}
        self.walk_threshold = 50  # 移动像素阈值
        # 考勤跟踪
        self.lesson_start = None            # 上课开始时间戳
        self.late_grace = 300               # 迟到宽限秒数（5分钟）
        self.first_seen = {}                # studentId -> 首次出现时间
        self.last_seen = {}                 # studentId -> 最后出现时间
        self.late_reported = set()          # 已上报迟到
        self.early_reported = set()         # 已上报早退
        self.absent_reported = set()        # 已上报缺课
        self.early_leave_missing = 180      # 连续消失多少秒判为早退

    def detect(self, frame: np.ndarray, faces: list) -> list:
        """
        检测纪律事件
        返回: [{'type': 'sleep'|'walk'|'absent'|'talk', 'studentId': int, 'detail': str}, ...]
        """
        events = []
        current_ids = set()

        for face in faces:
            sid = face.get('studentId')
            if not sid:
                continue
            current_ids.add(sid)
            x, y, w, h = face['box']

            if sid not in self.history:
                self.history[sid] = {'positions': [], 'states': [], 'head_angles': []}

            hist = self.history[sid]
            cx, cy = x + w / 2, y + h / 2
            hist['positions'].append((cx, cy))
            if len(hist['positions']) > 30:
                hist['positions'].pop(0)

            # 走动检测：位置变化过大
            if len(hist['positions']) >= 10:
                first = hist['positions'][0]
                last = hist['positions'][-1]
                dist = ((first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2) ** 0.5
                if dist > self.walk_threshold:
                    events.append({
                        'type': 'walk',
                        'studentId': sid,
                        'detail': '课堂走动',
                    })

            # 趴桌/睡觉检测（人脸高度异常小或头部低垂）
            # 简化：人脸宽高比异常 + 位置偏下
            if h < 40 and y > frame.shape[0] * 0.6:
                hist['states'].append('sleep')
                if len(hist['states']) > 60 and hist['states'].count('sleep') > 45:
                    events.append({
                        'type': 'sleep',
                        'studentId': sid,
                        'detail': '疑似睡觉/趴桌',
                    })
            else:
                hist['states'].append('normal')
                if len(hist['states']) > 60:
                    hist['states'].pop(0)

        return events

    def check_absence(self, expected_students: list, present_ids: set) -> list:
        """检查缺课学生"""
        absent = []
        for student in expected_students:
            if student['id'] not in present_ids and student['id'] not in self.absent_reported:
                absent.append({
                    'type': 'absent',
                    'studentId': student['id'],
                    'name': student.get('name', ''),
                    'detail': '未检测到人脸',
                })
        return absent

    def start_lesson(self, start_time=None):
        """课程开始时调用，重置考勤跟踪"""
        import time as _time
        self.lesson_start = start_time or _time.time()
        self.first_seen = {}
        self.last_seen = {}
        self.late_reported.clear()
        self.early_reported.clear()
        self.absent_reported.clear()

    def check_attendance(self, faces: list, expected_students: list, now=None):
        """
        考勤检测：迟到 / 早退 / 缺课
        需在课程进行中周期性调用。
        返回事件列表。
        """
        import time as _time
        now = now or _time.time()
        events = []
        if not self.lesson_start:
            return events

        present_ids = set()
        for face in faces:
            sid = face.get('studentId')
            if not sid:
                continue
            present_ids.add(sid)
            if sid not in self.first_seen:
                self.first_seen[sid] = now
            self.last_seen[sid] = now

        name_map = {s['id']: s.get('name', '') for s in expected_students}

        # 迟到：首次出现时间晚于 上课时间 + 宽限期
        for sid, first in self.first_seen.items():
            if sid in self.late_reported:
                continue
            late_seconds = first - self.lesson_start
            if late_seconds > self.late_grace:
                self.late_reported.add(sid)
                events.append({
                    'type': 'late',
                    'studentId': sid,
                    'name': name_map.get(sid, ''),
                    'minutesLate': int(late_seconds // 60),
                    'detail': '迟到 %d 分钟' % int(late_seconds // 60),
                })

        # 早退：已到过、但连续消失超过阈值（且课程未结束）
        for sid, last in self.last_seen.items():
            if sid in self.early_reported or sid in present_ids:
                continue
            if now - last > self.early_leave_missing:
                self.early_reported.add(sid)
                events.append({
                    'type': 'early_leave',
                    'studentId': sid,
                    'name': name_map.get(sid, ''),
                    'detail': '未经允许离开教室',
                })

        # 缺课：宽限期后仍从未出现
        if now - self.lesson_start > self.late_grace:
            for student in expected_students:
                sid = student['id']
                if sid not in self.first_seen and sid not in self.absent_reported:
                    self.absent_reported.add(sid)
                    events.append({
                        'type': 'absent',
                        'studentId': sid,
                        'name': student.get('name', ''),
                        'detail': '缺课',
                    })

        return events
