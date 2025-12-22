# Ultra Assistant - Iniciar Ambiente de Desenvolvimento
# Este script inicia backend, frontend e Electron simultaneamente

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ultra Assistant - Ambiente de Desenvolvimento" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se as dependências estão instaladas
function Test-Dependencies {
    $allOk = $true
    
    # Verificar Node.js
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Host "✗ Node.js não encontrado!" -ForegroundColor Red
        $allOk = $false
    }
    
    # Verificar Python
    if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
        Write-Host "✗ Python não encontrado!" -ForegroundColor Red
        $allOk = $false
    }
    
    # Verificar FFmpeg
    try {
        $null = ffmpeg -version 2>&1
    }
    catch {
        Write-Host "⚠ FFmpeg não encontrado (opcional para Electron)" -ForegroundColor Yellow
    }
    
    # Verificar .env
    if (-not (Test-Path "src/backend/.env")) {
        Write-Host "⚠ Arquivo src/backend/.env não encontrado!" -ForegroundColor Yellow
        Write-Host "  Crie um baseado em .env.example" -ForegroundColor Yellow
    }
    
    return $allOk
}

# Verificar dependências
if (-not (Test-Dependencies)) {
    Write-Host ""
    Write-Host "Execute primeiro: .\setup.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Iniciando serviços..." -ForegroundColor Cyan
Write-Host ""

# Verificar se concurrently está instalado
if (-not (Get-Command "npx" -ErrorAction SilentlyContinue)) {
    Write-Host "✗ npx não encontrado. Execute: npm install -g concurrently" -ForegroundColor Red
    exit 1
}

# Criar script de inicialização


Write-Host "Opções de inicialização:" -ForegroundColor Cyan
Write-Host "1. Iniciar tudo em processos separados (recomendado)" -ForegroundColor Yellow
Write-Host "2. Iniciar apenas Backend" -ForegroundColor Yellow
Write-Host "3. Iniciar apenas Frontend" -ForegroundColor Yellow
Write-Host "4. Iniciar apenas Electron" -ForegroundColor Yellow
Write-Host "5. Iniciar apenas Audio Streaming Service" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "Escolha uma opção (1-4)"

switch ($choice) {
    "1" {
        Write-Host "Iniciando todos os serviços..." -ForegroundColor Green
        
        # Terminal 1: Backend
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\src\backend'; if (Test-Path '.venv\Scripts\Activate.ps1') { & .venv\Scripts\Activate.ps1 }; Write-Host 'Backend iniciando na porta 8000...' -ForegroundColor Green; python main.py"
        
        # Terminal 2: Frontend
        Start-Sleep -Seconds 2
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\src\frontend'; Write-Host 'Frontend iniciando na porta 5999...' -ForegroundColor Green; npm run dev"
        
        # Terminal 3: Audio Streaming Service
        Start-Sleep -Seconds 2
        $audioServicePath = "audio-streaming-service\bin\Release\net8.0-windows\win-x64\publish\AudioStreamingService.exe"
        if (Test-Path $audioServicePath) {
            Start-Process $audioServicePath
            Write-Host "  - Audio Streaming Service: Executável iniciado" -ForegroundColor Cyan
        }
        else {
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\audio-streaming-service'; `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); Write-Host 'Audio Streaming Service iniciando...' -ForegroundColor Green; dotnet run"
            Write-Host "  - Audio Streaming Service: Iniciando via dotnet run" -ForegroundColor Cyan
        }
        
        # Terminal 4: Electron - DISABLED (User request)
        # Start-Sleep -Seconds 2
        # Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'Compilando Electron...' -ForegroundColor Green; npm run build:electron; Write-Host 'Electron iniciando...' -ForegroundColor Green; npm run dev:electron"
        
        Write-Host ""
        Write-Host "✓ Serviços iniciados em janelas separadas!" -ForegroundColor Green
        Write-Host "  - Backend: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "  - Frontend: http://localhost:5999" -ForegroundColor Cyan
        Write-Host "  - Audio Streaming: Ícone na bandeja do sistema" -ForegroundColor Cyan
        # Write-Host "  - Electron: será aberto automaticamente" -ForegroundColor Cyan
    }
    "2" {
        Write-Host "Iniciando Backend..." -ForegroundColor Green
        Push-Location "src/backend"
        if (Test-Path ".venv\Scripts\Activate.ps1") {
            & .venv\Scripts\Activate.ps1
        }
        python main.py
        Pop-Location
    }
    "3" {
        Write-Host "Iniciando Frontend..." -ForegroundColor Green
        Push-Location "src/frontend"
        npm run dev
        Pop-Location
    }
    "4" {
        Write-Host "Compilando e iniciando Electron..." -ForegroundColor Green
        npm run build:electron
        npm run dev:electron
    }
    "5" {
        Write-Host "Iniciando Audio Streaming Service..." -ForegroundColor Green
        $audioServicePath = "audio-streaming-service\bin\Release\net8.0-windows\win-x64\publish\AudioStreamingService.exe"
        if (Test-Path $audioServicePath) {
            Start-Process $audioServicePath
            Write-Host "✓ Audio Streaming Service iniciado (executável)" -ForegroundColor Green
        }
        else {
            Push-Location "audio-streaming-service"
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            dotnet run
            Pop-Location
        }
    }
    default {
        Write-Host "Opção inválida!" -ForegroundColor Red
        exit 1
    }
}


