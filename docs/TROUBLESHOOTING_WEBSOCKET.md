# Troubleshooting WebSocket Connection

## Problema: WebSocket não conecta

Se você está vendo o erro:
```
WebSocket connection failed. Please check if backend is running at ws://localhost:8000/api/ws/transcription
```

### Solução 1: Verificar se o Backend está rodando

1. **Abra um terminal** e navegue até a pasta do backend:
   ```bash
   cd src/backend
   ```

2. **Verifique se o backend está rodando**:
   - O backend deve estar rodando na porta **8000** por padrão
   - Você deve ver logs do FastAPI no terminal

3. **Se não estiver rodando, inicie o backend**:
   ```bash
   python main.py
   ```
   ou
   ```bash
   uvicorn main:app --reload --port 8000
   ```

4. **Verifique se o backend está respondendo**:
   - Abra no navegador: `http://localhost:8000/health`
   - Deve retornar: `{"status": "ok", "message": "Ultra Assistant Backend is running"}`

### Solução 2: Verificar a URL do WebSocket

A URL do WebSocket deve ser: `ws://localhost:8000/api/ws/transcription`

Se você mudou a porta do backend, atualize a variável de ambiente:
```bash
# No arquivo .env do backend
PORT=8000  # ou a porta que você está usando
```

E no frontend, crie um arquivo `.env` na raiz do projeto frontend:
```bash
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_BASE_URL=ws://localhost:8000
```

### Solução 3: Verificar Firewall/Antivírus

Alguns firewalls ou antivírus podem bloquear conexões WebSocket. Tente:
1. Desabilitar temporariamente o firewall/antivírus
2. Adicionar exceção para o backend na porta 8000

### Solução 4: Verificar CORS

O backend já está configurado para aceitar conexões de `localhost:5999`. Se você estiver usando outra porta, atualize o `main.py`:

```python
allowed_origins = [
    "http://localhost:5999",  # Sua porta do frontend
    "http://127.0.0.1:5999",
    # ...
]
```

## Problema: Erro de AudioContext

Se você está vendo:
```
Cannot read properties of null (reading 'createMediaStreamSource')
```

Isso significa que o `audioContext` foi fechado antes de ser usado. Isso geralmente acontece quando:
1. O WebSocket fecha antes de capturar o áudio
2. O usuário nega permissão do microfone

**Solução**: Certifique-se de:
1. O backend está rodando antes de iniciar a sessão
2. Permitir acesso ao microfone quando solicitado
3. Não fechar a página enquanto a sessão está iniciando

## Verificação Rápida

Execute este comando para verificar se o backend está rodando:

```bash
curl http://localhost:8000/health
```

Ou abra no navegador: `http://localhost:8000/health`

Se retornar erro de conexão, o backend não está rodando.

## Logs Úteis

No console do navegador (F12), você deve ver:
- `Connecting to WebSocket: ws://localhost:8000/api/ws/transcription`
- `Backend health check: 200` (se o backend estiver rodando)
- `WebSocket connected successfully`
- `Requesting microphone access...`
- `Microphone connected`

Se não ver esses logs, há um problema na conexão.





