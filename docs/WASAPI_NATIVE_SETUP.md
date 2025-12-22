# WASAPI Native Capture Setup

## Visão Geral

Implementação de captura de áudio do sistema via WASAPI usando um módulo nativo Node.js, sem depender do FFmpeg.

## Vantagens

- ✅ Captura diretamente do dispositivo de saída padrão
- ✅ **Não precisa de configuração** (Stereo Mix, VB-Audio Cable, etc.)
- ✅ Você continua a ouvir normalmente
- ✅ Melhor performance (sem processo externo FFmpeg)
- ✅ Menor latência

## Requisitos

### 1. Ferramentas de Build

**Windows:**
- Visual Studio Build Tools ou Visual Studio Community
- Python 3.x
- node-gyp (instalado via npm)

**Instalar Visual Studio Build Tools:**
```powershell
# Download: https://visualstudio.microsoft.com/downloads/
# Ou via winget:
winget install Microsoft.VisualStudio.2022.BuildTools
```

**IMPORTANTE:** Depois de instalar Visual Studio, você **DEVE** instalar os componentes:
- Windows SDK (10.0.19041 ou superior)
- MSVC v143 - VS 2022 C++ build tools

**Veja instruções detalhadas em:** `docs/INSTALL_VS_COMPONENTS.md`

**Instalar Python:**
```powershell
winget install Python.Python.3.11
```

### 2. Dependências do Projeto

As dependências já estão no `package.json`:
- `node-addon-api`: API para criar addons nativos
- `node-gyp`: Ferramenta de build
- `electron-rebuild`: Rebuild para Electron

## Compilação

### Opção 1: Build Automático (Recomendado)

```bash
npm run build:native
```

### Opção 2: Build Manual

```bash
cd src/electron/native
npm install
node-gyp rebuild
```

### Opção 3: Rebuild para Electron

Se o módulo foi compilado para Node.js mas precisa funcionar no Electron:

```bash
npm run rebuild:electron
```

## Como Funciona

1. **Módulo Nativo** (`wasapi-capture.cc`):
   - Usa Windows Audio Session API (WASAPI)
   - Captura loopback do dispositivo de saída padrão
   - Converte para PCM16 e envia para JavaScript

2. **Wrapper TypeScript** (`wasapiCapture.ts`):
   - Interface TypeScript para o módulo nativo
   - Gerencia ciclo de vida da captura
   - Trata erros e callbacks

3. **Integração** (`audioCapture.ts`):
   - Tenta usar WASAPI primeiro
   - Faz fallback para DirectShow (FFmpeg) se WASAPI não estiver disponível

## Troubleshooting

### Erro: "WASAPI native module not available"

**Causa:** O módulo nativo não foi compilado ou não está no caminho correto.

**Solução:**
1. Verifique se o módulo foi compilado:
   ```bash
   ls src/electron/native/build/Release/wasapi_capture.node
   ```
2. Se não existir, compile:
   ```bash
   npm run build:native
   ```

### Erro: "Failed to initialize COM"

**Causa:** Problema com inicialização do COM no Windows.

**Solução:** Reinicie o Electron e tente novamente.

### Erro: "Failed to get default audio endpoint"

**Causa:** Nenhum dispositivo de áudio padrão configurado.

**Solução:**
1. Configure um dispositivo de áudio padrão no Windows
2. Verifique em: Configurações > Sistema > Som

### Módulo compilado mas não funciona no Electron

**Causa:** O módulo foi compilado para Node.js, não para Electron.

**Solução:**
```bash
npm run rebuild:electron
```

## Fallback Automático

Se o módulo WASAPI não estiver disponível ou falhar, o sistema automaticamente:
1. Detecta que WASAPI não está disponível
2. Faz fallback para DirectShow (FFmpeg)
3. Usa Stereo Mix ou VB-Audio Cable (se disponível)

## Status

- ✅ Estrutura do módulo criada
- ✅ Código C++ implementado
- ⚠️ **Necessita compilação** (requer Visual Studio Build Tools)
- ⚠️ **Necessita testes** após compilação

## Próximos Passos

1. Instalar Visual Studio Build Tools
2. Compilar o módulo: `npm run build:native`
3. Testar a captura WASAPI
4. Se funcionar, será usado automaticamente (sem configuração!)

