# Ultra Assistant - System Verification & Health Check
# "State of the Art" Diagnostic Tool

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$text)
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " $text" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$text)
    Write-Host " [OK] $text" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$text)
    Write-Host " [ERROR] $text" -ForegroundColor Red
}

function Write-Warning {
    param([string]$text)
    Write-Host " [WARN] $text" -ForegroundColor Yellow
}

function Test-PortIPv4 {
    param([int]$port)
    $tcpProperties = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties()
    $connections = $tcpProperties.GetActiveTcpListeners()
    $portExists = $connections | Where-Object { $_.Port -eq $port }
    return [bool]$portExists
}

Write-Header "ULTRA SYSTEM DIAGNOSTICS"

# 1. Environment Checks
Write-Host "Checking Environment..." -ForegroundColor White
if (Get-Command "dotnet" -ErrorAction SilentlyContinue) {
    $dotnetVer = dotnet --version
    Write-Success "DotNet SDK found: $dotnetVer"
} else {
    Write-ErrorMsg "DotNet SDK NOT found!"
}

if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pyVer = python --version 2>&1
    Write-Success "Python found: $pyVer"
} else {
    Write-ErrorMsg "Python NOT found!"
}

if (Get-Command "npm" -ErrorAction SilentlyContinue) {
    $npmVer = npm --version
    Write-Success "NPM found: $npmVer"
} else {
    Write-ErrorMsg "NPM NOT found!"
}

# 2. Port Checks
Write-Header "Checking Network Ports"

$ports = @{
    8000 = "Backend API"
    5999 = "Frontend"
    8001 = "Audio Service"
}

foreach ($port in $ports.Keys) {
    if (Test-PortIPv4 -port $port) {
        Write-Success "Port $port ($($ports[$port])) is OPEN (Service Running)"
    } else {
        Write-ErrorMsg "Port $port ($($ports[$port])) is CLOSED (Service NOT Running)"
        
        # Specific advice
        if ($port -eq 8001) {
            Write-Warning " -> Audio Service is down. Connection refused expected."
        }
    }
}

# 3. Process Checks
Write-Header "Checking Processes"

$procs =Get-Process | Where-Object { $_.ProcessName -match "python|node|AudioStreamingService" }
if ($procs) {
    foreach ($p in $procs) {
        Write-Host " Found Process: $($p.ProcessName) (ID: $($p.Id))" -ForegroundColor Gray
    }
} else {
    Write-Warning "No relevant processes found."
}

# 4. Audio Service Log Analysis
Write-Header "Analyzing Audio Service Logs"

$logPath = Join-Path $PWD "audio-streaming-service\service_startup.log"
if (Test-Path $logPath) {
    Write-Success "Log file found at: $logPath"
    Write-Host "--- Last 10 lines ---" -ForegroundColor Gray
    Get-Content $logPath -Tail 10
    Write-Host "---------------------" -ForegroundColor Gray
} else {
    Write-Warning "Log file NOT found ($logPath). Service may never have started."
}

# 5. Build & Run Test (Optional)
Write-Header "Diagnostic Conclusion"

if (-not (Test-PortIPv4 -port 8001)) {
    Write-ErrorMsg "CRITICAL: Audio Service is not listening on port 8001."
    Write-Host "Attempting to build and run Audio Service in diagnostic mode..." -ForegroundColor Yellow
    
    $svcPath = Join-Path $PWD "audio-streaming-service"
    Push-Location $svcPath
    try {
        dotnet build
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Build Successful."
            Write-Host "Try starting it manually with: cd audio-streaming-service; dotnet run" -ForegroundColor Cyan
        } else {
            Write-ErrorMsg "Build Failed!"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Success "System appears healthy."
}
