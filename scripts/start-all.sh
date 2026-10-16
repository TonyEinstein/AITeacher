#!/usr/bin/env bash
# ============================================================
# AI Teacher 一键启动（Linux / macOS）
# 依次启动: Docker 容器(postgres/redis/minio/srs) -> 后端 -> 前端
# 用法: bash scripts/start-all.sh    或    ./scripts/start-all.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.yml"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/apps/mobile"

say() { printf "\033[1;36m%s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m%s\033[0m\n" "$*"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "$*"; }
err() { printf "\033[1;31m%s\033[0m\n" "$*"; }

# 按端口杀进程（fuser 优先，回退 lsof，再回退 ss）
kill_port() {
  local port=$1 pid
  if command -v fuser >/dev/null 2>&1; then fuser -k "${port}/tcp" >/dev/null 2>&1 || true; fi
  if command -v lsof >/dev/null 2>&1; then
    pid=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then kill $pid >/dev/null 2>&1 || true; fi
  elif command -v ss >/dev/null 2>&1; then
    pid=$(ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
    if [ -n "$pid" ]; then kill $pid >/dev/null 2>&1 || true; fi
  fi
  sleep 1
}

say "========================================"
say "  AI Teacher 一键启动 (Linux)"
say "========================================"

# ---------- 0. 前置检查 ----------
say "[1/4] 检查依赖环境..."
command -v node >/dev/null 2>&1 || { err "错误：未找到 node，请先安装 Node.js >= 20"; exit 1; }
command -v npm  >/dev/null 2>&1 || { err "错误：未找到 npm，请先安装 Node.js"; exit 1; }
docker info >/dev/null 2>&1 || { err "错误：Docker 未运行，请先启动 Docker"; exit 1; }
ok "node / npm / docker 可用"

# ---------- 1. Docker 容器 ----------
say "[2/4] 启动 Docker 容器 (postgres / redis / srs / minio)..."
(cd "$(dirname "$COMPOSE_FILE")" && docker compose -f "$COMPOSE_FILE" up -d postgres redis srs) \
  || { err "错误：核心容器(postgres/redis/srs)启动失败，请查看上方日志"; exit 1; }

# minio：本地有镜像直接启动；没有则尝试拉取，失败只告警不退出
if docker images -q minio/minio:latest >/dev/null 2>&1; then
  (cd "$(dirname "$COMPOSE_FILE")" && docker compose -f "$COMPOSE_FILE" up -d minio) || warn "警告：MinIO 启动失败"
else
  warn "MinIO 镜像本地不存在，尝试拉取..."
  if (cd "$(dirname "$COMPOSE_FILE")" && docker compose -f "$COMPOSE_FILE" pull minio); then
    (cd "$(dirname "$COMPOSE_FILE")" && docker compose -f "$COMPOSE_FILE" up -d minio) || warn "警告：MinIO 启动失败"
  else
    warn "警告：MinIO 镜像拉取失败（镜像源繁忙）。文件上传功能暂不可用，其余服务不受影响。"
  fi
fi

say "等待数据库健康检查..."
DB_OK=0
for i in $(seq 1 90); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' ai-teacher-postgres 2>/dev/null)" = "healthy" ]; then DB_OK=1; break; fi
  sleep 1
done
[ "$DB_OK" = "1" ] && ok "数据库健康。" || warn "警告：等待数据库健康超时，继续尝试启动后端"

# ---------- 2. 后端 ----------
say "[3/4] 启动后端 (http://127.0.0.1:3000)..."
kill_port 3000

[ -d "$BACKEND_DIR/node_modules" ] || { warn "首次运行：安装后端依赖 (npm install)..."; (cd "$BACKEND_DIR" && npm install); }
[ -f "$BACKEND_DIR/dist/main.js" ] || { warn "首次运行：编译后端 (npm run build)..."; (cd "$BACKEND_DIR" && npm run build); }

# 从 .env 加载环境变量（兼容 KEY="value" 与 KEY=value；去除 CR 以防 Windows 编辑残留）
set -a
# shellcheck disable=SC1091
source <(sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*/\1=/' "$BACKEND_DIR/.env" | tr -d '\r')
set +a

(cd "$BACKEND_DIR" && { nohup node dist/main.js > logs/server.log 2> logs/server.err.log & echo $! > logs/server.pid; })
ok "后端进程 PID=$(cat "$BACKEND_DIR/logs/server.pid")"

BE_UP=0
for i in $(seq 1 30); do
  sleep 1
  if curl -sf -m 2 http://127.0.0.1:3000/api/v1/health | grep -q healthy; then BE_UP=1; break; fi
done
if [ "$BE_UP" = "1" ]; then
  ok "后端启动成功 (healthy)。"
else
  err "后端启动异常，日志尾部："
  tail -n 15 "$BACKEND_DIR/logs/server.err.log" 2>/dev/null || true
  exit 1
fi

# ---------- 3. 前端 ----------
say "[4/4] 启动前端 (http://localhost:5175)..."
kill_port 5175

[ -d "$FRONTEND_DIR/node_modules" ] || { warn "首次运行：安装前端依赖 (npm install)..."; (cd "$FRONTEND_DIR" && npm install); }
mkdir -p "$FRONTEND_DIR/logs"
(cd "$FRONTEND_DIR" && { nohup npm run dev:h5 > logs/dev-h5.log 2> logs/dev-h5.err.log & echo $! > logs/vite.pid; })
ok "前端进程 PID=$(cat "$FRONTEND_DIR/logs/vite.pid")"

FE_UP=0
for i in $(seq 1 90); do
  sleep 1
  if curl -sf -m 2 -o /dev/null http://localhost:5175; then FE_UP=1; break; fi
done
[ "$FE_UP" = "1" ] && ok "前端启动成功。" || warn "前端启动较慢，请稍后刷新 http://localhost:5175 确认"

# ---------- 4. 汇总 ----------
say ""
say "========================================"
ok " 全部启动完成！"
say "========================================"
say "  前端（管理后台 + 官网）: http://localhost:5175"
say "  API      : http://127.0.0.1:3000/api/v1"
say "  API 文档 : http://127.0.0.1:3000/api/docs"
if docker ps --filter "name=ai-teacher-minio" --format "{{.Names}}" | grep -q .; then
  say "  MinIO    : http://localhost:9001 (minioadmin/minioadmin123)"
fi
say "  Docker   : postgres(5432) redis(6379) srs(1935/8080/1985)"
say "  演示账号 : superadmin / GZ001_admin / GZ001_grade1 / GZ001_math，密码均 123456"
say "  停止服务 : bash scripts/stop-all.sh"
say "========================================"
