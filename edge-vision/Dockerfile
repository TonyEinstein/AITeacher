# AI Teacher 边缘视觉感知端 Dockerfile
# 部署到教室 AI 盒子（带 NVIDIA GPU）

FROM nvidia/cuda:12.6.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.10 python3-pip libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY configs/ ./configs/
COPY scripts/ ./scripts/

ENV PYTHONUNBUFFERED=1

CMD ["python3", "src/main.py", "--source", "rtsp://127.0.0.1:8554/stream"]
