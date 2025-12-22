@echo off
echo [ULTRA OS] Building all components...
echo.

echo 1. Building Backend...
cd src\backend
if exist .venv (
    .venv\Scripts\python -m pip install -r requirements.txt --quiet
) else (
    echo Creating virtual environment...
    python -m venv .venv
    .venv\Scripts\python -m pip install -r requirements.txt --quiet
)
cd ..\..

echo.
echo 2. Building Frontend...
cd src\frontend
call npm install --silent
call npm run build
cd ..\..

echo.
echo 3. Building Electron...
call npm run build:electron

echo.
echo 4. Building Audio Streaming Service (C#)...
cd audio-streaming-service
    echo Cleaning previous build...
    if exist bin\Release\net8.0-windows\win-x64\publish rmdir /s /q bin\Release\net8.0-windows\win-x64\publish
    echo Publishing service...
    call dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=false --output bin\Release\net8.0-windows\win-x64\publish --verbosity quiet
cd ..

echo.
echo [ULTRA OS] Build complete!
echo All components are ready to run.




