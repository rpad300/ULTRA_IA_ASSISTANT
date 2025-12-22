# Script completo de setup para Audio Streaming Service

Write-Host "=== Audio Streaming Service - Setup ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se .NET está instalado
$dotnetInstalled = Get-Command dotnet -ErrorAction SilentlyContinue

if (!$dotnetInstalled) {
    Write-Host ".NET SDK não encontrado. Instalando..." -ForegroundColor Yellow
    Write-Host ""
    
    # Verificar se winget está disponível
    if (!(Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host "Erro: winget não está disponível." -ForegroundColor Red
        Write-Host "Por favor, instale o Windows Package Manager primeiro:" -ForegroundColor Yellow
        Write-Host "https://aka.ms/getwinget" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Ou baixe o .NET 8 SDK manualmente:" -ForegroundColor Yellow
        Write-Host "https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Cyan
        exit 1
    }
    
    Write-Host "Instalando .NET 8 SDK via winget..." -ForegroundColor Green
    winget install Microsoft.DotNet.SDK.8 --accept-package-agreements --accept-source-agreements
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao instalar .NET SDK. Tente instalar manualmente:" -ForegroundColor Red
        Write-Host "https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host ""
    Write-Host ".NET SDK instalado! Por favor, feche e reabra o PowerShell." -ForegroundColor Green
    Write-Host "Depois execute este script novamente ou:" -ForegroundColor Yellow
    Write-Host "  cd audio-streaming-service" -ForegroundColor Cyan
    Write-Host "  dotnet restore" -ForegroundColor Cyan
    Write-Host "  dotnet build" -ForegroundColor Cyan
    exit 0
}

# Verificar versão do .NET
Write-Host "Verificando versão do .NET..." -ForegroundColor Green
$dotnetVersion = dotnet --version
Write-Host "  .NET encontrado: $dotnetVersion" -ForegroundColor Green

# Verificar se é .NET 8 ou superior
$versionParts = $dotnetVersion.Split('.')
$majorVersion = [int]$versionParts[0]

if ($majorVersion -lt 8) {
    Write-Host "Aviso: Versão do .NET é anterior à 8.0. Recomendado: .NET 8 SDK" -ForegroundColor Yellow
    Write-Host "Baixe em: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Restaurando dependências..." -ForegroundColor Green
dotnet restore

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao restaurar dependências." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Compilando projeto..." -ForegroundColor Green
dotnet build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao compilar projeto." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Setup concluído com sucesso! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Para executar o serviço:" -ForegroundColor Yellow
Write-Host "  dotnet run" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ou para criar um executável:" -ForegroundColor Yellow
Write-Host "  dotnet publish -c Release -r win-x64 --self-contained" -ForegroundColor Cyan




