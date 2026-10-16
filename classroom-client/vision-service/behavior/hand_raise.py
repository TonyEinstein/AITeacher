"""
举手检测模块
检测学生举手动作，5秒内识别
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)


class HandRaiseDetector:
    def __init__(self, config):
        self.threshold = float(config['hand_raise_threshold'])
        self.hands_up = {}  # studentId -> 持续帧数
        self.hold_frames = 15  # 持续15帧（约1秒）才算举手
        self.net = None
        self._init_model()

    def _init_model(self):
        """初始化手势检测模型"""
        try:
            # 尝试加载 MediaPipe Hands
            import mediapipe as mp
            self.mp_hands = mp.solutions.hands
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=10,
                min_detection_confidence=0.7,
            )
            logger.info('MediaPipe Hands 加载成功')
        except ImportError:
            logger.warning('mediapipe 未安装，举手检测使用模拟模式')
            self.hands = None

    def detect(self, frame: np.ndarray, faces: list) -> list:
        """
        检测举手学生
        返回: [{'studentId': int, 'event': 'hand_raise', 'duration': int}, ...]
        """
        events = []
        if self.hands is None:
            return events

        try:
            import mediapipe as mp
            rgb = frame[:, :, ::-1]
            result = self.hands.process(rgb)

            if result.multi_hand_landmarks:
                h, w = frame.shape[:2]
                for hand_lms in result.multi_hand_landmarks:
                    # 手腕位置
                    wrist = hand_lms.landmark[0]
                    wrist_y = wrist.y * h
                    # 中指指尖
                    tip = hand_lms.landmark[12]
                    tip_y = tip.y * h

                    # 手举过头顶（指尖高于手腕一定距离）
                    if tip_y < wrist_y - 50:
                        # 找到最近的人脸（简单关联）
                        nearest_face = self._find_nearest_face(wrist.x * w, wrist_y, faces)
                        if nearest_face:
                            sid = nearest_face.get('studentId', 0)
                            self.hands_up[sid] = self.hands_up.get(sid, 0) + 1
                            if self.hands_up[sid] == self.hold_frames:
                                events.append({
                                    'studentId': sid,
                                    'event': 'hand_raise',
                                    'duration': self.hold_frames,
                                })
                    else:
                        # 手放下了
                        for sid in list(self.hands_up.keys()):
                            self.hands_up[sid] = 0
        except Exception as e:
            logger.error(f'举手检测异常: {e}')

        return events

    def _find_nearest_face(self, x: float, y: float, faces: list):
        """根据手的位置找到最近的人脸"""
        if not faces:
            return None
        nearest = None
        min_dist = float('inf')
        for face in faces:
            fx, fy, fw, fh = face['box']
            cx, cy = fx + fw / 2, fy + fh / 2
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist < min_dist:
                min_dist = dist
                nearest = face
        return nearest if min_dist < 300 else None
