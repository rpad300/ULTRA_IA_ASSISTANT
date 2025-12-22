# Como Compilar e Executar o Audio Streaming Service

## Pré-requisitos

1. **.NET 8 SDK** - Baixe em: https://dotnet.microsoft.com/download/dotnet/8.0
2. **Visual Studio 2022** (opcional, mas recomendado) ou **Visual Studio Code** com extensão C#

## Compilação

### Opção 1: Via linha de comando

```powershell
cd audio-streaming-service
dotnet restore
dotnet build
```

### Opção 2: Via Visual Studio

1. Abra `AudioStreamingService.csproj` no Visual Studio
2. Clique em "Build" > "Build Solution" (ou pressione `Ctrl+Shift+B`)

## Execução

### Desenvolvimento

```powershell
dotnet run
```

### Produção (executável standalone)

```powershell
dotnet publish -c Release -r win-x64 --self-contained
```

O executável estará em: `bin/Release/net8.0-windows/win-x64/publish/AudioStreamingService.exe`

## Primeira Execução

1. Execute o programa
2. Um ícone aparecerá na bandeja do sistema (system tray)
3. Clique com o botão direito no ícone
4. Selecione "Selecionar Dispositivo" para escolher o dispositivo de áudio
5. Selecione "Iniciar Streaming" para começar a captura

## Configuração

O serviço se conecta automaticamente ao backend em:
- `ws://localhost:8000/api/ws/audio-stream`

Para alterar a URL, edite `Program.cs` linha 43.

## Troubleshooting

### Erro: "NAudio não encontrado"
```powershell
dotnet restore
```

### Erro: "WebSocketSharp não encontrado"
```powershell
dotnet restore
```

### O programa não aparece na bandeja
- Verifique se há um ícone oculto na área de notificações
- Clique na seta "^" para mostrar ícones ocultos

### Áudio não está sendo capturado
1. Verifique se o dispositivo de áudio está selecionado
2. Teste o dispositivo usando "Selecionar Dispositivo" > "Testar"
3. Verifique se o backend está rodando em `http://localhost:8000`

## Próximos Passos

1. Criar instalador (setup.exe) usando WiX ou Inno Setup
2. Adicionar auto-start com Windows
3. Melhorar resampling de áudio (atualmente básico)
4. Adicionar logs para debug




