@echo off
rem ============================================
rem  AI Teacher 一键启动 (双击运行)
rem ============================================
title AI Teacher - Start
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
echo.
echo [Done] Press any key to close...
pause >nul
