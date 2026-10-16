# ============================================================
# AI Teacher 开发环境 — 停止脚本
# 仅 stop 容器，不删除容器和数据卷
# 用法: .\stop.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$composeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $composeDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Teacher 开发环境停止" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[正在停止容器（仅 stop，不删除）...]" -ForegroundColor Yellow
docker compose stop

Write-Host ""
Write-Host "容器已停止。数据和容器均保留，下次运行 .\start.ps1 即可快速启动。" -ForegroundColor Green
Write-Host ""
Write-Host "注意: 请勿使用 docker compose down，那会删除容器导致下次启动变慢。" -ForegroundColor Red
