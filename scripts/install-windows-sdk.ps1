# Instala Windows SDK necessário para compilar módulos nativos

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instalando Windows SDK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se winget está disponível
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "[ERRO] winget não está disponível!" -ForegroundColor Red
    Write-Host "Por favor, instale Windows SDK manualmente:" -ForegroundColor Yellow
    Write-Host "  https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Instalando Windows 11 SDK (recomendado)..." -ForegroundColor Yellow
Write-Host ""

try {
    # Tentar instalar Windows 11 SDK
    winget install --id Microsoft.Windows.SDK.11 --accept-package-agreements --accept-source-agreements
    
    Write-Host ""
    Write-Host "[OK] Windows SDK instalado!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agora você precisa instalar os componentes do Visual Studio:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Abra Visual Studio Installer" -ForegroundColor White
    Write-Host "2. Clique em 'Modificar' na instalação do Visual Studio 2022" -ForegroundColor White
    Write-Host "3. Vá para 'Componentes individuais'" -ForegroundColor White
    Write-Host "4. Marque:" -ForegroundColor White
    Write-Host "   - MSVC v143 - VS 2022 C++ x64/x86 build tools" -ForegroundColor Gray
    Write-Host "   - Windows 10 SDK (qualquer versão 10.0.19xxx ou superior)" -ForegroundColor Gray
    Write-Host "   - Windows 11 SDK (qualquer versão 10.0.22xxx ou superior)" -ForegroundColor Gray
    Write-Host "5. Clique em 'Modificar'" -ForegroundColor White
    Write-Host ""
    Write-Host "Depois execute: npm run build:native" -ForegroundColor Yellow
    
} catch {
    Write-Host "[ERRO] Falha ao instalar Windows SDK via winget" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale manualmente:" -ForegroundColor Yellow
    Write-Host "  https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor Yellow
}




