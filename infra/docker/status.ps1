# ============================================================
# AI Teacher 开发环境 — 状态查看脚本
# 用法: .\status.ps1
# ============================================================

$composeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $composeDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Teacher 开发环境状态" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

docker compose ps

Write-Host ""
Write-Host "数据卷:" -ForegroundColor Cyan
docker volume ls --filter "name=ai-tutor" --format "table {{.Name}}\t{{.Driver}}"

Write-Host ""
Write-Host "提示: 启动用 .\start.ps1，停止用 .\stop.ps1" -ForegroundColor Gray
