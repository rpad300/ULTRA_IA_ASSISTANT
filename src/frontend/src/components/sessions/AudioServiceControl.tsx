import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useMeetingStore } from '@/store/meetingStore';
import { audioServiceApi } from '@/api/client';
import { getWebSocketUrl } from '@/config/api';
import { RefreshCw, AlertCircle, Mic, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function AudioServiceControl() {
  const {
    audioServiceStatus,
    getAudioServiceStatus,

    selectedSystemAudioDevice,
    selectedMicrophoneDevice
  } = useMeetingStore();

  // Poll status every 5 seconds (less frequent to reduce noise when service is not running)
  useEffect(() => {
    const interval = setInterval(() => {
      getAudioServiceStatus().catch(() => {
        // Service might not be running, ignore errors silently
      });
    }, 5000);

    // Initial load
    getAudioServiceStatus().catch(() => { });

    return () => clearInterval(interval);
  }, [getAudioServiceStatus]);



  // Service not available
  if (!audioServiceStatus) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3 mr-1" />
          Serviço não disponível
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => getAudioServiceStatus()}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Verificar
        </Button>
      </div>
    );
  }

  const isCapturing = audioServiceStatus?.isCapturing;
  const isAssemblyAIConnected = audioServiceStatus?.isAssemblyAIConnected;
  const isBackendConnected = audioServiceStatus?.isBackendConnected;

  // Overall active state requires capturing AND both connections
  const isActive = isCapturing && isAssemblyAIConnected && isBackendConnected;

  // Determine detailed status for display
  let statusLabel = 'Streaming Parado';
  let statusColor = 'text-muted-foreground';
  let statusBg = '';

  if (isActive) {
    statusLabel = 'Streaming Ativo';
    statusColor = 'text-green-500';
    statusBg = 'bg-green-500/10 border-green-500/20';
  } else if (isCapturing) {
    // Capturing but disconnected
    if (!isAssemblyAIConnected && !isBackendConnected) {
      statusLabel = 'Desconectado (AssemblyAI + Backend)';
      statusColor = 'text-red-500';
      statusBg = 'bg-red-500/10 border-red-500/20';
    } else if (!isAssemblyAIConnected) {
      statusLabel = 'AssemblyAI Desconectado';
      statusColor = 'text-orange-500';
      statusBg = 'bg-orange-500/10 border-orange-500/20';
    } else if (!isBackendConnected) {
      statusLabel = 'Backend Desconectado';
      statusColor = 'text-orange-500';
      statusBg = 'bg-orange-500/10 border-orange-500/20';
    }
  }

  return (
    <div className="flex items-center gap-2">

      <Badge
        variant="outline"
        className={cn(
          "text-xs transition-colors",
          statusColor,
          statusBg
        )}
      >
        {statusLabel}
      </Badge>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => getAudioServiceStatus()}
      >
        <RefreshCw className="h-3 w-3" />
      </Button>

      <AudioSettingsDialog />

      <TestAudioDialog
        systemDeviceId={selectedSystemAudioDevice || undefined}
        microphoneDeviceId={selectedMicrophoneDevice || undefined}
      />
    </div>
  );
}

