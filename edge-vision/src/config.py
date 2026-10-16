"""配置加载：从 .env 读取所有环境变量。"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# 项目根目录
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


class Config:
    # 后端 API
    BACKEND_BASE_URL: str = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:3000")
    EDGE_API_TOKEN: str = os.getenv("EDGE_API_TOKEN", "dev-token")

    # MinIO
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "127.0.0.1:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    MINIO_BUCKET_EVIDENCE: str = os.getenv("MINIO_BUCKET_EVIDENCE", "classroom-evidence")

    # 教室标识
    SCHOOL_ID: int = int(os.getenv("SCHOOL_ID", "1"))
    GRADE_ID: int = int(os.getenv("GRADE_ID", "1"))
    CLASS_ID: int = int(os.getenv("CLASS_ID", "1"))
    CAMERA_POSITION: str = os.getenv("CAMERA_POSITION", "front")

    # 摄像头
    RTSP_URL: str = os.getenv("RTSP_URL", "")

    # 推理参数
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
    FRAMES_FOR_STABLE_BEHAVIOR: int = int(os.getenv("FRAMES_FOR_STABLE_BEHAVIOR", "8"))
    GRACE_PERIOD_AFTER_START_SEC: int = int(os.getenv("GRACE_PERIOD_AFTER_CLASS_START", "15"))
    DEDUP_WINDOW_SEC: int = int(os.getenv("DEDUP_WINDOW_SEC", "300"))
    VIDEO_PRE_SEC: int = int(os.getenv("VIDEO_PRE_SEC", "10"))
    VIDEO_POST_SEC: int = int(os.getenv("VIDEO_POST_SEC", "20"))
    EVIDENCE_RETENTION_DAYS: int = int(os.getenv("EVIDENCE_RETENTION_DAYS", "90"))


config = Config()
