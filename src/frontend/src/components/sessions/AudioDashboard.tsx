

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Mic, Volume2, RefreshCw, Power, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioServiceRuntime } from '@/hooks/useAudioServiceRuntime';
import { AudioMeter } from '@/components/audio/AudioMeter';

export function AudioDashboard() {
    // We assume this component is mounted *inside* the PopoverContent, 
    // so 'open' is effectively true whenever this is visible.
    const {
        devices,
        audioServiceStatus,
        serviceError,
        loading,
        selectedMicrophoneDevice,
        selectedSystemAudioDevice,
        actions
    } = useAudioServiceRuntime(true);

    // Mini-Level Calculation
    // We use the levels from status directly.

    return (
        <div className="space-y-4 min-w-[300px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h4 className="font-medium leading-none text-sm text-white/90 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Audio Governance
                </h4>
                <div className="flex gap-1">
                    <Badge variant="outline" className={cn(
                        "text-[10px] h-5 border-white/10 transition-colors",
                        audioServiceStatus?.status.status === 'capturing' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-500"
                    )}>
                        {audioServiceStatus?.status.status === 'capturing' ? 'LIVE' : 'STANDBY'}
                    </Badge>
                </div>
            </div>

            <div className="space-y-3">
                {/* Input Section */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                            <Mic className="h-3 w-3" /> Input Source
                        </label>
                        {loading && <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" />}
                    </div>

                    <Select
                        value={selectedMicrophoneDevice || '__auto__'}
                        onValueChange={(v) => actions.setSelectedMicrophoneDevice(v === '__auto__' ? null : v)}
                        disabled={serviceError}
                    >
                        <SelectTrigger className="h-8 text-xs bg-black/20 border-white/10 focus:ring-emerald-500/20 text-white">
                            <SelectValue placeholder="Auto-Detect API" />
                        </SelectTrigger>
                        <SelectContent className="backdrop-blur-xl bg-zinc-950/95 border-white/10 text-zinc-200">
                            <SelectItem value="__auto__" className="focus:bg-white/10 focus:text-white">Auto-Detect (Default)</SelectItem>
                            {devices.inputs.map(d => (
                                <SelectItem key={d.id} value={d.id} className="focus:bg-white/10 focus:text-white">{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* LIVE METER (60fps) */}
                    <div className="pt-1">
                        <AudioMeter
                            level={(audioServiceStatus?.levels.mic.rms || 0) * 100}
                            className="h-1.5"
                        />
                    </div>
                </div>

                {/* Output Section */}
                <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                        <Volume2 className="h-3 w-3" /> System Loopback
                    </label>
                    <Select
                        value={selectedSystemAudioDevice || '__auto__'}
                        onValueChange={(v) => actions.setSelectedSystemAudioDevice(v === '__auto__' ? null : v)}
                        disabled={serviceError}
                    >
                        <SelectTrigger className="h-8 text-xs bg-black/20 border-white/10 focus:ring-indigo-500/20 text-white">
                            <SelectValue placeholder="Auto-Detect API" />
                        </SelectTrigger>
                        <SelectContent className="backdrop-blur-xl bg-zinc-950/95 border-white/10 text-zinc-200">
                            <SelectItem value="__auto__" className="focus:bg-white/10 focus:text-white">Auto-Detect (Default)</SelectItem>
                            {devices.loopbacks.map(d => (
                                <SelectItem key={d.id} value={d.id} className="focus:bg-white/10 focus:text-white">{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Footer Controls */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs justify-start px-2 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => actions.autoCalibrate()}
                    disabled={loading || audioServiceStatus?.status.status !== 'capturing'}
                >
                    <RefreshCw className={cn("h-3 w-3 mr-2", loading ? "animate-spin" : "")} />
                    Auto-Calibrate
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8 text-xs justify-start px-2",
                        audioServiceStatus?.status.status === 'capturing'
                            ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    )}
                    onClick={() => audioServiceStatus?.status.status === 'capturing' ? actions.stopStreaming() : actions.startStreaming()}
                >
                    <Power className="h-3 w-3 mr-2" />
                    {audioServiceStatus?.status.status === 'capturing' ? 'Stop Service' : 'Start Service'}
                </Button>
            </div>
        </div>
    );
}
