
@echo off
echo [DEBUG] Simulating Backend Startup...
cd src\backend
if not exist .venv (
    echo [ERROR] .venv missing!
    exit /b 1
)

echo [DEBUG] Setting PATH...
set "PATH=C:\Users\rdias\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin;%PATH%"

echo [DEBUG] Launching run_backend.py...
:: Run without START to capture output directly in this shell context for logging
.venv\Scripts\python run_backend.py > ..\..\backend_startup_debug.log 2>&1
