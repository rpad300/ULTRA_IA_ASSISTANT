@echo off
echo [ULTRA OS] ========================================
echo [ULTRA OS] ULTRA IA ASSISTANT - Startup Script
echo [ULTRA OS] ========================================
echo.

echo [ULTRA OS] Stopping existing services...
set PYTHONUTF8=1
REM Stop all related processes more aggressively
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM uvicorn.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
taskkill /F /IM AudioStreamingService.exe /T 2>nul
taskkill /F /IM dotnet.exe /T 2>nul
REM Also kill by window title to catch any remaining instances
taskkill /F /FI "WINDOWTITLE eq Ultra Backend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq Ultra Frontend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq Ultra Audio Streaming*" 2>nul
taskkill /F /FI "WINDOWTITLE eq Ultra Shell*" 2>nul
timeout /t 2 /nobreak >nul

REM Check if we should build/update first
if "%1"=="--build" (
    echo [ULTRA OS] Building all components first...
    call build_all.bat
    echo.
)

echo.
echo [ULTRA OS] Starting services...
echo.

echo [1/5] Starting Backend (Port 8000)...
cd src\backend
if not exist .venv (
    echo Creating Python virtual environment...
    python -m venv .venv
    .venv\Scripts\python -m pip install -r requirements.txt --quiet
)
set "PATH=C:\Users\rdias\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin;%PATH%"
start "Ultra Backend" /min cmd /k "cd /d %~dp0src\backend && .venv\Scripts\python run_backend.py"
cd ..\..

echo [2/5] Waiting for Backend to be ready...
"%~dp0src\backend\.venv\Scripts\python" "%~dp0scripts\wait_for_service.py" http://localhost:8000/api/health --timeout 90 --name "Ultra Backend"
if errorlevel 1 (
    echo [ULTRA OS] ERROR: Backend failed to start! Stopping...
    pause
    exit /b 1
)

echo [3/5] Starting Audio Streaming Service (C#)...
call "%~dp0scripts\start_audio_service.bat"

:audio_done

echo [4/5] Waiting for Audio Service to be ready...
"%~dp0src\backend\.venv\Scripts\python" "%~dp0scripts\wait_for_service.py" http://localhost:8001/api/audio-service/status --timeout 30 --name "Audio Service"

echo [5/5] Starting Frontend (Port 5999)...
set "PATH=C:\Program Files\nodejs;%PATH%"
start "Ultra Frontend" cmd /k "cd /d %~dp0src\frontend && npm run dev"

echo.
echo [ULTRA OS] Launching Electron Shell...
start "Ultra Shell" cmd /c "cd /d %~dp0 && npm run dev:electron"

echo.
echo [ULTRA OS] ========================================
echo [ULTRA OS] All systems started!
echo [ULTRA OS] ========================================
echo.
echo Services:
echo   - Backend:     http://localhost:8000
echo   - Frontend:    http://localhost:5999
echo   - Audio API:   http://localhost:8001/api/audio-service
REM echo   - Electron:    Opening automatically
echo.
echo Note: You can close this window, but keep service windows open.
echo To rebuild everything, run: ultra_start.bat --build
echo.
