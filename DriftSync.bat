@echo off
REM --- DriftSync launcher: double-click to start the app on Windows ---
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" desktop_app.py
) else if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" desktop_app.py
) else (
    python desktop_app.py
)
if errorlevel 1 (
    echo.
    echo DriftSync stopped with an error.
    pause
)
