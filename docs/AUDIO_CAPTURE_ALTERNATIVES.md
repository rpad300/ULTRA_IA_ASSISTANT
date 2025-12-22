# Alternativas para Captura de Áudio do Sistema

## Problema Atual
O Stereo Mix via DirectShow/FFmpeg está a capturar mas com níveis muito baixos, mesmo com volume a 100%.

## Alternativas Recomendadas

### 1. VB-Audio Cable (RECOMENDADO - Mais Fiável)
**Vantagens:**
- Mais estável que Stereo Mix
- Funciona como dispositivo virtual de áudio
- Melhor qualidade de captura
- Suportado por todas as aplicações

**Instalação:**
1. Download: https://vb-audio.com/Cable/
2. Instalar VB-Audio Cable
3. Configurar como dispositivo de saída padrão OU usar como "What U Hear"
4. O sistema detectará automaticamente como "CABLE Input"

**Uso:**
- Configure o sistema para usar "CABLE Input" como dispositivo de gravação
- Todas as aplicações que usam o dispositivo padrão serão capturadas

### 2. WASAPI Loopback (NÃO DISPONÍVEL)
**Status:** WASAPI ainda não está implementado no FFmpeg
- Ticket aberto desde 2020: https://fftrac-bg.ffmpeg.org/ticket/9408
- Ainda está como "wish" (desejo) e não foi implementado
- Não é possível usar WASAPI com FFmpeg atualmente

**Alternativas futuras:**
- Quando WASAPI for implementado no FFmpeg, será a solução ideal
- Até lá, DirectShow é a única opção viável com FFmpeg

### 3. OBS Virtual Audio Cable
**Vantagens:**
- Solução profissional
- Múltiplos canais virtuais
- Alta qualidade

**Desvantagens:**
- Mais complexo de configurar
- Pode requerer licença para uso comercial

## Recomendação Imediata

**Para resolver rapidamente:**
1. Instalar VB-Audio Cable (gratuito)
2. Configurar como dispositivo de saída padrão
3. O sistema detectará automaticamente como dispositivo de loopback

**Para solução a longo prazo:**
- Aguardar implementação de WASAPI no FFmpeg (ticket #9408)
- Quando disponível, WASAPI será a solução ideal (sem necessidade de configuração)


