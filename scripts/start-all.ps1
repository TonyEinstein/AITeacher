# ============================================================
# AI Teacher 一键启动（开发环境）
# 依次启动：Docker 容器(postgres/redis/minio/srs) -> 后端 -> 前端
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
# 或双击 scripts\一键启动.bat
# ============================================================
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ComposeFile = Join-Path $Root "infra\docker\docker-compose.yml"
$BackendDir  = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "apps\mobile"

function Say($msg, $color = "Cyan") { Write-Host $msg -ForegroundColor $color }

Say "========================================"
Say "  AI Teacher 一键启动"
Say "========================================"

# ---------- 0. 前置检查 ----------
Say "[1/4] 检查依赖环境..." "Yellow"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Say "错误：未找到 node，请先安装 Node.js >= 20" "Red"; exit 1 }
$npm  = Get-Command npm  -ErrorAction SilentlyContinue
if (-not $npm)  { Say "错误：未找到 npm，请先安装 Node.js" "Red"; exit 1 }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Say "错误：Docker 未运行，请先启动 Docker Desktop" "Red"; exit 1 }
Say "node 可用，Docker 可用。" "Green"

# ---------- 1. Docker 容器 ----------
Say "[2/4] 启动 Docker 容器 (postgres / redis / srs / minio)..."
Set-Location (Split-Path -Parent $ComposeFile)

# 核心服务（镜像已本地存在，秒启）；minio 单独处理，镜像缺失时拉取失败不阻塞整体
docker compose -f $ComposeFile up -d postgres redis srs
if ($LASTEXITCODE -ne 0) { Say "错误：核心容器(postgres/redis/srs)启动失败，请查看上方日志" "Red"; exit 1 }

# minio：本地有镜像则直接启动；没有则尝试拉取，失败只告警不退出
$minioImage = docker images -q minio/minio:latest 2>$null
if ($minioImage) {
    docker compose -f $ComposeFile up -d minio
} else {
    Say "MinIO 镜像本地不存在，尝试拉取..." "Yellow"
    docker compose -f $ComposeFile pull minio
    if ($LASTEXITCODE -ne 0) {
        Say "警告：MinIO 镜像拉取失败（镜像源繁忙）。文件上传功能暂不可用，其余服务不受影响。" "Yellow"
    } else {
        docker compose -f $ComposeFile up -d minio
    }
}

Say "等待数据库健康检查..."
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
    $h = docker inspect -f "{{.State.Health.Status}}" ai-teacher-postgres 2>$null
    if ($h -eq "healthy") { $ok = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ok) { Say "警告：等待数据库健康超时，继续尝试启动后端（可能稍后自愈）" "Yellow" }
else { Say "数据库健康。" "Green" }

# ---------- 2. 后端 ----------
Say "[3/4] 启动后端 (http://127.0.0.1:3000)..."
Set-Location $BackendDir

# 清理占用 3000 的旧进程
$old = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($old) { $old | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1 }

# 依赖/构建检查
if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) {
    Say "首次运行：安装后端依赖 (npm install)..." "Yellow"
    npm install
}
if (-not (Test-Path (Join-Path $BackendDir "dist\main.js"))) {
    Say "首次运行：编译后端 (npm run build)..." "Yellow"
    npm run build
}

# 从 .env 读取环境变量（逐行去引号）
$envFile = Join-Path $BackendDir ".env"
if (-not (Test-Path $envFile)) { Say "错误：缺少 backend\.env" "Red"; exit 1 }
foreach ($l in (Get-Content $envFile -Encoding UTF8)) {
    if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $key = $matches[1].Trim(); $val = $matches[2].Trim()
        if ($val.Length -ge 2 -and $val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
        [Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
}

$be = Start-Process -FilePath "node" -ArgumentList "dist/main.js" -WorkingDirectory $BackendDir -WindowStyle Hidden `
     -RedirectStandardOutput (Join-Path $BackendDir "logs\server.log") `
     -RedirectStandardError  (Join-Path $BackendDir "logs\server.err.log") -PassThru
Say ("后端进程 PID=" + $be.Id)

$beUp = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try { $r = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/health" -TimeoutSec 2; if ($r.data.status -eq "healthy") { $beUp = $true; break } } catch {}
}
if ($beUp) { Say "后端启动成功 (healthy)。" "Green" }
else {
    Say "后端启动异常，日志尾部：" "Red"
    Get-Content (Join-Path $BackendDir "logs\server.err.log") -Tail 15 -ErrorAction SilentlyContinue
    exit 1
}

# ---------- 3. 前端（uni-app H5：管理后台 + 官网同一产物） ----------
Say "[4/4] 启动前端 (http://localhost:5175)..."
Set-Location $FrontendDir

$old5175 = Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if ($old5175) { $old5175 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1 }

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Say "首次运行：安装前端依赖 (npm install)..." "Yellow"
    npm install
}

New-Item -ItemType Directory -Force (Join-Path $FrontendDir "logs") | Out-Null
$fe = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev:h5" -WorkingDirectory $FrontendDir -WindowStyle Hidden `
     -RedirectStandardOutput (Join-Path $FrontendDir "logs\dev-h5.log") `
     -RedirectStandardError  (Join-Path $FrontendDir "logs\dev-h5.err.log") -PassThru
Say ("前端进程 PID=" + $fe.Id)

$feUp = $false
# uni-app H5 首次编译较慢，轮询上限放宽到 90 秒
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    try { $r = Invoke-WebRequest -Uri "http://localhost:5175" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $feUp = $true; break } } catch {}
}
if ($feUp) { Say "前端启动成功。" "Green" } else { Say "前端启动较慢，请稍后手动刷新 http://localhost:5175 确认" "Yellow" }

# ---------- 4. 汇总 ----------
Say ""
Say "========================================" "Cyan"
Say " 全部启动完成！" "Green"
Say "========================================" "Cyan"
Say "  前端（管理后台 + 官网）: http://localhost:5175"
Say "  API      : http://127.0.0.1:3000/api/v1"
Say "  API 文档 : http://127.0.0.1:3000/api/docs"
$minioRunning = docker ps --filter "name=ai-teacher-minio" --format "{{.Names}}" 2>$null
if ($minioRunning) { Say "  MinIO    : http://localhost:9001 (minioadmin/minioadmin123)" }
Say ("  Docker   : postgres(5432) redis(6379)" + $(if($minioRunning){' minio(9000/9001)'}else{''}) + " srs(1935/8080/1985)")
Say "  演示账号 : superadmin / GZ001_admin / GZ001_grade1 / GZ001_math，密码均 123456"
Say "  停止服务 : 运行 .\scripts\stop-all.ps1 或双击 scripts\一键停止.bat"
Say "========================================" "Cyan"
