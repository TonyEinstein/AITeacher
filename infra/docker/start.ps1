# ============================================================
# AI Teacher 开发环境 — 启动脚本
# 优先使用 start（不重建容器），容器不存在时才 up -d
# 用法: .\start.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$composeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $composeDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Teacher 开发环境启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查容器是否已存在（用 postgres 作为判断依据）
$existing = docker ps -a --filter "name=ai-teacher-postgres" --format "{{.Names}}" 2>$null

if ($existing -contains "ai-teacher-postgres") {
    Write-Host "[检测到已有容器，使用 start 启动（不重建）]" -ForegroundColor Green
    docker compose start
} else {
    Write-Host "[容器不存在，首次使用 up -d 创建并启动]" -ForegroundColor Yellow
    docker compose up -d
}

Write-Host ""
Write-Host "等待服务健康检查..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 显示状态
Write-Host ""
Write-Host "当前容器状态:" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "启动完成。如需停止请运行 .\stop.ps1" -ForegroundColor Green
