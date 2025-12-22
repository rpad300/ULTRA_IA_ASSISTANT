# Script para instalar componentes necessários do Visual Studio
# Requer: Visual Studio 2022 Community ou Build Tools

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instalando Componentes do Visual Studio" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Visual Studio Installer está disponível
$vsInstallerPath = "${env:ProgramFiles}\Microsoft Visual Studio\Installer\vs_installer.exe"
$vsInstallerPathX86 = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe"

if (Test-Path $vsInstallerPath) {
    $installerPath = $vsInstallerPath
} elseif (Test-Path $vsInstallerPathX86) {
    $installerPath = $vsInstallerPathX86
} else {
    Write-Host "[ERRO] Visual Studio Installer não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, instale Visual Studio 2022 Community ou Build Tools:" -ForegroundColor Yellow
    Write-Host "  https://visualstudio.microsoft.com/downloads/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ou via winget:" -ForegroundColor Yellow
    Write-Host "  winget install Microsoft.VisualStudio.2022.Community" -ForegroundColor Yellow
    Write-Host "  winget install Microsoft.VisualStudio.2022.BuildTools" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Visual Studio Installer encontrado: $installerPath" -ForegroundColor Green
Write-Host ""

# Componentes necessários
$components = @(
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "Microsoft.VisualStudio.Component.Windows10SDK.19041",
    "Microsoft.VisualStudio.Component.Windows11SDK.22000"
)

Write-Host "Componentes necessários:" -ForegroundColor Yellow
foreach ($component in $components) {
    Write-Host "  - $component" -ForegroundColor Gray
}
Write-Host ""

# Tentar instalar via winget primeiro (mais rápido)
Write-Host "Tentando instalar via winget..." -ForegroundColor Yellow

try {
    # Verificar se Windows SDK está instalado
    $sdkInstalled = Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots" -ErrorAction SilentlyContinue
    
    if (-not $sdkInstalled) {
        Write-Host "Windows SDK não encontrado. Instalando..." -ForegroundColor Yellow
        
        # Tentar instalar Windows SDK via winget
        $sdkPackages = @(
            "Microsoft.Windows.SDK.10.0.19041",
            "Microsoft.Windows.SDK.11"
        )
        
        foreach ($package in $sdkPackages) {
            Write-Host "Tentando instalar $package..." -ForegroundColor Yellow
            try {
                winget install --id $package --accept-package-agreements --accept-source-agreements --silent
                Write-Host "[OK] $package instalado" -ForegroundColor Green
                break
            } catch {
                Write-Host "[AVISO] Não foi possível instalar $package via winget" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "[OK] Windows SDK já está instalado" -ForegroundColor Green
    }
} catch {
    Write-Host "[AVISO] Não foi possível verificar/instalar Windows SDK via winget" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instruções Manuais" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Se a instalação automática não funcionou, siga estes passos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Abra Visual Studio Installer" -ForegroundColor White
Write-Host "2. Clique em 'Modificar' na sua instalação do Visual Studio" -ForegroundColor White
Write-Host "3. Vá para a aba 'Componentes individuais'" -ForegroundColor White
Write-Host "4. Marque os seguintes componentes:" -ForegroundColor White
Write-Host "   - MSVC v143 - VS 2022 C++ x64/x86 build tools" -ForegroundColor Gray
Write-Host "   - Windows 10 SDK (10.0.19041.0 ou mais recente)" -ForegroundColor Gray
Write-Host "   - Windows 11 SDK (10.0.22000.0 ou mais recente)" -ForegroundColor Gray
Write-Host "5. Clique em 'Modificar' para instalar" -ForegroundColor White
Write-Host ""
Write-Host "OU" -ForegroundColor Yellow
Write-Host ""
Write-Host "Instale via Visual Studio Installer CLI:" -ForegroundColor Yellow
Write-Host "  & '$installerPath' modify --installPath `"C:\Program Files\Microsoft Visual Studio\2022\Community`" --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows10SDK.19041 --quiet" -ForegroundColor Gray
Write-Host ""

# Tentar instalar via CLI se possível
Write-Host "Tentando instalar componentes via Visual Studio Installer CLI..." -ForegroundColor Yellow

# Encontrar instalação do VS
$vsInstallations = & "$installerPath" list --format json | ConvertFrom-Json

if ($vsInstallations) {
    foreach ($installation in $vsInstallations) {
        if ($installation.installationPath) {
            $installPath = $installation.installationPath
            Write-Host "Encontrada instalação em: $installPath" -ForegroundColor Green
            
            Write-Host "Instalando componentes..." -ForegroundColor Yellow
            $installArgs = @(
                "modify",
                "--installPath", "`"$installPath`"",
                "--add", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                "--add", "Microsoft.VisualStudio.Component.Windows10SDK.19041",
                "--add", "Microsoft.VisualStudio.Component.Windows11SDK.22000",
                "--quiet",
                "--norestart"
            )
            
            try {
                & "$installerPath" $installArgs
                Write-Host "[OK] Componentes instalados com sucesso!" -ForegroundColor Green
                Write-Host ""
                Write-Host "Aguarde a instalação terminar e depois execute:" -ForegroundColor Yellow
                Write-Host "  npm run build:native" -ForegroundColor White
                exit 0
            } catch {
                Write-Host "[ERRO] Falha ao instalar componentes automaticamente" -ForegroundColor Red
                Write-Host "Por favor, instale manualmente usando as instruções acima" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "[AVISO] Nenhuma instalação do Visual Studio encontrada" -ForegroundColor Yellow
    Write-Host "Por favor, instale Visual Studio 2022 Community ou Build Tools primeiro" -ForegroundColor Yellow
}




