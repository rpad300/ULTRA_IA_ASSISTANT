# Script para instalar .NET 8 SDK via winget

Write-Host "Instalando .NET 8 SDK..." -ForegroundColor Green

# Verificar se winget está disponível
if (!(Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "Erro: winget não está disponível. Por favor, instale o Windows Package Manager." -ForegroundColor Red
    Write-Host "Baixe em: https://aka.ms/getwinget" -ForegroundColor Yellow
    exit 1
}

# Instalar .NET 8 SDK
Write-Host "Baixando e instalando .NET 8 SDK (isso pode levar alguns minutos)..." -ForegroundColor Yellow
winget install Microsoft.DotNet.SDK.8 --accept-package-agreements --accept-source-agreements

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n.NET 8 SDK instalado com sucesso!" -ForegroundColor Green
    Write-Host "`nPor favor, feche e reabra o PowerShell para que as mudanças tenham efeito." -ForegroundColor Yellow
    Write-Host "Depois, execute: cd audio-streaming-service && dotnet restore && dotnet build" -ForegroundColor Cyan
} else {
    Write-Host "`nErro ao instalar .NET 8 SDK. Tente instalar manualmente:" -ForegroundColor Red
    Write-Host "https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
    exit 1
}




