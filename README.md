# Ultra Assistant

Local-first AI Assistant for meetings, integrating real-time transcription, context-aware reasoning (Gemini), and workspace management (Supabase/Drive).

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** >= 16.x ([Download](https://nodejs.org/))
- **Python** >= 3.8 ([Download](https://www.python.org/downloads/))
- **FFmpeg** (instalado automaticamente pelo setup ou via `winget install ffmpeg`)
- **Git** ([Download](https://git-scm.com/))

## 🚀 Quick Start

### 1. Clonar o Repositório

```bash
git clone <repository-url>
cd ULTRA_IA_ASSISTANT
```

### 2. Setup Automático (Recomendado)

Execute o script de setup que instala todas as dependências automaticamente:

```powershell
# Windows PowerShell
.\setup.ps1
```

Ou via npm:
```bash
npm run setup
```

O script irá:
- ✅ Instalar FFmpeg via winget (se necessário)
- ✅ Verificar Node.js e Python
- ✅ Instalar dependências do frontend (npm install)
- ✅ Instalar dependências do backend (pip install)
- ✅ Criar ambiente virtual Python
- ✅ Verificar configuração

### 3. Configurar Variáveis de Ambiente

#### Backend

1. Copie o arquivo de exemplo:
   ```bash
   cd src/backend
   copy .env.example .env
   # Ou no Linux/Mac: cp .env.example .env
   ```

2. Edite o arquivo `.env` e preencha com suas credenciais:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_JWT_SECRET=your-supabase-jwt-secret
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=your-qdrant-api-key
   GEMINI_API_KEY=your-gemini-api-key
   ASSEMBLYAI_API_KEY=your-assemblyai-api-key
   GOOGLE_CLIENT_SECRET_PATH=./client_secret.json
   ```

   **Onde obter as credenciais:**
   - **Supabase**: [Dashboard do Projeto](https://app.supabase.com) → Settings → API
   - **Qdrant**: [Qdrant Cloud](https://cloud.qdrant.io) ou instale localmente
   - **Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **AssemblyAI**: [Dashboard](https://www.assemblyai.com/app/account)
   - **Google OAuth**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

3. Baixe o arquivo `client_secret.json` do Google Cloud Console e coloque em `src/backend/`

#### Frontend (Opcional)

O frontend funciona com valores padrão. Se precisar configurar URLs customizadas:

```bash
cd src/frontend
copy .env.example .env.local
# Ou no Linux/Mac: cp .env.example .env.local
```

Edite `.env.local` se necessário (geralmente não é necessário para desenvolvimento local).

### 4. Iniciar Ambiente de Desenvolvimento

Após o setup, inicie todos os serviços:

```powershell
# Opção 1: Script interativo (recomendado)
.\start-dev.ps1

# Opção 2: Via npm
npm run start:dev
```

Ou inicie manualmente em terminais separados:

1.  **Backend**:
    ```bash
    cd src/backend
    # Ativar venv (criado automaticamente pelo setup)
    .venv\Scripts\Activate.ps1  # Windows PowerShell
    # ou: source .venv/bin/activate  # Linux/Mac
    python main.py
    ```
    O backend estará disponível em `http://localhost:8000`

2.  **Frontend**:
    ```bash
    cd src/frontend
    npm run dev
    ```
    O frontend estará disponível em `http://localhost:5999`

3.  **Electron** (Opcional):
    ```bash
    npm run build:electron
    npm run dev:electron
    ```

## 📁 Project Structure

```
ULTRA_IA_ASSISTANT/
├── src/
│   ├── backend/          # Python FastAPI backend
│   │   ├── .env          # Variáveis de ambiente (NÃO versionar!)
│   │   ├── .env.example  # Template de variáveis
│   │   ├── requirements.txt
│   │   └── main.py       # Entry point
│   ├── frontend/         # React + Vite frontend
│   │   ├── .env.local    # Variáveis de ambiente (NÃO versionar!)
│   │   ├── .env.example  # Template de variáveis
│   │   └── src/
│   └── electron/         # Electron desktop shell
├── docs/                 # Documentação
├── setup.ps1             # Script de setup automático
├── start-dev.ps1         # Script para iniciar todos os serviços
└── README.md             # Este arquivo
```

## 🔧 Configuração Detalhada

### Variáveis de Ambiente do Backend

Todas as variáveis necessárias estão documentadas em `src/backend/.env.example`:

- **Supabase**: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`
- **Qdrant**: `QDRANT_URL`, `QDRANT_API_KEY`
- **AI Services**: `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`, `PICOVOICE_API_KEY`
- **Google**: `GOOGLE_CLIENT_SECRET_PATH`
- **Redis** (Opcional): `REDIS_URL` ou `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
- **App**: `PORT` (default: 8000), `ENVIRONMENT` (default: development)

### Variáveis de Ambiente do Frontend

O frontend usa valores padrão que funcionam com o proxy do Vite. Se necessário, configure em `.env.local`:

- `VITE_API_BASE_URL`: URL base da API (default: `/api` para usar proxy)
- `VITE_WS_BASE_URL`: URL base do WebSocket (opcional, derivado automaticamente)

## 🐛 Troubleshooting

### Erro: "Module not found" ou "Package not found"

Execute novamente o setup:
```bash
npm run setup
```

Ou manualmente:
```bash
# Frontend
cd src/frontend
npm install

# Backend
cd src/backend
python -m venv .venv
.venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
```

### Erro: "SUPABASE_URL not set"

Certifique-se de que:
1. O arquivo `src/backend/.env` existe
2. Todas as variáveis necessárias estão preenchidas
3. O arquivo está no formato correto (sem espaços ao redor do `=`)

### Erro: "FFmpeg not found"

Instale o FFmpeg:
```powershell
winget install ffmpeg
```

Ou baixe manualmente de: https://www.gyan.dev/ffmpeg/builds/

### Porta já em uso

Se a porta 8000 (backend) ou 5999 (frontend) estiver em uso:

1. **Backend**: Altere `PORT=8000` no `.env` para outra porta (ex: `PORT=8001`)
2. **Frontend**: Altere `port: 5999` em `src/frontend/vite.config.ts`

## 📚 Documentation

- **Project Plan**: Veja `projectplan.md` para status atual e tarefas
- **Documentação Detalhada**: Veja `docs/` para guias específicos
- **Regras do Projeto**: Veja `docs/rules/` para regras de desenvolvimento

## 🔒 Segurança

⚠️ **IMPORTANTE**: Nunca faça commit de:
- Arquivos `.env` ou `.env.local`
- `client_secret.json` ou `token.json`
- Credenciais ou chaves de API
- Arquivos de log com informações sensíveis

Todos esses arquivos estão no `.gitignore` e não devem ser versionados.

## 📝 Licença

ISC

## 🤝 Contribuindo

1. Faça fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

