# Instalar Componentes do Visual Studio para WASAPI

## Problema

Ao tentar compilar o módulo nativo WASAPI, você recebe o erro:
```
gyp ERR! find VS - missing any Windows SDK
```

## Solução: Instalar Componentes via Visual Studio Installer

### Passo 1: Abrir Visual Studio Installer

1. Pressione `Windows + S` e procure "Visual Studio Installer"
2. Ou abra: `C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe`

### Passo 2: Modificar Instalação

1. Encontre sua instalação do **Visual Studio 2022 Community** (ou Build Tools)
2. Clique no botão **"Modificar"**

### Passo 3: Selecionar Componentes

1. Vá para a aba **"Componentes individuais"** (Individual Components)
2. Na barra de pesquisa, procure por:
   - **"Windows SDK"**
   - **"MSVC"**

3. **Marque os seguintes componentes:**

   ✅ **MSVC v143 - VS 2022 C++ x64/x86 build tools (latest)**
   - Ou qualquer versão v143 do MSVC

   ✅ **Windows 10 SDK (10.0.19041.0 ou superior)**
   - Qualquer versão 10.0.19xxx ou superior

   ✅ **Windows 11 SDK (10.0.22000.0 ou superior)** (opcional mas recomendado)
   - Qualquer versão 10.0.22xxx ou superior

### Passo 4: Instalar

1. Clique em **"Modificar"** no canto inferior direito
2. Aguarde a instalação terminar (pode levar alguns minutos)
3. **Reinicie o computador** se solicitado

### Passo 5: Compilar o Módulo

Depois de instalar os componentes, execute:

```bash
npm run build:native
```

## Verificação Rápida

Para verificar se os componentes estão instalados:

```powershell
# Verificar Windows SDK
Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\Include" -ErrorAction SilentlyContinue

# Verificar MSVC
Get-ChildItem "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC" -ErrorAction SilentlyContinue
```

Se ambos retornarem diretórios, os componentes estão instalados!

## Alternativa: Instalar via Linha de Comando

Se preferir usar a linha de comando:

```powershell
# Encontrar o caminho do Visual Studio Installer
$installer = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe"

# Modificar instalação (ajuste o caminho se necessário)
& $installer modify `
  --installPath "C:\Program Files\Microsoft Visual Studio\2022\Community" `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  --add Microsoft.VisualStudio.Component.Windows10SDK.19041 `
  --add Microsoft.VisualStudio.Component.Windows11SDK.22000 `
  --quiet
```

## Troubleshooting

### "Visual Studio Installer não encontrado"

Instale Visual Studio 2022 Community:
- Download: https://visualstudio.microsoft.com/downloads/
- Ou via winget: `winget install Microsoft.VisualStudio.2022.Community`

### "Componentes não aparecem na lista"

1. Certifique-se de que está na aba "Componentes individuais"
2. Use a barra de pesquisa para encontrar "Windows SDK" e "MSVC"
3. Se ainda não aparecer, atualize o Visual Studio Installer

### "Erro ao compilar mesmo com componentes instalados"

1. Reinicie o terminal/IDE
2. Execute: `npm run build:native` novamente
3. Se ainda falhar, tente: `npm run rebuild:electron`

## Próximos Passos

Depois de instalar os componentes e compilar com sucesso:

1. O módulo WASAPI será usado automaticamente
2. Não precisa de configuração (Stereo Mix, VB-Audio Cable, etc.)
3. Captura diretamente do dispositivo de áudio padrão
4. Você continua a ouvir normalmente!




