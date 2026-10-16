# build-desktop.ps1 — 一键构建桌面端：先产出 uni-app H5，再用 Tauri 打包 NSIS 安装包
# 用法： powershell -ExecutionPolicy Bypass -File .\scripts\build-desktop.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "==> [1/2] 构建 uni-app H5 产物" -ForegroundColor Cyan
Push-Location (Join-Path $root "apps\mobile")
try {
    npm run build:h5
    if ($LASTEXITCODE -ne 0) { throw "H5 构建失败" }
    $h5Index = Join-Path $root "apps\mobile\dist\build\h5\index.html"
    if (-not (Test-Path $h5Index)) { throw "未找到 H5 产物 index.html" }
}
finally { Pop-Location }

Write-Host "==> [2/2] Tauri 打包（NSIS）" -ForegroundColor Cyan
# 若存在更新签名密钥则自动启用安装包签名（密钥不入库，位于用户目录）
$signKey = Join-Path $env:USERPROFILE ".tauri\aiteacher.key"
if (Test-Path $signKey) {
    $env:TAURI_SIGNING_PRIVATE_KEY = $signKey
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "aiteacher-update"
    }
    Write-Host "    已启用自动更新签名" -ForegroundColor DarkGray
}
Push-Location (Join-Path $root "apps\desktop")
try {
    & ".\node_modules\.bin\tauri.cmd" build
    if ($LASTEXITCODE -ne 0) { throw "Tauri 构建失败" }
}
finally { Pop-Location }

Write-Host "==> 桌面端构建完成，安装包位于 apps\desktop\src-tauri\target\release\bundle\nsis\" -ForegroundColor Green
