@echo off
REM Start Audio Streaming Service (C#)
echo [4/5] Starting Audio Streaming Service (C#)...

REM Setup .NET Path
set "PATH=%PATH%;C:\Program Files\dotnet"
where dotnet >nul 2>&1
if errorlevel 1 (
    echo WARNING: .NET SDK not found. Installing...
    call "%~dp0install-dotnet.ps1"
    set "PATH=%PATH%;C:\Program Files\dotnet"
)

REM Load ENV vars
set "ENV_FILE=%~dp0..\src\backend\.env"
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1* delims==" %%A in ("%ENV_FILE%") do (
        if "%%A"=="ASSEMBLYAI_API_KEY" set "ASSEMBLYAI_API_KEY=%%~B"
    )
)

if defined ASSEMBLYAI_API_KEY (
    echo Found AssemblyAI Key in .env
) else (
    echo WARNING: src\backend\.env not found or key missing.
)

REM Build
echo Rebuilding C# Audio Service...
pushd "%~dp0..\audio-streaming-service"
dotnet build --configuration Release --verbosity quiet
if errorlevel 1 (
    echo ERROR: Failed to build C# service
    popd
    exit /b 1
)

REM Publish
echo Publishing C# Audio Service...
dotnet publish --configuration Release --runtime win-x64 --self-contained false --output bin\Release\net8.0-windows\win-x64\publish --verbosity quiet
if errorlevel 1 (
    echo ERROR: Failed to publish C# service
    popd
    exit /b 1
)

REM Run
if exist "bin\Release\net8.0-windows\win-x64\publish\AudioStreamingService.exe" (
    echo Using published executable...
    cd "bin\Release\net8.0-windows\win-x64\publish"
    start "Ultra Audio Streaming" /min cmd /k "AudioStreamingService.exe"
) else (
    echo WARNING: Published executable not found, using dotnet run...
    start "Ultra Audio Streaming" /min powershell -NoExit -ExecutionPolicy Bypass -File "run-service.ps1"
)

popd
exit /b 0
