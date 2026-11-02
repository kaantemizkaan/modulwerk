@echo off
chcp 65001 >nul
title Modulwerk LMU Muenchen (WS 2026/27)
cd /d "%~dp0"

echo ==========================================================
echo   Modulwerk - LMU Muenchen
echo   B.Sc. Informatik ^& Statistik (WS 2026/27)
echo   Akademischer Workspace ^& Tracker wird gestartet...
echo ==========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File ".tracker\tracker_server.ps1"

pause
