# Captura de Áudio do Sistema via Electron

## Visão Geral

Esta implementação permite capturar o áudio do sistema operacional (loopback) usando Electron, permitindo capturar áudio de qualquer aplicação (Zoom, Teams, Spotify, etc.), não apenas do navegador.

## Requisitos

### 1. FFmpeg

O sistema usa FFmpeg para capturar o áudio do sistema. Você precisa ter FFmpeg instalado:

**Windows:**
- **Recomendado**: Instale via winget: `winget install ffmpeg` (full build)
  - Ou: `winget install "FFmpeg (Essentials Build)"` (essentials build - mais leve)
  - Builds disponíveis em: https://www.gyan.dev/ffmpeg/builds/
- **Builds disponíveis:**
  - **Essentials Build**: Mais leve, suficiente para DirectShow e uso básico
  - **Full Build**: Inclui mais bibliotecas (recomendado para funcionalidades avançadas)
  - **Git Master**: Builds mais recentes com as últimas funcionalidades
- **Instalação manual:**
  1. Descarregue de: https://www.gyan.dev/ffmpeg/builds/
  2. Extraia o ficheiro `.7z` (use 7-Zip)
  3. Adicione a pasta `bin` ao PATH do Windows, OU
  4. Coloque `ffmpeg.exe` na raiz do projeto
- **Importante**: 
  - Use build "full" ou "essentials" - ambos suportam DirectShow
  - Builds "full" têm mais bibliotecas mas são maiores (~100MB vs ~30MB)
  - Para este projeto, "essentials" é suficiente
  - Builds "git master" são mais recentes mas podem ser menos estáveis
  - Builds "release" são mais estáveis (versão 8.0.1 atual)
- **Nota sobre WASAPI**: 
  - WASAPI ainda não está implementado no FFmpeg (ticket #9408)
  - DirectShow é a única opção disponível atualmente
  - Quando WASAPI for implementado, será a solução ideal (sem necessidade de configuração)

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 2. Dependências do Projeto

As dependências já estão configuradas no `package.json`. Execute:

```bash
npm install
```

## Como Funciona

### Arquitetura

1. **Electron Main Process** (`src/electron/main.ts`):
   - Gerencia a captura de áudio do sistema usando FFmpeg
   - Expõe IPC handlers para o renderer process

2. **Preload Script** (`src/electron/preload.ts`):
   - Expõe APIs seguras para o frontend via `contextBridge`
   - Expõe `window.electronAPI.audioCapture`

3. **Frontend** (`src/frontend/src/lib/audioUtils.ts`):
   - Detecta automaticamente se está rodando no Electron
   - Usa captura nativa do Electron quando disponível
   - Faz fallback para `getDisplayMedia` do navegador se não estiver no Electron

### Fluxo de Captura

1. Quando o usuário inicia uma sessão de transcrição:
   - O `AudioStreamer` verifica se está no Electron
   - Se sim, chama `window.electronAPI.audioCapture.start()`
   - O Electron inicia FFmpeg para capturar o áudio do sistema
   - Os dados de áudio são enviados via IPC para o renderer
   - O renderer envia os dados para o WebSocket do backend

2. Quando o usuário para a sessão:
   - O `AudioStreamer` chama `window.electronAPI.audioCapture.stop()`
   - O Electron para o processo FFmpeg

## Plataformas Suportadas

### Windows
- Usa **DirectShow** via FFmpeg para captura de loopback
- Detecta automaticamente dispositivos de loopback (ex: "Stereo Mix")
- Requer FFmpeg com suporte a DirectShow (disponível na maioria das instalações)

### macOS
- Usa **AVFoundation** via FFmpeg
- Pode requerer permissões de microfone/áudio
- Funciona com dispositivos de loopback como BlackHole

### Linux
- Usa **PulseAudio** via FFmpeg
- Captura do dispositivo "monitor" padrão
- Requer PulseAudio configurado

## Uso

### No Frontend

O sistema detecta automaticamente se está rodando no Electron. Não é necessário fazer nada especial:

```typescript
// O AudioStreamer já detecta automaticamente
const audioStreamer = new AudioStreamer(
  onTranscript,
  onError,
  true, // captureSystemAudio = true
  onStatusChange
);

// Quando você chama start(), ele usa Electron se disponível
await audioStreamer.start(wsUrl);
```

### Verificar Status

Você pode verificar se está usando captura do Electron:

```typescript
const isElectron = window.electronAPI?.isElectron;
const status = await window.electronAPI?.audioCapture.status();
console.log('Is capturing:', status?.isCapturing);
```

## Troubleshooting

### FFmpeg não encontrado

**Erro:** `FFmpeg not found`

**Solução:**
1. Instale FFmpeg e adicione ao PATH (recomendado: `winget install Gyan.FFmpeg`), OU
2. Coloque `ffmpeg.exe` (Windows) ou `ffmpeg` (macOS/Linux) na raiz do projeto
3. Reinicie o terminal/shell após instalar para atualizar o PATH

### Dispositivo de loopback não encontrado (Windows)

**Erro:** `Could not find loopback device`

**Solução:**
1. Ative "Stereo Mix" ou "What U Hear" nas configurações de áudio do Windows
2. Vá em: Configurações > Sistema > Som > Configurações de som > Gravação
3. Clique com botão direito e selecione "Mostrar dispositivos desabilitados"
4. Ative "Stereo Mix" ou dispositivo similar
5. **Nota**: O sistema usa DirectShow para detectar dispositivos, que é mais compatível com builds do FFmpeg

### Permissões (macOS)

**Erro:** `Permission denied`

**Solução:**
1. Vá em: Configurações do Sistema > Privacidade e Segurança > Microfone
2. Dê permissão para o Electron/Ultra Assistant

### Áudio não está sendo capturado

**Verificações:**
1. Verifique se FFmpeg está instalado: `ffmpeg -version`
2. Verifique se está rodando no Electron (não no navegador)
3. Verifique os logs do console para erros
4. Verifique se o dispositivo de loopback está ativo (Windows)

## Desenvolvimento

### Compilar Electron

```bash
npm run build:electron
```

### Rodar em Desenvolvimento

```bash
# Terminal 1: Backend
cd src/backend
python main.py

# Terminal 2: Frontend
cd src/frontend
npm run dev

# Terminal 3: Electron
npm run dev:electron
```

## Notas Técnicas

- O áudio é capturado em PCM 16-bit, 16kHz, mono
- Os dados são enviados em chunks via IPC
- O frontend converte Buffer (Node.js) para ArrayBuffer (Web) antes de enviar ao WebSocket
- O sistema faz fallback automático para `getDisplayMedia` se Electron não estiver disponível
- **Windows**: Usa DirectShow (dshow) em vez de WASAPI para melhor compatibilidade com builds do FFmpeg
  - Comando FFmpeg: `-f dshow -i audio="Stereo Mix"`
  - Detecta automaticamente dispositivos de loopback via `ffmpeg -f dshow -list_devices true -i dummy`

