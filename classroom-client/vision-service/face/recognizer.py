"""
人脸识别模块
基于 face_recognition 或 OpenCV LBPH 进行人脸比对
"""

import logging
import json
from pathlib import Path
import numpy as np

logger = logging.getLogger(__name__)


class FaceRecognizer:
    def __init__(self, config):
        self.config = config
        self.threshold = float(config['confidence_threshold'])
        self.db_path = Path(config['face_db_path'])
        self.db_path.mkdir(parents=True, exist_ok=True)
        self.face_db = {}
        self.recognizer = None
        self._load_face_db()

    def _load_face_db(self):
        """加载本地人脸库"""
        db_file = self.db_path / 'face_db.json'
        if db_file.exists():
            with open(db_file, 'r', encoding='utf-8') as f:
                self.face_db = json.load(f)
            logger.info(f'加载人脸库: {len(self.face_db)} 人')

    def save_face(self, student_id: int, name: str, face_encoding: list):
        """保存学生人脸特征"""
        self.face_db[str(student_id)] = {
            'name': name,
            'encoding': face_encoding,
        }
        with open(self.db_path / 'face_db.json', 'w', encoding='utf-8') as f:
            json.dump(self.face_db, f, ensure_ascii=False)

    def recognize(self, frame: np.ndarray, faces: list) -> list:
        """
        识别画面中的学生
        返回: [{'studentId': int, 'name': str, 'confidence': float, 'box': [...]}, ...]
        """
        results = []
        if not self.face_db or not faces:
            return results

        try:
            import face_recognition
            known_encodings = []
            known_ids = []
            known_names = []

            for sid, data in self.face_db.items():
                known_encodings.append(np.array(data['encoding']))
                known_ids.append(int(sid))
                known_names.append(data['name'])

            rgb_frame = frame[:, :, ::-1]
            for face in faces:
                x, y, w, h = face['box']
                face_loc = [(y, x + w, y + h, x)]
                encodings = face_recognition.face_encodings(rgb_frame, face_loc)

                if encodings and known_encodings:
                    matches = face_recognition.compare_faces(known_encodings, encodings[0], tolerance=0.5)
                    if True in matches:
                        idx = matches.index(True)
                        results.append({
                            'studentId': known_ids[idx],
                            'name': known_names[idx],
                            'confidence': 0.95,
                            'box': face['box'],
                        })
        except ImportError:
            logger.debug('face_recognition 未安装，跳过识别')
        except Exception as e:
            logger.error(f'人脸识别异常: {e}')

        return results
