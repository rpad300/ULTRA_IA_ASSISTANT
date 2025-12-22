# Troubleshooting - Captura de Áudio do Sistema

## Erro: FFmpeg exited with code 4294967291

Este erro (código -5 em complemento de dois) geralmente indica que o FFmpeg não conseguiu acessar o dispositivo de áudio DirectShow.

### Possíveis Causas e Soluções

#### 1. Dispositivo "Stereo Mix" não está ativado

**Sintoma**: Erro `FFmpeg exited with code 4294967291` ou `Device not found`

**Solução**:
1. Abra as Configurações do Windows
2. Vá em: **Sistema > Som > Configurações de som**
3. Clique em **Gravação** (ou **Recording**)
4. Clique com botão direito na área de dispositivos
5. Selecione **Mostrar dispositivos desabilitados**
6. Encontre **"Stereo Mix"** ou **"What U Hear"**
7. Clique com botão direito e selecione **Ativar**
8. Se não aparecer, pode ser que seu driver de áudio não suporte loopback

#### 2. Dispositivo já está em uso

**Sintoma**: Erro `Device is busy` ou `already in use`

**Solução**:
1. Feche outros aplicativos que possam estar usando o dispositivo de áudio
2. Verifique se há outras instâncias do Electron rodando
3. Reinicie o Electron

#### 3. Permissões insuficientes

**Sintoma**: Erro `Permission denied` ou `Access denied`

**Solução**:
1. Execute o Electron como Administrador (temporariamente para teste)
2. Verifique as configurações de privacidade do Windows:
   - Configurações > Privacidade > Microfone
   - Certifique-se de que o Electron tem permissão

#### 4. FFmpeg não encontrou o dispositivo

**Sintoma**: Logs mostram "Could not find DirectShow device"

**Solução**:
1. Verifique se o FFmpeg está instalado: `ffmpeg -version`
2. Liste os dispositivos disponíveis:
   ```powershell
   ffmpeg -f dshow -list_devices true -i dummy
   ```
3. Verifique se "Stereo Mix" aparece na lista
4. Se não aparecer, seu driver de áudio pode não suportar loopback

#### 5. Driver de áudio não suporta loopback

**Sintoma**: Nenhum dispositivo de loopback aparece na lista

**Solução**:
1. Atualize os drivers de áudio
2. Alguns drivers não suportam "Stereo Mix" nativamente
3. Considere usar um driver virtual como:
   - **VB-Audio Cable** (gratuito)
   - **Voicemeeter** (gratuito)
   - **BlackHole** (macOS)

## Verificar Dispositivos Disponíveis

Para ver quais dispositivos de áudio estão disponíveis:

```powershell
ffmpeg -f dshow -list_devices true -i dummy
```

Procure por dispositivos com "(audio)" na saída. Dispositivos de loopback geralmente têm nomes como:
- "Stereo Mix"
- "What U Hear"
- "Wave Out Mix"
- "Loopback"

## Logs de Debug

O sistema agora registra logs detalhados no console do Electron. Para ver os logs:

1. Abra o DevTools do Electron (F12 ou menu)
2. Vá para a aba Console
3. Procure por mensagens que começam com `[SystemAudioCapture]`

Os logs incluem:
- Dispositivos encontrados
- Comando FFmpeg completo
- Mensagens de erro do FFmpeg
- Código de saída detalhado

## Teste Manual do FFmpeg

Para testar se o FFmpeg consegue capturar áudio manualmente:

```powershell
# Substitua "Stereo Mix" pelo nome exato do seu dispositivo
ffmpeg -f dshow -i audio="Stereo Mix" -ar 16000 -ac 1 -f s16le test.raw
```

Se isso funcionar, o problema pode estar na forma como o Electron está chamando o FFmpeg.

## Solução Alternativa: Usar VB-Audio Cable

Se seu driver não suporta "Stereo Mix":

1. Baixe e instale **VB-Audio Cable**: https://vb-audio.com/Cable/
2. Configure seu sistema para usar "CABLE Input" como saída de áudio
3. Configure o Electron para capturar de "CABLE Output"
4. Isso cria um loopback virtual que funciona em qualquer sistema

## Contato

Se nenhuma das soluções acima funcionar, verifique:
1. Versão do FFmpeg: `ffmpeg -version`
2. Versão do Windows
3. Driver de áudio instalado
4. Logs completos do Electron





