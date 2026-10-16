# ============================================================
# AI Teacher 开发环境 — 重建容器脚本
# 【危险操作】仅在大版本/功能版本变动、容器配置大改时使用
# 日常启停请用 .\start.ps1 / .\stop.ps1
# 用法: .\rebuild.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$composeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $composeDir

Write-Host "========================================" -ForegroundColor Red
Write-Host "  AI Teacher 容器重建" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "警告: 此操作会删除所有容器并重新创建，耗时较长！" -ForegroundColor Red
Write-Host "数据卷(postgres/redis/minio)会保留，数据不会丢失。" -ForegroundColor Yellow
Write-Host ""

# 二次确认
$confirm = Read-Host "确认要重建容器吗？输入 YES 继续，其他任意键取消"
if ($confirm -ne "YES") {
    Write-Host "已取消，未做任何操作。" -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "[1/3] 停止并删除容器（保留数据卷）..." -ForegroundColor Yellow
docker compose down

Write-Host ""
Write-Host "[2/3] 重新创建并启动容器..." -ForegroundColor Yellow
docker compose up -d

Write-Host ""
Write-Host "[3/3] 等待服务健康检查..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "重建完成，当前状态:" -ForegroundColor Green
docker compose ps

Write-Host ""
Write-Host "如果数据库是新 volume，需重新初始化:" -ForegroundColor Cyan
Write-Host "  cd ..\..\backend" -ForegroundColor Gray
Write-Host "  npx prisma db push" -ForegroundColor Gray
Write-Host "  npx prisma db seed" -ForegroundColor Gray
