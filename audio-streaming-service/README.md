# Audio Streaming Service

Serviço dedicado para captura e streaming de áudio do sistema via WASAPI.

## Características

- ✅ **Captura WASAPI nativa** - Sem dependências (FFmpeg, DirectShow)
- ✅ **Streaming WebSocket** - Conecta diretamente ao backend
- ✅ **Interface simples** - Tray icon com menu de contexto
- ✅ **Seleção de dispositivos** - Lista todos os dispositivos disponíveis
- ✅ **Baixa latência** - Streaming em tempo real
- ✅ **Roda em background** - Serviço Windows ou processo

## Pré-requisitos

- **.NET 8 SDK** - Será instalado automaticamente pelo script de setup
- **Windows 10/11** - Requerido para WASAPI

## Instalação Rápida

### Opção 1: Script Automático (Recomendado)

```powershell
cd audio-streaming-service
.\setup.ps1
```

O script irá:
1. Verificar se .NET está instalado
2. Instalar .NET 8 SDK automaticamente (se necessário)
3. Restaurar dependências
4. Compilar o projeto

### Opção 2: Instalação Manual

1. **Instalar .NET 8 SDK:**
   ```powershell
   # Via winget
   winget install Microsoft.DotNet.SDK.8
   
   # Ou baixe manualmente em:
   # https://dotnet.microsoft.com/download/dotnet/8.0
   ```

2. **Fechar e reabrir o PowerShell** (para carregar o PATH)

3. **Compilar o projeto:**
   ```powershell
   cd audio-streaming-service
   dotnet restore
   dotnet build
   ```

## Execução

### Opção 1: Script Automático (Recomendado)

**Desenvolvimento:**
```powershell
.\run.ps1
```

**Produção (criar executável):**
```powershell
.\publish.ps1
```

O executável estará em: `bin\Release\net8.0-windows\win-x64\publish\AudioStreamingService.exe`

### Opção 2: Comandos Manuais

**Desenvolvimento:**
```powershell
# Atualizar PATH primeiro
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
dotnet run
```

**Produção:**
```powershell
# Atualizar PATH primeiro
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
dotnet publish -c Release -r win-x64 --self-contained
```

## Uso

1. Execute o programa (`dotnet run` ou o executável)
2. Um ícone aparecerá na bandeja do sistema (system tray)
3. Clique com o botão direito no ícone
4. Selecione **"Selecionar Dispositivo"** para escolher o dispositivo de áudio
5. Teste o dispositivo usando o botão "Testar" na janela
6. Selecione **"Iniciar Streaming"** para começar a captura

## Configuração

O serviço se conecta automaticamente ao backend em:
- `ws://localhost:8000/api/ws/audio-stream`

Para alterar a URL, edite `Program.cs` linha 43.

## Troubleshooting

### Erro: "dotnet não é reconhecido"
- Execute `.\setup.ps1` para instalar .NET automaticamente
- Ou instale manualmente: https://dotnet.microsoft.com/download/dotnet/8.0
- **Importante:** Feche e reabra o PowerShell após instalar

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
4. Verifique os logs no console

## Tecnologias

- **C# / .NET 8** - Para acesso nativo ao WASAPI
- **NAudio** - Biblioteca para captura de áudio
- **WebSocketSharp** - Cliente WebSocket

## Status

✅ **Implementado** - Pronto para uso e testes

