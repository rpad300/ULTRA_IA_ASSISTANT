# Serviço de Streaming de Áudio Dedicado

## Problema Atual
- Dependência de FFmpeg e DirectShow (pode ser instável)
- Configuração manual de dispositivos (Stereo Mix, VB-Audio Cable)
- Limitações do Electron para captura de áudio do sistema
- Escala do microfone pode desaparecer quando dispositivo de sistema é selecionado

## Solução: Programa Dedicado em C# / .NET

Criei a estrutura básica de um programa standalone que:
1. **Captura áudio via WASAPI** (nativo do Windows, sem dependências)
2. **Faz streaming via WebSocket** para o backend
3. **Roda como aplicação tray icon** (background, sempre disponível)
4. **Interface simples** para seleção de dispositivo

## Estrutura Criada

```
audio-streaming-service/
├── AudioStreamingService.csproj  # Projeto .NET 8
├── Program.cs                    # Aplicação principal com tray icon
├── WASAPICapture.cs             # Captura WASAPI loopback
├── WebSocketClient.cs            # Cliente WebSocket
└── DeviceSelector.cs             # Interface de seleção de dispositivos
```

## Como Funciona

1. **WASAPICapture**: Usa NAudio para capturar áudio do sistema via WASAPI loopback
2. **WebSocketClient**: Conecta ao backend em `ws://localhost:8000/api/ws/audio-stream`
3. **Program**: Aplicação Windows Forms com tray icon para controle
4. **DeviceSelector**: Janela para selecionar dispositivo de áudio

## Próximos Passos

1. **Compilar o projeto C#**:
   ```bash
   cd audio-streaming-service
   dotnet build
   dotnet run
   ```

2. **Adicionar endpoint no backend** para receber streaming de áudio:
   - Criar `/api/ws/audio-stream` no backend
   - Integrar com o endpoint de transcrição existente

3. **Criar instalador** (setup.exe) para distribuição

## Vantagens

- ✅ **Sem FFmpeg** - Captura nativa via WASAPI
- ✅ **Sem configuração manual** - Detecta dispositivos automaticamente
- ✅ **Baixa latência** - Streaming direto
- ✅ **Fácil de usar** - Tray icon simples
- ✅ **Independente** - Roda separado do Electron

## Integração com Backend

O serviço enviará dados de áudio para:
```
ws://localhost:8000/api/ws/audio-stream
```

O backend precisará de um novo endpoint que:
1. Recebe dados de áudio (PCM 16-bit, 16kHz, mono)
2. Encaminha para o endpoint de transcrição existente
3. Ou processa diretamente

## Status

🚧 **Estrutura criada** - Pronto para implementação e testes
