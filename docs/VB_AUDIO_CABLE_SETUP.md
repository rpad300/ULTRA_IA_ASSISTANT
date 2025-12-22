# Configuração VB-Audio Cable

## Por que VB-Audio Cable?

VB-Audio Cable é mais fiável que Stereo Mix porque:
- ✅ Funciona como dispositivo virtual dedicado
- ✅ Melhor qualidade de áudio
- ✅ Mais estável e consistente
- ✅ Suportado por todas as aplicações Windows
- ✅ Não depende de drivers de placa de som

## Instalação

### Passo 1: Download
1. Aceda a: https://vb-audio.com/Cable/
2. Clique em "Download" (versão gratuita)
3. Execute o instalador

### Passo 2: Configuração (OPCIONAL - Não é necessário!)
**IMPORTANTE**: O sistema agora usa WASAPI loopback por padrão, que captura diretamente do dispositivo de saída padrão **SEM precisar mudar nenhuma configuração**. Você continua a ouvir normalmente!

**Se quiser usar VB-Audio Cable (opcional):**
1. Após instalação, abra "Configurações de Som" do Windows
2. Vá ao separador "Gravação"
3. Encontre "CABLE Output (VB-Audio Virtual Cable)"
4. Clique com botão direito → "Propriedades"
5. Aba "Níveis" → Aumente para 100%
6. Aba "Escutar" → NÃO marque "Escutar este dispositivo" (não é necessário)
7. **NÃO defina CABLE Input como dispositivo de saída padrão** - isso fará com que você deixe de ouvir o sistema!

### Passo 3: Configurar Aplicações (OPCIONAL)
**NOTA**: Com WASAPI loopback, não é necessário configurar aplicações individuais - o sistema captura automaticamente do dispositivo de saída padrão.

**Se quiser usar VB-Audio Cable para uma aplicação específica:**
1. Abra a aplicação (Zoom, Teams, Spotify, etc.)
2. Nas configurações de áudio da aplicação, selecione "CABLE Input" como dispositivo de saída
3. O sistema detectará automaticamente "CABLE Output" como dispositivo de loopback

### Passo 4: Verificar no Sistema
O sistema Ultra IA Assistant detectará automaticamente "CABLE Output" como dispositivo de loopback e dará prioridade sobre Stereo Mix.

## Troubleshooting

### O sistema não detecta VB-Audio Cable
1. Verifique se está instalado: "Configurações de Som" → "Gravação" → deve aparecer "CABLE Output"
2. Reinicie o Electron após instalação
3. Verifique os logs do Electron para ver se o dispositivo foi detectado

### Áudio muito baixo
1. Verifique o volume do "CABLE Output" nas propriedades (deve estar a 100%)
2. Verifique o volume do sistema Windows
3. Verifique o volume da aplicação que está a tocar áudio

### Feedback/Loop de áudio
- Certifique-se de que "Escutar este dispositivo" está DESMARCADO no "CABLE Output"
- **NÃO defina "CABLE Input" como dispositivo de reprodução padrão** - isso fará com que você deixe de ouvir o sistema!
- Se isso acontecer, volte a definir o seu dispositivo de áudio normal (altifalantes/auscultadores) como padrão

### Solução Recomendada: Usar WASAPI Loopback (Padrão)
O sistema agora usa **WASAPI loopback** por padrão, que:
- ✅ Captura diretamente do dispositivo de saída padrão
- ✅ **NÃO precisa mudar nenhuma configuração**
- ✅ Você continua a ouvir normalmente
- ✅ Funciona com todas as aplicações automaticamente
- ✅ Mais fiável que Stereo Mix ou VB-Audio Cable

**VB-Audio Cable só é necessário se WASAPI loopback não funcionar no seu sistema.**


