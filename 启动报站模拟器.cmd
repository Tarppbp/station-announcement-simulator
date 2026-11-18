@echo off
cd /d "%~dp0"
if exist "local-launch.cmd" (
  call "local-launch.cmd"
  exit /b
)
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" app.py
) else (
  python app.py
)
if errorlevel 1 pause
