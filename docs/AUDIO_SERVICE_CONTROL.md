# Audio Service Control - Sistema de Controle Remoto

## Visão Geral

O sistema de controle remoto permite que a interface web controle completamente o serviço C# de streaming de áudio, eliminando a necessidade de controles manuais (tray icon, menus, etc.). Tudo é gerenciado através da interface web.

## Arquitetura

```
Interface Web (React)
    ↓ HTTP REST
Backend Python (FastAPI)
    ↓ HTTP REST
Serviço C# (HttpControlServer)
    ↓ WASAPI
Captura de Áudio do Sistema
```

## Endpoints do Backend

### `GET /api/audio-service/status`
Obtém o status atual do serviço:
- `isCapturing`: Se está capturando áudio
- `isConnected`: Se está conectado ao WebSocket
- `selectedDeviceId`: ID do dispositivo selecionado

### `POST /api/audio-service/start`
Inicia o streaming de áudio.
- Body opcional: `{ "deviceId": "..." }` - ID do dispositivo a usar

### `POST /api/audio-service/stop`
Para o streaming de áudio.

### `GET /api/audio-service/devices`
Lista todos os dispositivos de áudio disponíveis.
- Retorna: `{ "devices": [{ "id": "...", "name": "...", "dataFlow": "..." }] }`

### `PUT /api/audio-service/device`
Define o dispositivo de áudio a usar.
- Body: `{ "deviceId": "..." }`

## Serviço C# HTTP API

O serviço C# expõe uma API HTTP simples em `http://localhost:8001/api/audio-service/`:

- **Porta**: 8001 (separada do backend principal na 8000)
- **CORS**: Habilitado para todas as origens
- **Formato**: JSON

### Endpoints do Serviço C#

- `GET /status` - Status do serviço
- `POST /start` - Iniciar streaming
- `POST /stop` - Parar streaming
- `GET /devices` - Listar dispositivos
- `PUT /device` - Definir dispositivo

## Interface Web

### Componentes

1. **`AudioServiceControl`** (`src/frontend/src/components/sessions/AudioServiceControl.tsx`)
   - Botões para iniciar/parar streaming
   - Badge mostrando status (Ativo/Parado)
   - Atualização automática de status a cada 2 segundos

2. **`AudioDeviceSelector`** (atualizado)
   - Agora tenta usar o serviço C# primeiro (preferido)
   - Fallback para Electron/FFmpeg se o serviço C# não estiver disponível
   - Define automaticamente o dispositivo no serviço C# quando selecionado

### Store (Zustand)

Novas funções no `meetingStore`:
- `getAudioServiceStatus()` - Obtém status
- `startAudioService(deviceId?)` - Inicia streaming
- `stopAudioService()` - Para streaming
- `getAudioServiceDevices()` - Lista dispositivos
- `setAudioServiceDevice(deviceId)` - Define dispositivo

## Scripts de Automação

### `ultra_start.bat`
Script principal para iniciar todos os serviços:
- Para serviços existentes
- Inicia Backend (porta 8000)
- Inicia Frontend (porta 5999)
- Inicia Serviço C# (porta 8001)
- Inicia Electron

**Uso:**
```batch
ultra_start.bat          # Inicia tudo
ultra_start.bat --build  # Compila tudo antes de iniciar
```

### `build_all.bat`
Script para compilar todos os componentes:
- Backend (instala dependências Python)
- Frontend (npm install + build)
- Electron (TypeScript compile)
- Serviço C# (dotnet publish)

## Fluxo de Uso

1. **Iniciar Sistema:**
   ```batch
   ultra_start.bat --build
   ```

2. **Na Interface Web:**
   - O componente `AudioServiceControl` aparece automaticamente
   - Mostra status do serviço (disponível/não disponível)
   - Botão "Iniciar" para começar o streaming
   - Botão "Parar" para parar o streaming

3. **Selecionar Dispositivo:**
   - Abrir `AudioDeviceSelector`
   - Lista dispositivos do serviço C# (se disponível)
   - Ao selecionar, o dispositivo é automaticamente configurado no serviço C#

4. **Iniciar Streaming:**
   - Clicar em "Iniciar" no `AudioServiceControl`
   - O serviço C# conecta ao WebSocket do backend
   - Começa a capturar áudio do dispositivo selecionado
   - Áudio é enviado para o backend → AssemblyAI

## Atualizações Automáticas

Quando você faz alterações no código:

1. **Backend/Frontend**: Reiniciam automaticamente (hot reload)
2. **Serviço C#**: Precisa ser recompilado e reiniciado
3. **Electron**: Precisa ser recompilado

Para atualizar tudo:
```batch
ultra_start.bat --build
```

Isso irá:
- Compilar todos os componentes
- Parar serviços antigos
- Iniciar serviços novos

## Troubleshooting

### Serviço C# não responde
- Verificar se está rodando: `tasklist | findstr AudioStreamingService`
- Verificar porta 8001: `netstat -an | findstr 8001`
- Verificar logs na janela do serviço

### Backend não consegue conectar ao serviço C#
- Verificar se o serviço C# está rodando
- Verificar se a porta 8001 está livre
- Verificar firewall do Windows

### Dispositivos não aparecem
- Verificar se o serviço C# está rodando
- Verificar se há dispositivos de áudio no Windows
- Tentar fallback para Electron/FFmpeg




