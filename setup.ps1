# Ultra Assistant - Setup Automático
# Este script instala todas as dependências necessárias

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ultra Assistant - Setup Automático" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Função para verificar se um comando existe
function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Função para verificar se FFmpeg está instalado
function Test-FFmpeg {
    try {
        $version = ffmpeg -version 2>&1 | Select-String -Pattern "ffmpeg version" -Quiet
        return $version
    } catch {
        return $false
    }
}

# Função para instalar FFmpeg via winget
function Install-FFmpeg {
    Write-Host "[1/6] Verificando FFmpeg..." -ForegroundColor Yellow
    
    if (Test-FFmpeg) {
        Write-Host "[OK] FFmpeg ja esta instalado" -ForegroundColor Green
        ffmpeg -version | Select-String -Pattern "ffmpeg version" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        return $true
    }
    
    Write-Host "FFmpeg não encontrado. Tentando instalar via winget..." -ForegroundColor Yellow
    
    if (-not (Test-Command "winget")) {
        Write-Host "[ERRO] winget nao esta disponivel. Por favor, instale FFmpeg manualmente:" -ForegroundColor Red
        Write-Host "  Builds disponiveis em: https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor Yellow
        Write-Host "  Ou execute: winget install ffmpeg (full build)" -ForegroundColor Yellow
        Write-Host "  Ou: winget install \"FFmpeg (Essentials Build)\" (essentials - mais leve)" -ForegroundColor Yellow
        return $false
    }
    
    try {
        Write-Host "Instalando FFmpeg via winget (full build - isso pode levar alguns minutos)..." -ForegroundColor Yellow
        Write-Host "  Para instalar essentials build (mais leve): winget install \"FFmpeg (Essentials Build)\"" -ForegroundColor Gray
        winget install ffmpeg --accept-package-agreements --accept-source-agreements
        
        # Atualizar PATH para a sessão atual
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path","Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path","User")
        $env:Path = "$machinePath;$userPath"
        
        # Aguardar um pouco para o PATH ser atualizado
        Start-Sleep -Seconds 2
        
        if (Test-FFmpeg) {
            Write-Host "[OK] FFmpeg instalado com sucesso!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[AVISO] FFmpeg foi instalado, mas nao esta no PATH. Reinicie o terminal e execute este script novamente." -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "[ERRO] Erro ao instalar FFmpeg: $_" -ForegroundColor Red
        Write-Host "  Por favor, instale manualmente:" -ForegroundColor Yellow
        Write-Host "    winget install ffmpeg (full build)" -ForegroundColor Yellow
        Write-Host "    OU winget install \"FFmpeg (Essentials Build)\" (essentials)" -ForegroundColor Yellow
        Write-Host "  Ou descarregue de: https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor Yellow
        return $false
    }
}

# Função para verificar Node.js
function Test-NodeJS {
    Write-Host "[2/6] Verificando Node.js..." -ForegroundColor Yellow
    
    if (Test-Command "node") {
        $version = node --version
        Write-Host "[OK] Node.js instalado: $version" -ForegroundColor Green
        
        # Verificar se a versão é >= 16
        $majorVersion = [int]($version -replace 'v(\d+)\..*', '$1')
        if ($majorVersion -lt 16) {
            Write-Host "[AVISO] Node.js versao $version e antiga. Recomendado: >= 16" -ForegroundColor Yellow
        }
        return $true
    } else {
        Write-Host "[ERRO] Node.js nao encontrado!" -ForegroundColor Red
        Write-Host "  Por favor, instale Node.js de: https://nodejs.org/" -ForegroundColor Yellow
        Write-Host "  Ou via winget: winget install OpenJS.NodeJS" -ForegroundColor Yellow
        return $false
    }
}

# Função para verificar Python
function Test-Python {
    Write-Host "[3/6] Verificando Python..." -ForegroundColor Yellow
    
    if (Test-Command "python") {
        $version = python --version
        Write-Host "[OK] Python instalado: $version" -ForegroundColor Green
        
        # Verificar se a versão é >= 3.8
        $versionOutput = python --version 2>&1
        $versionMatch = $versionOutput -match '(\d+)\.(\d+)'
        if ($versionMatch) {
            $major = [int]$matches[1]
            $minor = [int]$matches[2]
            if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 8)) {
                Write-Host "[AVISO] Python versao $versionOutput e antiga. Recomendado: >= 3.8" -ForegroundColor Yellow
            }
        }
        return $true
    } else {
        Write-Host "[ERRO] Python nao encontrado!" -ForegroundColor Red
        Write-Host "  Por favor, instale Python de: https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host "  Ou via winget: winget install Python.Python.3.11" -ForegroundColor Yellow
        return $false
    }
}

