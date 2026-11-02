@echo off
chcp 65001 >nul
title Modulwerk (Academic Workspace)
cd /d "%~dp0"

echo ==========================================================
echo   Modulwerk - Academic Workspace ^& Exercise Tracker
echo   Starting server...
echo ==========================================================
echo.

:: 1. Check if python is in PATH and working
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    python -c "import sys; sys.exit(0 if sys.version_info >= (3, 6) else 1)" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        python .tracker\tracker_server.py
        goto :eof
    )
)

:: 2. Fallback to Windows built-in PowerShell engine
powershell -NoProfile -ExecutionPolicy Bypass -File ".tracker\tracker_server.ps1"

pause
