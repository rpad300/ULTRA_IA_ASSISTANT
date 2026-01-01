import { useEffect, useState } from "react";
import { AudioServiceControl } from "@/components/sessions/AudioServiceControl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMeetingStore } from "@/store/meetingStore";
import { Badge } from "@/components/ui/badge";
import { Circle, Cpu, Mic, Volume2 } from "lucide-react";

export function NativeAudioView() {
    const {
        getAudioServiceDevices,
        selectedSystemAudioDevice,
        setSelectedSystemAudioDevice,
        selectedMicrophoneDevice,
        setSelectedMicrophoneDevice,
        getAudioServiceStatus,
        audioServiceStatus,
        isModelLoading,
        modelLoadingMessage
    } = useMeetingStore();

    const [devices, setDevices] = useState<{ microphones: any[], system: any[] }>({ microphones: [], system: [] });

    useEffect(() => {
        const fetchDevices = async () => {
            // Initial status fetch to ensure we can get devices
            await getAudioServiceStatus().catch(() => { });

            try {
                const allDevices = await getAudioServiceDevices();
                // Filter devices based on dataFlow or name convention if needed, 
                // but for now we assume the service returns them all in a flat list 
                // and we might need to filter by type if the API supports it.
                // Looking at the store, 'audioServiceDevices' is a flat list. 
                // Start/Stop usually takes ID. 

                // Since the C# service returns a flat list, we might need to rely on 
                // the `dataFlow` property if it exists, or display all in both for now 
                // if we can't distinguish. 
                // WAIT: The previous C# analysis showed generic device enumeration.
                // Let's assume the list contains both.

                if (allDevices) {
                    setDevices({
                        microphones: allDevices.microphones || [],
                        system: allDevices.speakers || []
                    });
                }

            } catch (e) {
                console.error("Failed to fetch devices", e);
            }
        };
        fetchDevices();

        // Refresh every 10s
        const interval = setInterval(fetchDevices, 10000);
        return () => clearInterval(interval);
    }, []);

    const isBackendConnected = audioServiceStatus?.infrastructure.backend.status === 'connected';
    const isAAIConnected = audioServiceStatus?.infrastructure.provider.status === 'connected';
    const isCapturing = audioServiceStatus?.status.status === 'capturing';

    let aaiStatusClass = "text-muted-foreground border-border";
    let aaiStatusText = "AssemblyAI: Standby";

    if (isCapturing) {
        if (isAAIConnected) {
            aaiStatusClass = "text-green-500 border-green-500/30";
            aaiStatusText = "AssemblyAI: Live";
        } else {
            aaiStatusClass = "text-red-500 border-red-500/30 animate-pulse";
            aaiStatusText = "AssemblyAI: Connecting...";
        }
    } else {
        aaiStatusClass = "text-yellow-500 border-yellow-500/30";
        aaiStatusText = "AssemblyAI: Standby";
    }

    return (
        <div className="h-screen w-full bg-background p-6 flex flex-col items-center justify-center">
            <Card className="w-full shadow-2xl border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Cpu className="h-6 w-6 text-primary" />
                        Ultra Audio Engine
                    </CardTitle>
                    <CardDescription>
                        Native Audio Processing & Transcription Service
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Main Control & Status */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                System Status
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="outline" className={isBackendConnected ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}>
                                    Backend
                                </Badge>
                                <Badge variant="outline" className={aaiStatusClass}>
                                    {aaiStatusText}
                                </Badge>
                            </div>
                        </div>

                        <div className="p-6 bg-secondary/30 rounded-xl flex justify-center border border-border/50">
                            {isModelLoading ? (
                                <div className="flex flex-col items-center gap-3 py-4">
                                    <div className="flex items-center gap-2 text-primary animate-pulse">
                                        <Cpu className="h-8 w-8 animate-spin" />
                                        <span className="text-lg font-medium">Initializing AI Model...</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground text-center max-w-md">
                                        {modelLoadingMessage || "Loading Whisper model on GPU High Performance mode..."}
                                    </p>
                                </div>
                            ) : (
                                <AudioServiceControl />
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Device Selection */}
                    <div className="space-y-4">
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Device Configuration
                        </div>

                        <div className="grid gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Mic className="h-4 w-4" /> Microphone
                                </label>
                                <Select
                                    value={selectedMicrophoneDevice || ""}
                                    onValueChange={setSelectedMicrophoneDevice}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Microphone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default Device</SelectItem>
                                        {devices.microphones.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Volume2 className="h-4 w-4" /> System Audio
                                </label>
                                <Select
                                    value={selectedSystemAudioDevice || ""}
                                    onValueChange={setSelectedSystemAudioDevice}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select System Audio" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default Device</SelectItem>
                                        {devices.system.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 text-xs text-center text-muted-foreground flex justify-center gap-4">
                        <span className="flex items-center gap-1">
                            <Circle className={`h-2 w-2 ${audioServiceStatus ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"}`} />
                            Service: {audioServiceStatus ? "Ready" : "Offline"}
                        </span>
                        <span className="font-mono opacity-50">ID: native-01</span>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
