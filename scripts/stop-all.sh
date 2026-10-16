#!/usr/bin/env bash
# ============================================================
# AI Teacher 一键停止（Linux / macOS）
# 依次停止: 前端 -> 后端 -> Docker 容器（保留容器与数据，下次秒启）
# 用法: bash scripts/stop-all.sh    或    ./scripts/stop-all.sh
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.yml"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/apps/mobile"

say() { printf "\033[1;36m%s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m%s\033[0m\n" "$*"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "$*"; }

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

# 递归杀掉 pid 及其全部子进程（防 npm 父进程被杀后 vite 子进程残留占端口）
kill_pid_tree() {
  local pid=$1 children
  [ -n "$pid" ] || return
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for c in $children; do kill_pid_tree "$c"; done
  kill "$pid" >/dev/null 2>&1 || true
}

say "========================================"
say "  AI Teacher 一键停止 (Linux)"
say "========================================"

# ---------- 1. 前端 (5175) ----------
say "[1/3] 停止前端 (5175)..."
kill_port 5175
kill_pid_tree "$(cat "$FRONTEND_DIR/logs/vite.pid" 2>/dev/null)"
ok "  前端已停止。"

# ---------- 2. 后端 (3000) ----------
say "[2/3] 停止后端 (3000)..."
kill_port 3000
kill_pid_tree "$(cat "$BACKEND_DIR/logs/server.pid" 2>/dev/null)"
ok "  后端已停止。"

sleep 2

# ---------- 3. Docker 容器 ----------
say "[3/3] 停止 Docker 容器 (postgres / redis / minio / srs)..."
(cd "$(dirname "$COMPOSE_FILE")" && docker compose -f "$COMPOSE_FILE" stop) || warn "警告：docker compose stop 返回异常，请检查 Docker 是否在运行"

# ---------- 4. 汇总 ----------
say ""
say "========================================"
ok "  停止完成"
say "========================================"
if command -v lsof >/dev/null 2>&1; then
  if [ -n "$(lsof -ti:3000 2>/dev/null)" ]; then say "  后端 3000 : 仍占用!"; else ok "  后端 3000 : 已停止"; fi
  if [ -n "$(lsof -ti:5175 2>/dev/null)" ]; then say "  前端 5175 : 仍占用!"; else ok "  前端 5175 : 已停止"; fi
fi
say "  容器与数据已保留，下次启动运行 bash scripts/start-all.sh 即可"
say "========================================"
