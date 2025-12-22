import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMeetingStore } from '@/store/meetingStore';
import { Settings, Volume2, Server, Wifi, WifiOff, AlertCircle, Play, Square, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AudioDeviceSelector() {
  const {
    selectedSystemAudioDevice,
    setSelectedSystemAudioDevice,
    selectedMicrophoneDevice,
    setSelectedMicrophoneDevice,
    getAudioServiceDevices,
    setAudioServiceDevice,
    audioServiceDevices,
    audioServiceStatus,
    getAudioServiceStatus,
    startAudioService,
    stopAudioService
  } = useMeetingStore();

  const [devices, setDevices] = useState<Array<{ name: string; altName?: string; type: 'loopback' | 'input' | 'output' }>>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [serviceStatusLoading, setServiceStatusLoading] = useState(false);
  const [streamingLoading, setStreamingLoading] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    try {
      console.log('Loading audio devices from C# Audio Service...');

      const csharpDevices = await getAudioServiceDevices();
      if (csharpDevices && (csharpDevices.microphones.length > 0 || csharpDevices.speakers.length > 0)) {
        // Convert C# service devices to our format
        const mics = csharpDevices.microphones.map((d: { id: string; name: string }) => ({
          name: d.name,
          altName: d.id,
          type: 'input' as const
        }));

        const speakers = csharpDevices.speakers.map((d: { id: string; name: string }) => ({
          name: d.name,
          altName: d.id,
          type: 'loopback' as const
        }));

        const convertedDevices = [...mics, ...speakers];
        console.log('Received C# service devices:', convertedDevices);
        setDevices(convertedDevices);
      } else {
        setDevices([]);
      }
    } catch (error) {
      console.error('Error loading audio devices from C# service:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDevices();
      loadServiceStatus();
    }
  }, [open]);

  const loadServiceStatus = async () => {
    setServiceStatusLoading(true);
    try {
      await getAudioServiceStatus();
    } catch (error) {
      // Service might not be running, ignore
    } finally {
      setServiceStatusLoading(false);
    }
  };

  const handleSystemAudioDeviceChange = async (deviceName: string) => {
    // Convert special value back to null for auto-detection
    if (deviceName === '__auto__') {
      setSelectedSystemAudioDevice(null);
    } else {
      setSelectedSystemAudioDevice(deviceName);

      // If C# Audio Service is available, set the device there too
      if (audioServiceDevices) {
        // Find device ID by name
        const allDevices = [...audioServiceDevices.microphones, ...audioServiceDevices.speakers];
        const device = allDevices.find(d => d.name === deviceName || d.id === deviceName);
        if (device) {
          try {
            await setAudioServiceDevice(device.id);
          } catch (error) {
            console.error('Error setting device in C# service:', error);
          }
        }
      }
    }
  };

  const handleMicrophoneDeviceChange = (deviceName: string) => {
    // Convert special value back to null for auto-detection
    if (deviceName === '__auto__') {
      setSelectedMicrophoneDevice(null);
    } else {
      setSelectedMicrophoneDevice(deviceName);
    }
  };

  // Group devices by type
  const loopbackDevices = devices.filter(d => d.type === 'loopback'); // System audio (Render)
  const inputDevices = devices.filter(d => d.type === 'input'); // Microphones (Capture)
  // outputDevices removed as it was unused
  // System audio devices = loopback (render) devices
  const systemAudioDevices = loopbackDevices;
  // Microphone devices = input (capture) devices
  const microphoneDevices = inputDevices;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setOpen(true)}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Dispositivo de Áudio</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Configuração de Dispositivos de Áudio
          </DialogTitle>
          <DialogDescription>
            Selecione os dispositivos para captura de áudio do sistema e microfone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Carregando dispositivos...
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Nenhum dispositivo encontrado. Certifique-se de que o serviço de áudio C# está rodando.
            </div>
          ) : (
            <>
              {/* System Audio Device Selector */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-blue-500" />
                  Dispositivo de Áudio do Sistema
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Captura o som que está sendo reproduzido pelo computador (música, vídeos, chamadas).
                </p>
                <Select
                  value={selectedSystemAudioDevice || '__auto__'}
                  onValueChange={handleSystemAudioDeviceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um dispositivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto-detecção</SelectItem>
                    {systemAudioDevices.map((device) => (
                      <SelectItem key={device.altName || device.name} value={device.altName || device.name}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSystemAudioDevice && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ Selecionado: {systemAudioDevices.find(d => d.altName === selectedSystemAudioDevice || d.name === selectedSystemAudioDevice)?.name || selectedSystemAudioDevice}
                  </p>
                )}
              </div>

              {/* Microphone Device Selector */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mic className="h-4 w-4 text-green-500" />
                  Dispositivo de Microfone
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Captura sua voz para transcrição.
                </p>
                <Select
                  value={selectedMicrophoneDevice || '__auto__'}
                  onValueChange={handleMicrophoneDeviceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um microfone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Padrão do Sistema / Default (Auto)</SelectItem>
                    {microphoneDevices.map((device) => (
                      <SelectItem key={device.altName || device.name} value={device.altName || device.name}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMicrophoneDevice && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ Selecionado: {microphoneDevices.find(d => d.altName === selectedMicrophoneDevice || d.name === selectedMicrophoneDevice)?.name || selectedMicrophoneDevice}
                  </p>
                )}
              </div>

              <div className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
                <p><strong>💡 Dica:</strong> Para capturar áudio do sistema (como chamadas de vídeo), selecione um dispositivo de loopback como "Stereo Mix" ou o dispositivo de saída do seu monitor/alto-falante.</p>
              </div>
            </>
          )}

          <div className="border-t border-border" />

          {/* Configurações da Aplicação Local */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Configurações da Aplicação Local</h3>
            </div>

            <div className="space-y-2 text-sm">
              {/* Status do Serviço C# */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  {audioServiceStatus ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">Serviço de Áudio (C#)</span>
                </div>
                <Badge
                  variant={audioServiceStatus ? "default" : "secondary"}
                  className={cn(
                    audioServiceStatus && "bg-green-500/10 text-green-500 border-green-500/20"
                  )}
                >
                  {audioServiceStatus ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              {/* Status de Conexão AssemblyAI */}
              {audioServiceStatus && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    {audioServiceStatus.isAssemblyAIConnected ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">Conexão AssemblyAI</span>
                  </div>
                  <Badge
                    variant={audioServiceStatus.isAssemblyAIConnected ? "default" : "secondary"}
                    className={cn(
                      audioServiceStatus.isAssemblyAIConnected && "bg-green-500/10 text-green-500 border-green-500/20"
                    )}
                  >
                    {audioServiceStatus.isAssemblyAIConnected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
              )}

              {/* Status de Conexão Backend */}
              {audioServiceStatus && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    {audioServiceStatus.isBackendConnected ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">Conexão Backend</span>
                  </div>
                  <Badge
                    variant={audioServiceStatus.isBackendConnected ? "default" : "secondary"}
                    className={cn(
                      audioServiceStatus.isBackendConnected && "bg-green-500/10 text-green-500 border-green-500/20"
                    )}
                  >
                    {audioServiceStatus.isBackendConnected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
              )}

              {/* Status de Captura com Controles */}
              {audioServiceStatus && (
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Streaming de Áudio</span>
                    </div>
                    <Badge
                      variant={audioServiceStatus.isCapturing ? "default" : "secondary"}
                      className={cn(
                        audioServiceStatus.isCapturing && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}
                    >
                      {audioServiceStatus.isCapturing ? "Ativo" : "Parado"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {audioServiceStatus.isCapturing ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 gap-2"
                        disabled={streamingLoading}
                        onClick={async () => {
                          setStreamingLoading(true);
                          try {
                            await stopAudioService();
                            await loadServiceStatus();
                          } catch (error) {
                            console.error('Error stopping streaming:', error);
                          } finally {
                            setStreamingLoading(false);
                          }
                        }}
                      >
                        <Square className="h-4 w-4" />
                        {streamingLoading ? 'Parando...' : 'Parar Streaming'}
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        disabled={streamingLoading}
                        onClick={async () => {
                          setStreamingLoading(true);
                          try {
                            await startAudioService(
                              selectedSystemAudioDevice || undefined,
                              selectedMicrophoneDevice || undefined
                            );
                            await loadServiceStatus();
                          } catch (error) {
                            console.error('Error starting streaming:', error);
                          } finally {
                            setStreamingLoading(false);
                          }
                        }}
                      >
                        <Play className="h-4 w-4" />
                        {streamingLoading ? 'Iniciando...' : 'Iniciar Streaming'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Status do Microfone */}
              {audioServiceStatus?.microphone && (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-xs">Microfone</span>
                    </div>
                    <Badge
                      variant={audioServiceStatus.microphone.detectingAudio ? "default" : "secondary"}
                      className={cn(
                        audioServiceStatus.microphone.detectingAudio && "bg-green-500/10 text-green-500 border-green-500/20"
                      )}
                    >
                      {audioServiceStatus.microphone.detectingAudio ? "Detectando" : "Silêncio"}
                    </Badge>
                  </div>
                  {audioServiceStatus.microphone.deviceName && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {audioServiceStatus.microphone.deviceName}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-100",
                          audioServiceStatus.microphone.detectingAudio
                            ? "bg-green-500"
                            : "bg-muted-foreground"
                        )}
                        style={{ width: `${audioServiceStatus.microphone.level}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {audioServiceStatus.microphone.level}%
                    </span>
                  </div>
                </div>
              )}

              {/* Status do Sistema de Áudio */}
              {audioServiceStatus?.systemAudio && (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-xs">Sistema de Áudio</span>
                    </div>
                    <Badge
                      variant={audioServiceStatus.systemAudio.detectingAudio ? "default" : "secondary"}
                      className={cn(
                        audioServiceStatus.systemAudio.detectingAudio && "bg-green-500/10 text-green-500 border-green-500/20"
                      )}
                    >
                      {audioServiceStatus.systemAudio.detectingAudio ? "Detectando" : "Silêncio"}
                    </Badge>
                  </div>
                  {audioServiceStatus.systemAudio.deviceName && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {audioServiceStatus.systemAudio.deviceName}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-100",
                          audioServiceStatus.systemAudio.detectingAudio
                            ? "bg-blue-500"
                            : "bg-muted-foreground"
                        )}
                        style={{ width: `${audioServiceStatus.systemAudio.level}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {audioServiceStatus.systemAudio.level}%
                    </span>
                  </div>
                </div>
              )}

              {/* Dispositivo Selecionado no Serviço */}
              {audioServiceStatus?.selectedDeviceId && (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-xs">Dispositivo no Serviço:</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 break-all">
                    {(audioServiceDevices ? [...audioServiceDevices.microphones, ...audioServiceDevices.speakers] : []).find(d => d.id === audioServiceStatus.selectedDeviceId)?.name || audioServiceStatus.selectedDeviceId}
                  </p>
                </div>
              )}

              {/* Aviso se serviço não está disponível */}
              {!audioServiceStatus && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                      Serviço C# não disponível
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                      O serviço de streaming de áudio não está rodando. Inicie o serviço C# para usar a captura de áudio do sistema.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="outline"
              onClick={loadServiceStatus}
              disabled={serviceStatusLoading}
            >
              {serviceStatusLoading ? 'Atualizando...' : 'Atualizar Status'}
            </Button>
            <Button onClick={() => {
              loadDevices();
            }}>
              Atualizar Lista
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

