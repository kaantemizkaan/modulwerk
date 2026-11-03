@echo off
chcp 65001 >nul
title Modulwerk (Academic Workspace)
cd /d "%~dp0"

echo ==========================================================
echo   Modulwerk - Academic Workspace ^& Task Manager
echo   Starting local server...
echo ==========================================================
echo.

:: 1. Attempt to launch via Python standard-library engine (only if real Python 3 is functional)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 6) else 1)" 2>nul && (
    echo [OK] Python 3 detected. Launching cross-platform engine...
    python .tracker\tracker_server.py
    exit /b
)

:: 2. Fallback to Windows built-in PowerShell micro-server
echo [*] Launching via Windows PowerShell engine...
powershell -NoProfile -ExecutionPolicy Bypass -File ".tracker\tracker_server.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to start Modulwerk server.
    echo Please make sure either Python 3 or Windows PowerShell is available.
    echo.
    pause
)
