"""
人脸检测模块
使用 OpenCV DNN 或 MediaPipe 进行人脸检测
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)


class FaceDetector:
    def __init__(self, config):
        self.config = config
        self.threshold = float(config['confidence_threshold'])
        self.net = None
        self._init_model()

    def _init_model(self):
        """初始化人脸检测模型"""
        try:
            import cv2
            # 使用 OpenCV 自带的 DNN 人脸检测器
            model_file = 'models/opencv_face_detector.caffemodel'
            config_file = 'models/deploy.prototxt'
            try:
                self.net = cv2.dnn.readNetFromCaffe(config_file, model_file)
                logger.info('DNN 人脸检测器加载成功')
            except Exception:
                # 降级到 Haar 级联
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                self.cascade = cv2.CascadeClassifier(cascade_path)
                logger.info('Haar 级联人脸检测器加载成功')
        except Exception as e:
            logger.warning(f'人脸检测模型加载失败，使用模拟模式: {e}')
            self.net = None

    def detect(self, frame: np.ndarray) -> list:
        """
        检测画面中的人脸
        返回: [{'box': [x, y, w, h], 'confidence': float}, ...]
        """
        if self.net is None and not hasattr(self, 'cascade'):
            return self._mock_detect(frame)

        import cv2
        h, w = frame.shape[:2]
        faces = []

        if hasattr(self, 'cascade'):
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            detections = self.cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
            for (x, y, fw, fh) in detections:
                faces.append({'box': [int(x), int(y), int(fw), int(fh)], 'confidence': 0.9})
        else:
            blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 1.0, (300, 300), (104, 177, 123))
            self.net.setInput(blob)
            detections = self.net.forward()
            for i in range(detections.shape[2]):
                conf = detections[0, 0, i, 2]
                if conf > self.threshold:
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    x1, y1, x2, y2 = box.astype(int)
                    faces.append({'box': [x1, y1, x2 - x1, y2 - y1], 'confidence': float(conf)})

        return faces

    def _mock_detect(self, frame: np.ndarray) -> list:
        """开发环境模拟检测"""
        return []
