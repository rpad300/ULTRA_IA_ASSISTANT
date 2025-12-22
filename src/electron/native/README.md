# WASAPI Native Addon

Este módulo nativo permite capturar áudio do sistema via WASAPI (Windows Audio Session API) sem depender do FFmpeg.

## Compilação

Para compilar o módulo nativo, você precisa:

1. **Ferramentas de build do Windows:**
   - Visual Studio Build Tools ou Visual Studio Community
   - Python 3.x
   - node-gyp (instalado globalmente ou como dependência)

2. **Compilar:**
   ```bash
   cd src/electron/native
   npm install
   node-gyp rebuild
   ```

3. **Para Electron (recomendado):**
   ```bash
   npm install --save-dev electron-rebuild
   npx electron-rebuild
   ```

## Requisitos

- Windows 10 ou superior
- Node.js com suporte a addons nativos
- Visual Studio Build Tools (para compilar)

## Uso

O módulo será carregado automaticamente pelo `WASAPICapture` class em `src/electron/wasapiCapture.ts`.

Se o módulo não estiver disponível, o sistema fará fallback automático para DirectShow (FFmpeg).




