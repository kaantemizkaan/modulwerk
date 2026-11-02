#!/usr/bin/env bash
# ========================================================
# Modulwerk - macOS & Linux Launcher
# Zero Dependencies · 100% Cross-Platform
# ========================================================
set -e

# Change directory to script folder
cd "$(dirname "$0")"

echo "=========================================================="
echo "  Modulwerk - Academic Workspace & Task Manager"
echo "  Starting local server..."
echo "=========================================================="
echo ""

# Prefer Python 3 (standard on macOS & Linux)
if command -v python3 &>/dev/null; then
    exec python3 .tracker/tracker_server.py
elif command -v python &>/dev/null; then
    exec python .tracker/tracker_server.py
elif command -v pwsh &>/dev/null; then
    exec pwsh -File .tracker/tracker_server.ps1
else
    echo "Error: Python 3 is required to run Modulwerk on macOS/Linux."
    echo "Please install Python from https://www.python.org/ or your package manager."
    exit 1
fi
