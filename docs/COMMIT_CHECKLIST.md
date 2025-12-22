# Checklist para Commit no GitHub

Este documento lista tudo que foi verificado e configurado para garantir que o projeto funcione após clonar em outro PC.

## ✅ Verificações Realizadas

### 1. Arquivos de Configuração

- [x] **`.gitignore`** atualizado com:
  - Arquivos `.env` e `.env.local`
  - Credenciais (`client_secret.json`, `token.json`)
  - Arquivos de log
  - Arquivos temporários e de build
  - Modelos ML grandes
  - Arquivos de configuração sensíveis

- [x] **`src/backend/.env.example`** existe e está completo com:
  - Todas as variáveis de ambiente necessárias
  - Comentários explicativos
  - Valores de exemplo
  - Instruções de onde obter cada credencial

- [x] **`src/frontend/.env.example`** criado (opcional, mas documentado)

### 2. Documentação

- [x] **`README.md`** atualizado com:
  - Pré-requisitos claros
  - Instruções passo a passo de setup
  - Onde obter cada credencial
  - Troubleshooting comum
  - Estrutura do projeto

- [x] **`docs/SETUP_FIRST_TIME.md`** criado com:
  - Checklist completo de setup
  - Detalhes de cada arquivo de configuração
  - Como obter credenciais
  - Verificação de problemas comuns

### 3. Scripts de Setup

- [x] **`setup.ps1`** verifica e cria:
  - Ambiente virtual Python
  - Instala dependências do backend
  - Instala dependências do frontend
  - Verifica arquivos `.env`

- [x] **`start-dev.ps1`** disponível para iniciar todos os serviços

### 4. Dependências

- [x] **`src/backend/requirements.txt`** contém todas as dependências Python
- [x] **`src/frontend/package.json`** contém todas as dependências Node.js
- [x] **`package.json`** raiz contém scripts de setup e start

## 📝 Antes de Fazer Commit

### Verificar que NÃO está commitando:

```bash
# Verificar status do Git
git status

# Verificar se arquivos sensíveis estão sendo rastreados
git ls-files | grep -E "\.env$|client_secret|token\.json|settings\.json"
```

**Se algum arquivo sensível aparecer, adicione ao `.gitignore` e remova do tracking:**
```bash
git rm --cached src/backend/.env
git rm --cached src/backend/client_secret.json
# etc.
```

### Arquivos que DEVEM estar no commit:

- ✅ `.gitignore`
- ✅ `README.md`
- ✅ `src/backend/.env.example`
- ✅ `src/frontend/.env.example` (se criado)
- ✅ `src/backend/requirements.txt`
- ✅ `src/frontend/package.json`
- ✅ `package.json` (raiz)
- ✅ `setup.ps1`
- ✅ `start-dev.ps1`
- ✅ `docs/SETUP_FIRST_TIME.md`
- ✅ Todos os arquivos de código fonte

### Arquivos que NÃO DEVEM estar no commit:

- ❌ Qualquer arquivo `.env` ou `.env.local`
- ❌ `client_secret.json` ou `client_secret_*.json`
- ❌ `token.json`
- ❌ `settings.json`
- ❌ Arquivos de log (`*.log`)
- ❌ `node_modules/`
- ❌ `.venv/` ou `venv/`
- ❌ Arquivos de build (`dist/`, `build/`)
- ❌ Arquivos temporários

## 🚀 Comandos para Commit

```bash
# 1. Verificar status
git status

# 2. Adicionar arquivos (Git vai ignorar automaticamente os arquivos no .gitignore)
git add .

# 3. Verificar o que será commitado
git status

# 4. Fazer commit
git commit -m "feat: prepare project for GitHub - add .env.example, update .gitignore and documentation"

# 5. Push para GitHub
git push origin main
# ou
git push origin master
```

## ✅ Teste em Outro PC

Após fazer push, teste clonando em outro PC:

```bash
# 1. Clonar
git clone <repository-url>
cd ULTRA_IA_ASSISTANT

# 2. Executar setup
.\setup.ps1

# 3. Criar .env
cd src/backend
copy .env.example .env
# Editar .env com suas credenciais

# 4. Baixar client_secret.json do Google Cloud Console
# Colocar em src/backend/client_secret.json

# 5. Iniciar
cd ../..
.\start-dev.ps1
```

Se tudo funcionar, o setup está completo! ✅

## 🔍 Verificação Final

Antes de fazer commit, execute:

```powershell
# Verificar se .env.example existe
Test-Path src/backend/.env.example

# Verificar se .gitignore está correto
Get-Content .gitignore | Select-String "\.env"

# Verificar se não há arquivos sensíveis sendo rastreados
git ls-files | Select-String -Pattern "\.env$|client_secret|token\.json"
```

Se o último comando retornar algo, remova esses arquivos do tracking antes de commitar!

