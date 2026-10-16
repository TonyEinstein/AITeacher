# ============================================================
# AI Teacher 一键停止（开发环境）
# 依次停止：前端 -> 后端 -> Docker 容器（保留容器与数据，下次 start 秒启）
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1
# 或双击 scripts\一键停止.bat
# ============================================================
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ComposeFile = Join-Path $Root "infra\docker\docker-compose.yml"

function Say($msg, $color = "Cyan") { Write-Host $msg -ForegroundColor $color }

Say "========================================"
Say "  AI Teacher 一键停止"
Say "========================================"

# ---------- 1. 前端 (5175 uni-app H5：管理后台 + 官网) ----------
Say "[1/3] 停止前端 (5175 uni-app H5)..."
foreach ($port in 5175) {
    $fe = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($fe) { $fe | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Say "  端口 $port 已停止。" "Green" }
    else { Say "  端口 $port 未在运行。" "Gray" }
}

# ---------- 2. 后端 (3000) ----------
Say "[2/3] 停止后端 (3000)..."
$be = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($be) { $be | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Say "  后端已停止。" "Green" }
else { Say "  后端未在运行。" "Gray" }

Start-Sleep -Seconds 2

# 兜底：若仍有 node 进程监听这些端口（如 vite 子进程），按端口再杀一次
foreach ($port in 3000, 5175) {
    $left = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($left) { $left | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
}

# ---------- 3. Docker 容器 ----------
Say "[3/3] 停止 Docker 容器 (postgres / redis / minio / srs)..."
Set-Location (Split-Path -Parent $ComposeFile)
docker compose -f $ComposeFile stop
if ($LASTEXITCODE -ne 0) { Say "警告：docker compose stop 返回异常，请检查 Docker 是否在运行" "Yellow" }

# ---------- 4. 汇总 ----------
Say ""
Say "========================================" "Cyan"
Say "  停止完成" "Green"
Say "========================================" "Cyan"
$p3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$p5175 = Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
Say ("  后端 3000 : " + $(if($p3000){'仍占用!'}else{'已停止'}))
Say ("  前端 5175 : " + $(if($p5175){'仍占用!'}else{'已停止'}))
Say "  容器与数据已保留，下次启动运行 .\scripts\start-all.ps1 即可"
Say "========================================" "Cyan"
