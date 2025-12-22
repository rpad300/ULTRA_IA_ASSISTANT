# Script para executar o Audio Streaming Service

Write-Host "=== Executando Audio Streaming Service ===" -ForegroundColor Cyan
Write-Host ""

# Atualizar PATH para incluir .NET
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verificar se .NET está disponível
$dotnetInstalled = Get-Command dotnet -ErrorAction SilentlyContinue

if (!$dotnetInstalled) {
    Write-Host "Erro: .NET SDK não encontrado no PATH." -ForegroundColor Red
    Write-Host "Por favor, feche e reabra o PowerShell ou execute:" -ForegroundColor Yellow
    Write-Host "  .\setup.ps1" -ForegroundColor Cyan
    exit 1
}

Write-Host "Iniciando serviço..." -ForegroundColor Green
Write-Host "Um ícone aparecerá na bandeja do sistema." -ForegroundColor Yellow
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor Yellow
Write-Host ""

dotnet run




