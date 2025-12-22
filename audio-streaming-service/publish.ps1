# Script para publicar o Audio Streaming Service

Write-Host "=== Publicando Audio Streaming Service ===" -ForegroundColor Cyan
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

Write-Host "Publicando aplicação..." -ForegroundColor Green
Write-Host "Isso pode levar alguns minutos..." -ForegroundColor Yellow
Write-Host ""

dotnet publish -c Release -r win-x64 --self-contained

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Publicação concluída com sucesso! ===" -ForegroundColor Green
    Write-Host ""
    $publishPath = "bin\Release\net8.0-windows\win-x64\publish"
    Write-Host "Executável criado em:" -ForegroundColor Yellow
    Write-Host "  $publishPath\AudioStreamingService.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Para executar:" -ForegroundColor Yellow
    Write-Host "  .\$publishPath\AudioStreamingService.exe" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Erro na publicação." -ForegroundColor Red
    exit 1
}




