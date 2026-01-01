import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mic, Speaker } from "lucide-react";
import { useMeetingStore } from '@/store/meetingStore';
import { cn } from '@/lib/utils';

interface AudioDeviceSelectorProps {
  className?: string;
  mode?: 'mic' | 'system' | 'both';
  minimal?: boolean;
}

export function AudioDeviceSelector({ className, mode = 'both', minimal = false }: AudioDeviceSelectorProps) {
  const {
    audioServiceDevices,
    selectedMicrophoneDevice,
    selectedSystemAudioDevice,
    setSelectedMicrophoneDevice,
    setSelectedSystemAudioDevice,
    getAudioServiceDevices,

  } = useMeetingStore();

  useEffect(() => {
    getAudioServiceDevices();
    // Refresh device list periodically if needed, or rely on mount
  }, [getAudioServiceDevices]);

  const handleMicChange = async (value: string) => {
    setSelectedMicrophoneDevice(value);
  };

  const handleSpeakerChange = async (value: string) => {
    setSelectedSystemAudioDevice(value);
  };

  const triggerClass = minimal
    ? "h-6 text-[10px] bg-transparent border-transparent hover:bg-white/5 focus:bg-white/10 px-2 gap-1 text-muted-foreground hover:text-foreground transition-colors w-[140px]"
    : "h-8 text-xs bg-background/50 border-white/10 focus:ring-1 focus:ring-primary/20";

  return (
    <div className={cn("flex flex-col gap-4", !minimal && "min-w-[200px]", className)}>

      {(mode === 'both' || mode === 'mic') && (
        <div className={cn(minimal ? "flex items-center" : "space-y-1.5")}>
          {!minimal && (
            <div className="flex items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium text-muted-foreground">Microfone</Label>
            </div>
          )}
          <Select value={selectedMicrophoneDevice || undefined} onValueChange={handleMicChange}>
            <SelectTrigger className={triggerClass}>
              {minimal && <Mic className="h-3 w-3 mr-1 opacity-70" />}
              <SelectValue placeholder="Microfone" />
            </SelectTrigger>
            <SelectContent>
              {audioServiceDevices.microphones.map((device) => (
                <SelectItem key={device.id} value={device.id} className="text-xs">
                  {device.name}
                </SelectItem>
              ))}
              {audioServiceDevices.microphones.length === 0 && (
                <SelectItem value="none" disabled className="text-xs">
                  Sem dispositivos
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {(mode === 'both' || mode === 'system') && (
        <div className={cn(minimal ? "flex items-center" : "space-y-1.5")}>
          {!minimal && (
            <div className="flex items-center gap-2">
              <Speaker className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium text-muted-foreground">Áudio do Sistema</Label>
            </div>
          )}
          <Select value={selectedSystemAudioDevice || undefined} onValueChange={handleSpeakerChange}>
            <SelectTrigger className={triggerClass}>
              {minimal && <Speaker className="h-3 w-3 mr-1 opacity-70" />}
              <SelectValue placeholder="Sistema" />
            </SelectTrigger>
            <SelectContent>
              {audioServiceDevices.speakers.map((device) => (
                <SelectItem key={device.id} value={device.id} className="text-xs">
                  {device.name}
                </SelectItem>
              ))}
              {audioServiceDevices.speakers.length === 0 && (
                <SelectItem value="none" disabled className="text-xs">
                  Sem dispositivos
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
