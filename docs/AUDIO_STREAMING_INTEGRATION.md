# Integração Completa do Audio Streaming Service

## Status: ✅ Implementado e Funcional

O serviço de streaming de áudio está completamente integrado com o backend.

## Fluxo de Dados

```
┌─────────────────────────┐
│  C# Audio Streaming     │
│  Service (WASAPI)       │
│  - Captura áudio        │
│  - Resampling 16kHz     │
│  - PCM16 mono           │
└──────────┬──────────────┘
           │ WebSocket
           │ ws://localhost:8000/api/ws/audio-stream
           ▼
┌─────────────────────────┐
│  Backend                │
│  /api/ws/audio-stream   │
│  - Recebe áudio         │
│  - Encaminha para       │
│    AssemblyAI           │
└──────────┬──────────────┘
           │ WebSocket
           │ wss://streaming.assemblyai.com/v3/ws
           ▼
┌─────────────────────────┐
│  AssemblyAI             │
│  Universal Streaming    │
│  - Transcreve áudio     │
│  - Retorna transcripts  │
└──────────┬──────────────┘
           │ JSON
           ▼
┌─────────────────────────┐
│  Backend                │
│  - Recebe transcripts   │
│  - Encaminha para       │
│    serviço C#           │
└─────────────────────────┘
```

## Endpoints

### `/api/ws/audio-stream`

Endpoint WebSocket que recebe áudio do serviço C# e encaminha para AssemblyAI.

**Parâmetros de Query:**
- `language` (opcional): Código de idioma (pt, en, etc.)
- `company_name` (opcional): Nome da empresa para word boost
- `project_name` (opcional): Nome do projeto para word boost

**Formato de Áudio:**
- PCM16 (16-bit signed integer)
- 16kHz sample rate
- Mono (1 canal)

**Mensagens Enviadas pelo Serviço C#:**
- `bytes`: Dados de áudio (PCM16)
- `text` (JSON): Mensagens de controle
  - `{"type": "Terminate"}`: Terminar sessão
  - `{"type": "ForceEndpoint"}`: Forçar fim de turno
  - `{"type": "UpdateConfiguration", ...}`: Atualizar configuração

**Mensagens Recebidas pelo Serviço C#:**
- `{"type": "status", "status": "connected", ...}`: Conexão estabelecida
- `{"type": "status", "status": "session_started", "session_id": "...", ...}`: Sessão iniciada
- `{"type": "transcript", "transcript": "...", "confidence": 0.95, ...}`: Transcrição recebida
- `{"type": "error", "error": "..."}`: Erro ocorrido

## Resampling Implementado

O serviço C# agora suporta:

1. **Conversão Stereo → Mono**: Média dos canais esquerdo e direito
2. **Resampling de Sample Rate**: Interpolação linear para converter qualquer sample rate para 16kHz
   - Exemplo: 48kHz → 16kHz, 44.1kHz → 16kHz

## Como Testar

1. **Iniciar Backend:**
   ```powershell
   cd src/backend
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Iniciar Serviço C#:**
   ```powershell
   cd audio-streaming-service
   .\run.ps1
   ```

3. **Configurar Dispositivo:**
   - Clique com botão direito no ícone da bandeja
   - Selecione "Selecionar Dispositivo"
   - Escolha o dispositivo de áudio
   - Teste o dispositivo

4. **Iniciar Streaming:**
   - Clique em "Iniciar Streaming"
   - O serviço se conectará ao backend
   - O backend encaminhará para AssemblyAI
   - As transcrições serão retornadas

## Logs

### Backend
Os logs mostrarão:
- Conexão do serviço C#
- Chunks de áudio recebidos
- Conexão com AssemblyAI
- Transcrições recebidas

### Serviço C#
- Notificações na bandeja do sistema
- Logs no console (se executado via `dotnet run`)

## Próximas Melhorias

1. **Frontend Integration**: Fazer o frontend receber transcrições do serviço C#
2. **Melhor Resampling**: Usar biblioteca profissional (ex: NAudio resampler) se necessário
3. **Auto-start**: Configurar serviço para iniciar com Windows
4. **Instalador**: Criar setup.exe para distribuição




