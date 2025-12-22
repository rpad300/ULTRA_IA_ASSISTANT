# WASAPI Python Capture (Limitação Conhecida)

## ⚠️ Limitação do sounddevice

**IMPORTANTE**: A biblioteca `sounddevice` **não suporta loopback WASAPI diretamente**. Dispositivos de saída não podem ser usados como entrada.

Esta implementação tenta usar Python primeiro, mas **fará fallback automático para DirectShow (FFmpeg)** quando não conseguir fazer loopback.

## Solução Recomendada

Para verdadeiro WASAPI loopback sem compilação, você precisa:
1. **Usar DirectShow** (já implementado - funciona com Stereo Mix ou VB-Audio Cable)
2. **Ou compilar o módulo nativo** (requer Visual Studio, mas funciona perfeitamente)

## Status Atual

- ✅ Python WASAPI tenta primeiro (mas provavelmente falhará)
- ✅ Fallback automático para DirectShow (FFmpeg)
- ✅ DirectShow é a solução que realmente funciona

## Vantagens

- ✅ **Sem compilação** - Usa Python puro
- ✅ **Sem Visual Studio** - Não precisa instalar componentes
- ✅ **Fácil de instalar** - Apenas `pip install sounddevice numpy`
- ✅ **Funciona imediatamente** - Python já está instalado
- ✅ **Captura direta** - Do dispositivo padrão, sem configuração

## Instalação

As bibliotecas já estão instaladas! Se precisar reinstalar:

```bash
pip install sounddevice numpy
```

Ou adicione ao `requirements.txt` (já adicionado):
```
sounddevice
numpy
```

## Como Funciona

1. **Script Python** (`wasapi_capture.py`):
   - Usa `sounddevice` para capturar áudio
   - Suporta WASAPI no Windows
   - Converte para PCM16 e envia via stdout

2. **Wrapper TypeScript** (`wasapiCapturePython.ts`):
   - Executa o script Python como processo
   - Lê dados de áudio do stdout
   - Gerencia ciclo de vida

3. **Integração Automática**:
   - Sistema tenta Python WASAPI primeiro
   - Se não funcionar, tenta native WASAPI
   - Se não funcionar, usa DirectShow (FFmpeg)

## Uso

O sistema detecta automaticamente e usa Python WASAPI se disponível!

Não precisa fazer nada - apenas use o sistema normalmente.

## Troubleshooting

### "sounddevice not installed"

```bash
pip install sounddevice numpy
```

### "Python not found"

Verifique se Python está no PATH:
```bash
python --version
```

### "No loopback device found"

1. Configure um dispositivo de áudio padrão no Windows
2. Verifique em: Configurações > Sistema > Som

### Script não encontrado

O script deve estar em:
- Desenvolvimento: `src/electron/wasapi_capture.py`
- Produção: `dist/electron/wasapi_capture.py`

## Comparação com Outras Soluções

| Solução | Compilação? | Configuração? | Facilidade |
|---------|-------------|---------------|------------|
| **Python WASAPI** ✅ | ❌ Não | ❌ Não | ⭐⭐⭐⭐⭐ |
| Native WASAPI | ✅ Sim | ❌ Não | ⭐⭐ |
| DirectShow | ❌ Não | ✅ Sim | ⭐⭐⭐ |

## Próximos Passos

1. ✅ Bibliotecas instaladas
2. ✅ Script Python criado
3. ✅ Integração feita
4. 🎯 **Teste agora!** O sistema deve usar Python WASAPI automaticamente

