"""MinIO 存储：上传违纪视频和照片。"""
from __future__ import annotations

import logging
from io import BytesIO
from pathlib import Path

from minio import Minio
from PIL import Image

from config import config

logger = logging.getLogger(__name__)


class EvidenceStorage:
    def __init__(self):
        self.client = Minio(
            config.MINIO_ENDPOINT,
            access_key=config.MINIO_ACCESS_KEY,
            secret_key=config.MINIO_SECRET_KEY,
            secure=config.MINIO_SECURE,
        )
        self.bucket = config.MINIO_BUCKET_EVIDENCE
        self._ensure_bucket()

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)
            logger.info(f"创建 bucket: {self.bucket}")

    def upload_snapshot(self, image: Image.Image, object_name: str) -> str:
        """上传一张关键帧照片，返回 MinIO object key。"""
        buf = BytesIO()
        image.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        self.client.put_object(
            self.bucket, object_name, buf,
            length=buf.getbuffer().nbytes,
            content_type="image/jpeg",
        )
        return object_name

    def upload_video(self, video_path: str | Path, object_name: str) -> str:
        """上传违纪视频片段。"""
        self.client.fput_object(self.bucket, object_name, str(video_path), content_type="video/mp4")
        return object_name
