#!/usr/bin/env bash
# ============================================================
# AI Teacher 教室盒子 OTA 升级脚本（树莓派）
# 由后端 OTA 接口触发或盒子定时拉取
# 流程：检查版本 → 下载升级包 → 校验 → 备份 → 部署 → 重启服务 → 健康检查 → 失败回滚
# ============================================================
set -euo pipefail

INSTALL_DIR=/opt/ait-teacher
BACKUP_DIR=/opt/ait-teacher.bak
BASE_URL="${1:?用法: ota-update.sh <后端基础URL>}"
SERIAL="$(cat /etc/ait-teacher/serial 2>/dev/null || echo unknown)"

echo "[OTA] 设备序列号: $SERIAL"

# 1. 查询最新版本
LATEST=$(curl -fsS "$BASE_URL/api/v1/boxes/ota/latest?serial=$SERIAL")
VERSION=$(echo "$LATEST" | python3 -c "import sys,json;print(json.load(sys.stdin).get('version',''))" 2>/dev/null || echo "")
PKG_URL=$(echo "$LATEST" | python3 -c "import sys,json;print(json.load(sys.stdin).get('packageUrl',''))" 2>/dev/null || echo "")
CHECKSUM=$(echo "$LATEST" | python3 -c "import sys,json;print(json.load(sys.stdin).get('checksum',''))" 2>/dev/null || echo "")

if [ -z "$VERSION" ] || [ -z "$PKG_URL" ]; then
  echo "[OTA] 暂无可用更新"; exit 0
fi

echo "[OTA] 开始升级到版本: $VERSION"
cd /tmp
curl -fsS -o ait-update.tar.gz "$PKG_URL"

# 2. 校验 SHA256
if [ -n "$CHECKSUM" ]; then
  ACTUAL=$(sha256sum ait-update.tar.gz | awk '{print $1}')
  if [ "$ACTUAL" != "$CHECKSUM" ]; then
    echo "[OTA] 校验失败，中止升级"; rm -f ait-update.tar.gz; exit 1
  fi
fi

# 3. 备份当前版本
echo "[OTA] 备份当前版本..."
sudo rm -rf "$BACKUP_DIR"
sudo cp -a "$INSTALL_DIR" "$BACKUP_DIR"

# 4. 部署新版本
echo "[OTA] 部署新版本..."
sudo mkdir -p "$INSTALL_DIR"
sudo tar -xzf ait-update.tar.gz -C "$INSTALL_DIR"
cd "$INSTALL_DIR/classroom-client" && npm install --omit=dev --legacy-peer-deps || true
cd "$INSTALL_DIR/vision-service" && /opt/ait-teacher/venv/bin/pip install -r requirements.txt || true
echo "$VERSION" | sudo tee /etc/ait-teacher/version >/dev/null

# 5. 重启服务
echo "[OTA] 重启服务..."
sudo systemctl restart ait-vision ait-classroom
sleep 10

# 6. 健康检查，失败则回滚
if systemctl is-active --quiet ait-vision && systemctl is-active --quiet ait-classroom; then
  echo "[OTA] 升级成功: $VERSION"
  curl -fsS -X POST "$BASE_URL/api/v1/boxes/ota/report" -H "Content-Type: application/json" \
    -d "{\"serial\":\"$SERIAL\",\"version\":\"$VERSION\",\"status\":\"success\"}" || true
  rm -f /tmp/ait-update.tar.gz
else
  echo "[OTA] 健康检查失败，回滚到上一版本..."
  sudo rm -rf "$INSTALL_DIR"
  sudo cp -a "$BACKUP_DIR" "$INSTALL_DIR"
  sudo systemctl restart ait-vision ait-classroom
  curl -fsS -X POST "$BASE_URL/api/v1/boxes/ota/report" -H "Content-Type: application/json" \
    -d "{\"serial\":\"$SERIAL\",\"version\":\"$VERSION\",\"status\":\"rolled_back\"}" || true
  exit 1
fi
