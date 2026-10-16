# AI Teacher 一键健康检查
# 用法: .\scripts\health-check.ps1

Write-Host "===== AI Teacher 健康检查 =====" -ForegroundColor Cyan

# 1. Docker 容器
Write-Host "`n[1] Docker 容器..." -ForegroundColor Yellow
$containers = @("ai-teacher-postgres", "ai-teacher-redis", "ai-teacher-srs")
foreach ($c in $containers) {
    $status = docker inspect --format='{{.State.Status}}' $c 2>$null
    if ($status -eq "running") {
        Write-Host "  ✓ $c running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $c $status" -ForegroundColor Red
    }
}

# 2. 后端 API
Write-Host "`n[2] 后端 API..." -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/health" -TimeoutSec 3
    Write-Host "  ✓ 后端在线: $($resp | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 后端未响应: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 数据库
Write-Host "`n[3] 数据库连接..." -ForegroundColor Yellow
try {
    $result = docker exec ai-teacher-postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ PostgreSQL 就绪" -ForegroundColor Green
    } else {
        Write-Host "  ✗ PostgreSQL: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ 无法连接 Postgres 容器" -ForegroundColor Red
}

# 4. Redis
Write-Host "`n[4] Redis..." -ForegroundColor Yellow
try {
    $result = docker exec ai-teacher-redis redis-cli ping 2>&1
    if ($result -match "PONG") {
        Write-Host "  ✓ Redis 响应 PONG" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Redis: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ 无法连接 Redis" -ForegroundColor Red
}

# 5. 视觉事件 API
Write-Host "`n[5] 视觉事件 API..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/v1/vision/lessons/1/events" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "  ✓ Vision API 可访问 (HTTP $($resp.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Vision API: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "`n===== 检查完成 =====" -ForegroundColor Cyan