# Função para instalar dependências do frontend
function Install-FrontendDependencies {
    Write-Host "[4/6] Instalando dependências do frontend..." -ForegroundColor Yellow
    
    if (-not (Test-Path "src/frontend")) {
        Write-Host "[ERRO] Diretorio src/frontend nao encontrado!" -ForegroundColor Red
        return $false
    }
    
    Push-Location "src/frontend"
    
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Host "Executando npm install (isso pode levar alguns minutos)..." -ForegroundColor Gray
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install falhou"
            }
            Write-Host "[OK] Dependencias do frontend instaladas!" -ForegroundColor Green
        } else {
            Write-Host "[OK] node_modules ja existe. Pulando instalacao." -ForegroundColor Green
        }
        return $true
    } catch {
        Write-Host "[ERRO] Erro ao instalar dependencias do frontend: $_" -ForegroundColor Red
        return $false
    } finally {
        Pop-Location
    }
}

# Função para instalar dependências do backend
function Install-BackendDependencies {
    Write-Host "[5/6] Instalando dependências do backend..." -ForegroundColor Yellow
    
    if (-not (Test-Path "src/backend")) {
        Write-Host "[ERRO] Diretorio src/backend nao encontrado!" -ForegroundColor Red
        return $false
    }
    
    Push-Location "src/backend"
    
    try {
        # Verificar se existe venv
        if (-not (Test-Path ".venv")) {
            Write-Host "Criando ambiente virtual Python..." -ForegroundColor Gray
            python -m venv .venv
        }
        
        # Ativar venv
        $venvActivate = Join-Path (Get-Location) ".venv\Scripts\Activate.ps1"
        if (Test-Path $venvActivate) {
            Write-Host "Ativando ambiente virtual..." -ForegroundColor Gray
            & $venvActivate
        }
        
        Write-Host "Instalando dependências Python (isso pode levar alguns minutos)..." -ForegroundColor Gray
        pip install --upgrade pip
        pip install -r requirements.txt
        
        if ($LASTEXITCODE -ne 0) {
            throw "pip install falhou"
        }
        
        Write-Host "[OK] Dependencias do backend instaladas!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[ERRO] Erro ao instalar dependencias do backend: $_" -ForegroundColor Red
        return $false
    } finally {
        Pop-Location
    }
}

# Função para verificar configuração
function Test-Configuration {
    Write-Host "[6/6] Verificando configuração..." -ForegroundColor Yellow
    
    $issues = @()
    
    # Verificar .env do backend
    if (-not (Test-Path "src/backend/.env")) {
        $issues += "Arquivo src/backend/.env não encontrado. Crie um baseado em .env.example"
    } else {
        Write-Host "[OK] Arquivo .env encontrado" -ForegroundColor Green
    }
    
    # Verificar se .env.example existe
    if (Test-Path "src/backend/.env.example") {
        Write-Host "[OK] Arquivo .env.example encontrado (use como referencia)" -ForegroundColor Green
    }
    
    if ($issues.Count -gt 0) {
        Write-Host "[AVISO] Problemas encontrados:" -ForegroundColor Yellow
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[OK] Configuracao basica OK" -ForegroundColor Green
    }
    
    return $issues.Count -eq 0
}

# Função principal
function Main {
    Write-Host "Iniciando setup automático..." -ForegroundColor Cyan
    Write-Host ""
    
    $results = @{
        FFmpeg = $false
        NodeJS = $false
        Python = $false
        Frontend = $false
        Backend = $false
        Config = $false
    }
    
    # Executar verificações e instalações
    $results.FFmpeg = Install-FFmpeg
    Write-Host ""
    
    $results.NodeJS = Test-NodeJS
    Write-Host ""
    
    $results.Python = Test-Python
    Write-Host ""
    
    if ($results.NodeJS) {
        $results.Frontend = Install-FrontendDependencies
        Write-Host ""
    }
    
    if ($results.Python) {
        $results.Backend = Install-BackendDependencies
        Write-Host ""
    }
    
    $results.Config = Test-Configuration
    Write-Host ""
    
    # Resumo
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Resumo do Setup" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    $allOk = $true
    foreach ($key in $results.Keys) {
        $status = if ($results[$key]) { "[OK]" } else { "[ERRO]" }
        $color = if ($results[$key]) { "Green" } else { "Red" }
        Write-Host "$status $key" -ForegroundColor $color
        if (-not $results[$key]) { $allOk = $false }
    }
    
    Write-Host ""
    
    if ($allOk) {
        Write-Host "[OK] Setup completo! Voce pode agora executar:" -ForegroundColor Green
        Write-Host "  - Backend: cd src/backend && python main.py" -ForegroundColor Cyan
        Write-Host "  - Frontend: cd src/frontend && npm run dev" -ForegroundColor Cyan
        Write-Host "  - Electron: npm run dev:electron" -ForegroundColor Cyan
    } else {
        Write-Host "[AVISO] Alguns itens precisam de atencao. Verifique os erros acima." -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Executar
Main

