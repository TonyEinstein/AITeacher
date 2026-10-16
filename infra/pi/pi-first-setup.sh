#!/usr/bin/env bash
# ============================================================
# AI Teacher 教室盒子首次部署脚本（树莓派 5 / Raspberry Pi OS 64位）
# 在预装镜像制作时运行，或在全新树莓派上运行一次
# ============================================================
set -euo pipefail

echo "===== 1. 系统依赖 ====="
sudo apt-get update
sudo apt-get install -y \
  nodejs npm \
  python3 python3-pip python3-venv \
  libgl1 libglib2.0-0 \
  portaudio19-dev \
  ffmpeg \
  network-manager \
  curl

echo "===== 2. 目录与运行环境 ====="
sudo mkdir -p /opt/ait-teacher /etc/ait-teacher
python3 -m venv /opt/ait-teacher/venv

# 视觉服务 Python 依赖（树莓派 ARM64）
/opt/ait-teacher/venv/bin/pip install --upgrade pip
/opt/ait-teacher/venv/bin/pip install \
  opencv-python-headless numpy websocket-client sounddevice \
  mediapipe || echo "mediapipe 安装失败将使用降级检测"
# face_recognition 依赖 dlib，编译较慢；预装镜像中已编译好
/opt/ait-teacher/venv/bin/pip install face_recognition || echo "face_recognition 未就绪，人脸将使用占位识别"

echo "===== 3. 注册系统服务 ====="
sudo cp infra/pi/ait-vision.service /etc/systemd/system/
sudo cp infra/pi/ait-classroom.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ait-vision ait-classroom

echo "===== 4. 网络双链路（eth0 有线主 / usb0 4G 备）====="
# 主链路默认路由走有线；4G 模块（移远 EC20）通过 NetworkManager 管理，metric 设高作为备用
nmcli connection modify "Wired connection 1" ipv4.route-metric 100 2>/dev/null || true

echo "===== 5. 写入设备序列号（首次启动由后端注册接口分配）====="
if [ ! -f /etc/ait-teacher/serial ]; then
  read -p "请输入或扫描盒子序列号（留空自动生成）: " INPUT_SERIAL
  echo "${INPUT_SERIAL:-PI-$(cat /proc/cpuinfo | grep Serial | awk '{print $3}' | tail -c 9)}" | sudo tee /etc/ait-teacher/serial
fi

echo "===== 部署完成 ====="
echo "应用目录: /opt/ait-teacher"
echo "升级脚本: sudo bash infra/pi/ota-update.sh <后端URL>"
echo "服务状态: systemctl status ait-vision ait-classroom"
