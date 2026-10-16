@echo off
rem ============================================
rem  AI Teacher 一键停止 (双击运行)
rem ============================================
title AI Teacher - Stop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"
echo.
echo [Done] Press any key to close...
pause >nul
