# ============================================================
# AI Teacher 移动端一键构建（uni-app 三端产物）
# 产物：dist/build/h5 · dist/build/mp-weixin · dist/build/app
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\build-mobile.ps1
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MobileDir = Join-Path $Root "apps\mobile"
Set-Location $MobileDir

function Say($msg, $color = "Cyan") { Write-Host $msg -ForegroundColor $color }

Say "========== AI Teacher 移动端一键构建 =========="

Say "[1/3] 构建 H5 ..."
npm run build:h5
if ($LASTEXITCODE -ne 0) { Say "H5 构建失败" "Red"; exit 1 }

Say "[2/3] 构建微信小程序 ..."
npm run build:mp-weixin
if ($LASTEXITCODE -ne 0) { Say "小程序构建失败" "Red"; exit 1 }

Say "[3/3] 构建 App 资源 ..."
npx uni build -p app
if ($LASTEXITCODE -ne 0) { Say "App 构建失败" "Red"; exit 1 }

Say "三端构建完成：" "Green"
Say "  H5       : $MobileDir\dist\build\h5"
Say "  小程序   : $MobileDir\dist\build\mp-weixin（微信开发者工具导入）"
Say "  App 资源 : $MobileDir\dist\build\app（HBuilderX 导入或云打包）"
