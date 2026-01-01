import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMeetingStore } from '@/store/meetingStore';
import { RefreshCw, AlertCircle, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioSettingsDialog } from '@/components/audio/AudioSettingsDialog';
import { TestAudioDialog } from '@/components/audio/TestAudioDialog';

export function AudioServiceControl() {
  const {
    audioServiceStatus,
    getAudioServiceStatus,
    selectedSystemAudioDevice,
    selectedMicrophoneDevice
  } = useMeetingStore();

  // Poll status logic remains in Store or top-level, but we can trigger refetch here on mount
  useEffect(() => {
    getAudioServiceStatus().catch(() => { });
  }, [getAudioServiceStatus]);

  // Service not available
  if (!audioServiceStatus) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs text-muted-foreground border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
          Service Offline
        </Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => getAudioServiceStatus()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  const isCapturing = audioServiceStatus?.status.status === 'capturing';
  const isAssemblyAIConnected = audioServiceStatus?.infrastructure.provider.status === 'connected';
  const isBackendConnected = audioServiceStatus?.infrastructure.backend.status === 'connected';
  const isActive = isCapturing && isAssemblyAIConnected && isBackendConnected;

  // Status Styling
  let statusLabel = 'Standby';
  let statusColor = 'text-zinc-500';
  let statusBg = 'bg-zinc-500/5 border-zinc-500/10';

  if (isActive) {
    statusLabel = 'Live';
    statusColor = 'text-green-400';
    statusBg = 'bg-green-500/10 border-green-500/20';
  } else if (isCapturing) {
    statusLabel = 'Capturing (Local)';
    statusColor = 'text-orange-400';
    statusBg = 'bg-orange-500/10 border-orange-500/20';
  }

  return (
    <div className="flex items-center gap-1.5">

      {/* Live Indicator with Ripple */}
      <div className={cn(
        "relative flex items-center justify-center w-6 h-6 rounded-full transition-all",
        isActive ? "bg-green-500/10" : "bg-transparent"
      )}>
        <Mic className={cn("w-3.5 h-3.5 transition-colors", isActive ? "text-green-500" : "text-zinc-500")} />

        {/* Ripple Animation */}
        {isActive && (
          <>
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-20 animate-ping" />
            <span className="absolute inline-flex h-[150%] w-[150%] rounded-full bg-green-500 opacity-10 animate-pulse delay-150" />
          </>
        )}
      </div>

      <Badge variant="outline" className={cn("text-[10px] h-5 transition-colors font-mono tracking-tight", statusColor, statusBg)}>
        {statusLabel}
      </Badge>

      {/* Settings & Tools */}
      <div className="h-4 w-px bg-zinc-800 mx-1" />

      <AudioSettingsDialog />

      <TestAudioDialog
        systemDeviceId={selectedSystemAudioDevice || undefined}
        microphoneDeviceId={selectedMicrophoneDevice || undefined}
      />

    </div>
  );
}