function AudioSettingsDialog() {
  const {
    audioGain, setAudioGain,
    customVocabulary, setCustomVocabulary,
    autoStopEnabled, setAutoStopEnabled,
    silenceTimeoutMs, isRecording
  } = useMeetingStore();

  const [localVocab, setLocalVocab] = useState(customVocabulary.join(", "));
  const [isOpen, setIsOpen] = useState(false);

  // Sync vocab from store when opening
  useEffect(() => {
    if (isOpen) {
      setLocalVocab(customVocabulary.join(", "));
    }
  }, [isOpen, customVocabulary]);

  const handleSaveVocab = () => {
    const terms = localVocab.split(',').map(s => s.trim()).filter(Boolean);
    setCustomVocabulary(terms);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Audio Settings</DialogTitle>
          <DialogDescription>
            Configure audio processing and intelligence parameters.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">

          {/* Volume / Gain */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="gain">Digital Gain (Volume Boost)</Label>
              <span className="text-sm font-mono text-muted-foreground">{audioGain.toFixed(1)}x</span>
            </div>
            <input
              id="gain"
              type="range"
              min="1" max="15" step="0.5"
              value={audioGain}
              onChange={(e) => setAudioGain(parseFloat(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Increase only if audio is too quiet. High values may cause distortion.
            </p>
          </div>

          {/* Auto Stop */}
          <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
            <div className="space-y-1">
              <Label htmlFor="auto-stop">Smart Auto-Stop</Label>
              <p className="text-[10px] text-muted-foreground">
                Stop session automatically after {(silenceTimeoutMs / 1000).toFixed(0)}s of silence.
              </p>
            </div>
            <Switch
              id="auto-stop"
              checked={autoStopEnabled}
              onCheckedChange={setAutoStopEnabled}
            />
          </div>

          {/* Custom Vocabulary */}
          <div className="space-y-2">
            <Label htmlFor="vocab">Custom Vocabulary (Context)</Label>
            <Textarea
              id="vocab"
              placeholder="E.g. Product names, Acronyms, Industry terms..."
              value={localVocab}
              onChange={(e) => setLocalVocab(e.target.value)}
              onBlur={handleSaveVocab}
              className="h-24 resize-none"
              disabled={isRecording}
            />
            {isRecording ? (
              <p className="text-[10px] text-yellow-500">
                Cannot update vocabulary while recording.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Comma-separated list. Applies to next session.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TestAudioDialog({ systemDeviceId, microphoneDeviceId }: { systemDeviceId?: string, microphoneDeviceId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [partialTranscript, setPartialTranscript] = useState<any | null>(null);

  // Settings
  const [volume, setVolume] = useState(5.0);
  const [vocab, setVocab] = useState("");
  const [autoStop, setAutoStop] = useState(true);
  const [transcriptionService, setTranscriptionService] = useState<'assemblyai' | 'local'>('assemblyai');

  // Timers
  const lastTranscriptTimeRef = useState<{ val: number }>({ val: Date.now() })[0];

  const updateVolume = async (newVal: number) => {
    setVolume(newVal);
    try {
      await fetch('http://localhost:8000/api/audio-service/gain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gain: newVal })
      });
    } catch (e) { console.error("Failed to set gain", e); }
  };

  const handleStartTest = async () => {
    try {
      setError(null);
      setResultPath(null);
      setTranscripts([]);
      setIsRecording(true);
      lastTranscriptTimeRef.val = Date.now();

      // Send initial gain
      await updateVolume(volume);

      // WebSocket
      // WebSocket - Connect specifically to TEST_SESSION to pass isolation check
      const wsUrl = getWebSocketUrl(`/api/ws/transcription?mode=native&session_id=TEST_SESSION`);
      const ws = new WebSocket(wsUrl);
      (window as any).__testAudioWs = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'status') {
            if (data.status === 'model_loading') {
              // We can re-use the partial transcript to show loading state or add a dedicated state
              // For now, let's use the partial text slot to show it's loading
              setPartialTranscript({
                text: data.message || "Initializing AI Model...",
                timestamp: new Date().toISOString(),
                speaker: "System",
                isFinal: false
              });
            }
          }

          if (data.type === 'transcript' || data.type === 'Turn') {
            const text = data.text || data.transcript;
            const speaker = data.speaker || "?";
            const isFinal = data.is_final;

            lastTranscriptTimeRef.val = Date.now();

            if (isFinal) {
              // Commit the final transcript
              setTranscripts(prev => [...prev, {
                text,
                timestamp: new Date().toISOString(),
                speaker,
                isFinal: true
              }]);
              // Clear partial
              setPartialTranscript(null);
            } else {
              // Update partial transcript
              setPartialTranscript({
                text,
                timestamp: new Date().toISOString(),
                speaker,
                isFinal: false
              });
            }
          }
        } catch (e) { }
      };

      // Start Recording with Keyterms
      const keytermsList = vocab.split(',').map(s => s.trim()).filter(s => s.length > 0);

      const res = await audioServiceApi.startTestRecording(
        undefined,
        microphoneDeviceId,
        systemDeviceId,
        keytermsList,
        transcriptionService
      );

      if (res.success) {
        // Auto-stop monitor
        const checkInterval = setInterval(async () => {
          const silenceDuration = Date.now() - lastTranscriptTimeRef.val;

          // Hard limit: 30s
          // Silence limit: 3s (if autoStop enabled)
          if (autoStop && silenceDuration > 3000 && transcripts.length > 0) {
            await handleStopTest();
            clearInterval(checkInterval);
          }
        }, 500);

        // Timer for hard limit (15s just in case)
        setTimeout(async () => {
          if ((window as any).__testAudioWs) await handleStopTest();
        }, 15000);

        (window as any).__stopInterval = checkInterval;
      }
    } catch (err: any) {
      setError("Failed to start: " + err.message);
      setIsRecording(false);
      cleanup();
    }
  };

  const cleanup = () => {
    if ((window as any).__testAudioWs) {
      (window as any).__testAudioWs.close();
      (window as any).__testAudioWs = null;
    }
    if ((window as any).__stopInterval) clearInterval((window as any).__stopInterval);
  };

  const handleStopTest = async () => {
    try {
      await audioServiceApi.stopTestRecording();
    } catch (e) { }
    setIsRecording(false);
    setResultPath("Gravado em: Documents/ULTRA_Assistant_AudioTest.wav");
    cleanup();
  };

  useEffect(() => { return cleanup; }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && isRecording) handleStopTest();
      setIsOpen(open);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-xs ml-2 gap-1 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400">
          <Mic className="h-3 w-3" /> Testar Audio + IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Laboratório de Áudio ULTRA
            </span>
            <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">BETA</Badge>
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure e teste o reconhecimento de voz com IA avançada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">

          {/* Settings Panel */}
          <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                🔊 Ajuste de Volume (Ganho Digital)
              </label>
              <span className="text-xs text-indigo-400 font-mono">{volume.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1" max="15" step="0.5"
              value={volume}
              onChange={(e) => updateVolume(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">📚 Vocabulário (Word Boost)</label>
                <input
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs focus:border-indigo-500 outline-none"
                  placeholder="Ex: Ultra, Supabase, React..."
                  value={vocab}
                  onChange={(e) => setVocab(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">⚙️ Preferências</label>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoStop}
                    onChange={(e) => setAutoStop(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span className="text-xs text-zinc-400">Auto-Stop ao silenciar</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 w-12">{transcriptionService === 'local' ? 'LOCAL' : 'CLOUD'}</span>
                  <Switch
                    checked={transcriptionService === 'assemblyai'}
                    onCheckedChange={(c) => setTranscriptionService(c ? 'assemblyai' : 'local')}
                    className="scale-75 origin-left"
                  />
                  <span className="text-xs text-zinc-400">
                    {transcriptionService === 'assemblyai' ? 'Usar AssemblyAI (SOTA)' : 'Usar Modelo Local'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="min-h-[200px] flex flex-col gap-2">

            {!isRecording && transcripts.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2 border-2 border-dashed border-zinc-800 rounded-lg p-8">
                <Mic className="h-8 w-8 opacity-50" />
                <span className="text-sm">Configure acima e clique em "Iniciar Teste"</span>
              </div>
            )}

            {(isRecording || transcripts.length > 0) && (
              <div className="flex-1 bg-zinc-950/80 rounded-lg border border-zinc-800 p-4 max-h-[300px] overflow-y-auto space-y-3 custom-scrollbar">
                {transcripts.map((t, i) => (
                  <div key={i} className={cn(
                    "flex flex-col gap-1 p-3 rounded-lg text-sm max-w-[90%]",
                    t.speaker === "B" ? "self-end bg-indigo-500/10 border border-indigo-500/20 ml-auto" : "bg-zinc-800/50 border border-zinc-700"
                  )}>
                    <div className="flex items-center gap-2 opacity-70">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        t.speaker === "B" ? "bg-indigo-500 text-white" : "bg-zinc-600 text-zinc-100"
                      )}>
                        {t.speaker === "?" ? "Detectando..." : `Orador ${t.speaker}`}
                      </span>
                      <span className="text-[10px]">{new Date(t.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-zinc-200 leading-relaxed">{t.text}</p>
                  </div>
                ))}

                {/* Render Partial Transcript (Real-time updates) */}
                {partialTranscript && (
                  <div className={cn(
                    "flex flex-col gap-1 p-3 rounded-lg text-sm max-w-[90%] opacity-80 border-dashed border-2",
                    partialTranscript.speaker === "B" || partialTranscript.speaker === "A"
                      ? "self-end bg-indigo-500/5 border-indigo-500/20 ml-auto"
                      : "bg-zinc-800/30 border-zinc-700"
                  )}>
                    <div className="flex items-center gap-2 opacity-70">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                        {partialTranscript.speaker === "?" ? "..." : `Orador ${partialTranscript.speaker}`}
                      </span>
                      <span className="text-[10px]">Digitando...</span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed italic">{partialTranscript.text}</p>
                  </div>
                )}

                {isRecording && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse mt-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                    Escutando...
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Status Bar */}
          {resultPath && (
            <div className="text-[10px] text-green-500 flex items-center gap-1 bg-green-500/5 p-2 rounded border border-green-500/10">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Arquivo salvo com sucesso
            </div>
          )}
          {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded">{error}</div>}

        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isRecording ? (
            <Button onClick={handleStartTest} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
              <Mic className="mr-2 h-3 w-3" /> Iniciar Teste
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleStopTest} className="w-full sm:w-auto">
              <div className="mr-2 h-2 w-2 bg-white rounded-full animate-bounce" />
              Parar Gravacão
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}

