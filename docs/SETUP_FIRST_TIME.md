# Guia de Setup - Primeira Vez

Este guia detalha todos os passos necessários para configurar o projeto pela primeira vez em um novo computador.

## 📋 Checklist de Setup

### 1. Pré-requisitos Instalados

- [ ] Node.js >= 16.x
- [ ] Python >= 3.8
- [ ] FFmpeg (instalado automaticamente pelo setup ou manualmente)
- [ ] Git

### 2. Clonar e Configurar

```bash
# 1. Clonar o repositório
git clone <repository-url>
cd ULTRA_IA_ASSISTANT

# 2. Executar setup automático
.\setup.ps1
# ou: npm run setup
```

### 3. Arquivos de Configuração Necessários

#### 3.1. Backend `.env`

**Localização**: `src/backend/.env`

**Como criar**:
```bash
cd src/backend
copy .env.example .env
# Ou no Linux/Mac: cp .env.example .env
```

**Variáveis obrigatórias** (preencha todas):
- `SUPABASE_URL` - URL do seu projeto Supabase
- `SUPABASE_KEY` - Chave anon do Supabase
- `SUPABASE_JWT_SECRET` - JWT Secret do Supabase
- `QDRANT_URL` - URL do Qdrant (local ou cloud)
- `QDRANT_API_KEY` - API Key do Qdrant
- `GEMINI_API_KEY` - Chave da API do Google Gemini
- `ASSEMBLYAI_API_KEY` - Chave da API do AssemblyAI
- `GOOGLE_CLIENT_SECRET_PATH` - Caminho para `client_secret.json` (geralmente `./client_secret.json`)

**Variáveis opcionais**:
- `PORT` - Porta do backend (default: 8000)
- `ENVIRONMENT` - Ambiente (default: development)
- `PICOVOICE_API_KEY` - Para reconhecimento de voz (opcional)
- `REDIS_URL` - Para cache Redis (opcional)
- `HF_TOKEN` - Token do HuggingFace (opcional)

#### 3.2. Google OAuth `client_secret.json`

**Localização**: `src/backend/client_secret.json`

**Como obter**:
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Vá para **APIs & Services** → **Credentials**
4. Clique em **Create Credentials** → **OAuth client ID**
5. Configure o tipo de aplicativo (Desktop app ou Web application)
6. Baixe o arquivo JSON
7. Renomeie para `client_secret.json` e coloque em `src/backend/`

**⚠️ IMPORTANTE**: Este arquivo contém credenciais sensíveis e está no `.gitignore`. Nunca faça commit deste arquivo!

#### 3.3. Frontend `.env.local` (Opcional)

**Localização**: `src/frontend/.env.local`

**Quando necessário**: Apenas se precisar configurar URLs customizadas (geralmente não é necessário para desenvolvimento local).

**Como criar**:
```bash
cd src/frontend
copy .env.example .env.local
# Ou no Linux/Mac: cp .env.example .env.local
```

**Variáveis**:
- `VITE_API_BASE_URL` - URL base da API (deixe vazio para usar proxy padrão)
- `VITE_WS_BASE_URL` - URL base do WebSocket (opcional)

### 4. Arquivos Criados Automaticamente

Estes arquivos são criados automaticamente pelo sistema quando necessário:

- **`src/backend/settings.json`**: Configurações da aplicação (criado automaticamente pelo `SettingsService`)
- **`src/backend/token.json`**: Token de autenticação do Google OAuth (criado após primeira autenticação)

**⚠️ IMPORTANTE**: Estes arquivos também estão no `.gitignore` e não devem ser versionados.

### 5. Verificar Instalação

Após configurar tudo, verifique se está tudo funcionando:

```bash
# 1. Verificar backend
cd src/backend
.venv\Scripts\Activate.ps1  # Windows
python -c "from config import *; print('Config OK')"

# 2. Verificar frontend
cd src/frontend
npm list --depth=0
```

### 6. Iniciar o Projeto

```bash
# Opção 1: Script interativo
.\start-dev.ps1

# Opção 2: Manual (3 terminais)
# Terminal 1 - Backend
cd src/backend
.venv\Scripts\Activate.ps1
python main.py

# Terminal 2 - Frontend
cd src/frontend
npm run dev

# Terminal 3 - Electron (opcional)
npm run build:electron
npm run dev:electron
```

## 🔍 Verificação de Problemas Comuns

### Erro: "SUPABASE_URL not set"
- Verifique se o arquivo `src/backend/.env` existe
- Verifique se todas as variáveis estão preenchidas
- Verifique se não há espaços ao redor do `=` no arquivo `.env`

### Erro: "client_secret.json not found"
- Baixe o arquivo do Google Cloud Console
- Coloque em `src/backend/client_secret.json`
- Verifique se o caminho em `GOOGLE_CLIENT_SECRET_PATH` está correto

### Erro: "Module not found"
- Execute `npm run setup` novamente
- Ou reinstale manualmente:
  ```bash
  # Frontend
  cd src/frontend && npm install
  
  # Backend
  cd src/backend
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  ```

### Erro: "Port already in use"
- Altere a porta no `.env` (backend) ou `vite.config.ts` (frontend)
- Ou pare os processos que estão usando as portas:
  ```powershell
  # Windows
  netstat -ano | findstr :8000
  taskkill /PID <PID> /F
  ```

## 📝 Notas Importantes

1. **Nunca faça commit de**:
   - Arquivos `.env` ou `.env.local`
   - `client_secret.json`
   - `token.json`
   - `settings.json`
   - Arquivos de log

2. **Todos estes arquivos estão no `.gitignore`** e serão ignorados automaticamente pelo Git.

3. **Após clonar em um novo PC**, você precisará:
   - Executar `.\setup.ps1`
   - Criar `src/backend/.env` a partir de `.env.example`
   - Baixar `client_secret.json` do Google Cloud Console
   - Preencher todas as variáveis de ambiente

4. **O `settings.json` é criado automaticamente** na primeira execução com valores padrão.

