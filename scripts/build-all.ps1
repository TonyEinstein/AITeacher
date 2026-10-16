# ============================================================
# AI Teacher 一键多端构建
# 串联：uni-app 三端（H5 / 微信小程序 / App 资源）→ Tauri 桌面安装包
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1
#       加 -SkipDesktop 只构建 uni-app 三端（跳过 Tauri，速度快）
# ============================================================
param(
    [switch]$SkipDesktop
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Say($msg, $color = "Cyan") { Write-Host $msg -ForegroundColor $color }
function Step($n, $total, $msg) { Say ("[{0}/{1}] {2}" -f $n, $total, $msg) }

$total = if ($SkipDesktop) { 2 } else { 3 }
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Say "========== AI Teacher 一键多端构建 =========="

# ---------- 1. uni-app 三端 ----------
Step 1 $total "uni-app 三端（H5 / mp-weixin / app）"
& (Join-Path $PSScriptRoot "build-mobile.ps1")

# ---------- 2. 校验 uni-app 产物 ----------
# 注意：以「产物是否存在」为判定依据，而非 build-mobile.ps1 的退出码 ——
# uni-ui 的 sass darken() 弃用警告会让内层 npm 以非零码退出，但产物完整。
Step 2 $total "校验 uni-app 产物"
$mobileDist = Join-Path $Root "apps\mobile\dist\build"
$expect = @(
    "h5\index.html",
    "mp-weixin\app.json",
    "app\manifest.json"
)
foreach ($e in $expect) {
    $p = Join-Path $mobileDist $e
    if (-not (Test-Path $p)) { Say "缺少产物: $e" "Red"; exit 1 }
    Say ("  ok  " + $e) "Green"
}

# ---------- 3. Tauri 桌面（可选） ----------
if ($SkipDesktop) {
    Say "已跳过桌面端（-SkipDesktop）" "Yellow"
} else {
    Step 3 $total "Tauri 桌面安装包（NSIS）"
    & (Join-Path $PSScriptRoot "build-desktop.ps1")
    if ($LASTEXITCODE -ne 0) { Say "桌面端构建失败" "Red"; exit 1 }
}

$sw.Stop()
Say ""
Say "========================================" "Cyan"
Say (" 全部构建完成，用时 {0:N1} 分钟" -f $sw.Elapsed.TotalMinutes) "Green"
Say "========================================" "Cyan"
Say "  H5       : apps\mobile\dist\build\h5"
Say "  微信小程序 : apps\mobile\dist\build\mp-weixin（微信开发者工具导入）"
Say "  App 资源  : apps\mobile\dist\build\app（HBuilderX 导入或云打包）"
if (-not $SkipDesktop) {
    Say "  桌面安装包 : apps\desktop\src-tauri\target\release\bundle\nsis"
}