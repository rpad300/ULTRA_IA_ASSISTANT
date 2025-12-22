# Guia de Setup Automático - Ultra Assistant

## Setup Completo em Um Comando

Execute o script de setup que instala **tudo automaticamente**:

```powershell
.\setup.ps1
```

Ou via npm:
```bash
npm run setup
```

## O que o Script Faz

O script `setup.ps1` instala e configura automaticamente:

1. ✅ **FFmpeg** - Via winget (se não estiver instalado)
2. ✅ **Node.js** - Verifica se está instalado
3. ✅ **Python** - Verifica se está instalado
4. ✅ **Dependências do Frontend** - Executa `npm install`
5. ✅ **Dependências do Backend** - Cria venv e executa `pip install`
6. ✅ **Configuração** - Verifica arquivos `.env`

## Iniciar Ambiente de Desenvolvimento

Após o setup, inicie todos os serviços:

### Opção 1: Script Interativo (Recomendado)

```powershell
.\start-dev.ps1
```

O script oferece opções:
- **Opção 1**: Inicia tudo em janelas separadas (Backend, Frontend, Electron)
- **Opção 2**: Apenas Backend
- **Opção 3**: Apenas Frontend
- **Opção 4**: Apenas Electron

### Opção 2: Via npm

```bash
npm run start:dev
```

### Opção 3: Manual

**Terminal 1 - Backend:**
```powershell
cd src/backend
.venv\Scripts\Activate.ps1
python main.py
```

**Terminal 2 - Frontend:**
```powershell
cd src/frontend
npm run dev
```

**Terminal 3 - Electron:**
```powershell
npm run build:electron
npm run dev:electron
```

## Requisitos

- **Windows 10/11** com PowerShell 5.1+
- **winget** (geralmente já incluído no Windows 10/11)
- **Node.js** >= 16 (instalado manualmente se necessário)
- **Python** >= 3.8 (instalado manualmente se necessário)

## Troubleshooting

### FFmpeg não encontrado após instalação

Se o FFmpeg foi instalado mas não é encontrado:
1. Feche e reabra o terminal
2. Execute `.\setup.ps1` novamente
3. Ou adicione manualmente ao PATH

### Erro de permissão no PowerShell

Se receber erro de política de execução:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Dependências não instaladas

Se alguma dependência falhar:
1. Verifique a conexão com a internet
2. Execute `.\setup.ps1` novamente
3. Para backend: `cd src/backend && pip install -r requirements.txt`
4. Para frontend: `cd src/frontend && npm install`

## URLs dos Serviços

Após iniciar todos os serviços:
- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:5999
- **Electron**: Abre automaticamente

## Próximos Passos

1. Configure o arquivo `.env` em `src/backend/.env` com suas chaves de API
2. Execute `.\setup.ps1` para garantir que tudo está instalado
3. Execute `.\start-dev.ps1` para iniciar o ambiente de desenvolvimento





