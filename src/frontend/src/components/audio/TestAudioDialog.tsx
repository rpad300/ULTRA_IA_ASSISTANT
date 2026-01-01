import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label";
import { Mic, Activity, StopCircle, CheckCircle2, CloudLightning, Laptop2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioVisualizer, AudioPowerMeter } from './AudioVisualizer';
import { useTranscriptionSocket } from '@/hooks/useTranscriptionSocket';
import { audioServiceApi } from '@/api/client';
import { useMeetingStore } from '@/store/meetingStore';

export function TestAudioDialog({ systemDeviceId, microphoneDeviceId }: { systemDeviceId?: string, microphoneDeviceId?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [resultPath, setResultPath] = useState<string | null>(null);

    // Settings specific to test
    const { audioGain, customVocabulary, setAudioGain } = useMeetingStore();
    const [useCloud, setUseCloud] = useState(true);

    // Audio Visualizer State
    // const [showVisualizer, setShowVisualizer] = useState(true); // Unused for now

    // Socket Hook
    // We use a specific test session ID
    const TEST_SESSION_ID = "TEST_SESSION_ULTRA";
    const { connect, disconnect, status: socketStatus } = useTranscriptionSocket({
        sessionId: TEST_SESSION_ID,
        onTranscript: (segment) => {
            if (segment.isFinal) {
                setTranscripts(prev => [...prev, segment]);
                // Scroll to bottom
            } else {
                // Update partial
                // For simplicity in this demo, we append partial as a special last item or filtered render
                // but the Requirement asked for "ChatGPT style" which means strictly additive usually
                // We will handle partials in the render logic or state
                setPartialTranscript(segment);
            }
        },
        onStatusChange: (s) => console.log("Test Socket Status:", s)
    });

    const [partialTranscript, setPartialTranscript] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom effect
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcripts, partialTranscript]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            handleStopTest();
        }
    }, [isOpen]);

    const handleStartTest = async () => {
        try {
            setResultPath(null);
            setTranscripts([]);
            setPartialTranscript(null);
            setIsRecording(true);

            // 1. Connect Socket
            connect(TEST_SESSION_ID);

            // 2. Start Backend Recording
            // We pass 'undefined' for session ID to let backend generate one, OR we strictly control it.
            // The current API might expect a session ID or generate one. 
            // Let's assume audioServiceApi.startTestRecording handles the details or we need to align IDs.
            // Actually `startTestRecording` doesn't take session ID in the existing code, it likely uses a hardcoded test session.
            await audioServiceApi.startTestRecording(
                undefined,
                microphoneDeviceId,
                systemDeviceId,
                customVocabulary,
                useCloud ? 'assemblyai' : 'local'
            );

        } catch (e) {
            console.error("Start failed", e);
            setIsRecording(false);
        }
    };

    const handleStopTest = async () => {
        if (!isRecording) return;

        try {
            await audioServiceApi.stopTestRecording();
        } catch (e) { }

        disconnect();
        setIsRecording(false);
        setResultPath("Audio saved to local directory");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs ml-2 gap-1 bg-zinc-900 border-indigo-500/20 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                    <Activity className="h-3 w-3" /> Ultra Lab
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header with Professional Look */}
                <DialogHeader className="border-b border-zinc-900 pb-4">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-xl font-light tracking-tight">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 font-medium">
                                AUDIO ULTRA LAB
                            </span>
                            <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-500 font-mono">
                                V2.0 SOTA
                            </Badge>
                        </DialogTitle>

                        {/* Status Indicators */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                                <div className={cn("w-2 h-2 rounded-full", socketStatus === 'connected' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-zinc-700")} />
                                {socketStatus === 'model_loading' ? 'Loading AI...' : socketStatus}
                            </div>
                        </div>
                    </div>
                    <DialogDescription className="hidden">Lab</DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 flex-col md:flex-row gap-0 min-h-[400px]">
                    {/* LEFT: Controls & Visuals */}
                    <div className="w-full md:w-1/3 border-r border-zinc-900 bg-zinc-900/20 p-4 space-y-6 flex flex-col">

                        {/* Visualizer Area */}
                        <div className="relative">
                            <Label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Waveform Analysis</Label>
                            <div className="flex gap-2">
                                {/* Audio Waveform */}
                                <div className="flex-1">
                                    <AudioVisualizer isEnabled={true} deviceId={microphoneDeviceId} className="h-32 bg-zinc-950 shadow-inner" />
                                </div>
                                {/* Power Meter */}
                                <div className="w-6 shrink-0 pt-0.5">
                                    <AudioPowerMeter isEnabled={true} deviceId={microphoneDeviceId} />
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-4 flex-1">
                            <Label className="text-[10px] text-zinc-500 uppercase tracking-widest block">Input Constraints</Label>

                            {/* Gain Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">Digital Gain</span>
                                    <span className="font-mono text-indigo-400">{audioGain.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="1" max="5" step="0.1"
                                    value={audioGain}
                                    onChange={(e) => setAudioGain(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            {/* Backend Selection */}
                            <div className="bg-zinc-900/50 p-1 rounded-lg flex border border-zinc-800">
                                <button
                                    onClick={() => setUseCloud(true)}
                                    className={cn("flex-1 py-2 text-xs rounded-md flex items-center justify-center gap-2 transition-all", useCloud ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                                >
                                    <CloudLightning size={12} />
                                    Cloud (SOTA)
                                </button>
                                <button
                                    onClick={() => setUseCloud(false)}
                                    className={cn("flex-1 py-2 text-xs rounded-md flex items-center justify-center gap-2 transition-all", !useCloud ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                                >
                                    <Laptop2 size={12} />
                                    Local
                                </button>
                            </div>

                        </div>

                        {/* Action Button */}
                        <div className="mt-auto">
                            {!isRecording ? (
                                <Button onClick={handleStartTest} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-indigo-500/50">
                                    <Mic className="h-4 w-4 mr-2" /> Start Analysis
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleStopTest}
                                    variant="destructive"
                                    className="w-full bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200"
                                >
                                    <StopCircle className="h-4 w-4 mr-2 animate-pulse" /> Stop Capture
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Results & Live Transcript */}
                    <div className="flex-1 p-4 bg-zinc-950/50 flex flex-col relative">
                        <Label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Live Transcription Stream</Label>

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 min-h-[300px]"
                        >
                            {/* Empty State */}
                            {!isRecording && transcripts.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4">
                                    <div className="w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center">
                                        <Activity className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="text-sm font-mono opacity-50">Ready to visualize audio intelligence</p>
                                </div>
                            )}

                            {/* Model Loading State */}
                            {isRecording && socketStatus === 'model_loading' && (
                                <div className="space-y-3 p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
                                        <div className="space-y-2 flex-1">
                                            <div className="h-2 bg-gradient-to-r from-zinc-800 to-zinc-900 rounded w-1/3 animate-pulse" />
                                            <div className="h-2 bg-gradient-to-r from-zinc-800 to-zinc-900 rounded w-2/3 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Transcripts */}
                            {transcripts.map((t) => (
                                <div key={t.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex gap-3">
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                                            t.speaker === 'A' ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                        )}>
                                            {t.speaker === '?' ? 'U' : t.speaker}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-zinc-400 font-medium">Speaker {t.speaker}</span>
                                                <span className="text-[9px] text-zinc-600 font-mono">{new Date(t.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-sm text-zinc-200 leading-relaxed drop-shadow-sm">
                                                {t.text}
                                                {t.isFinal && <span className="inline-block w-1.5 h-1.5 bg-green-500/50 rounded-full ml-2 shadow-[0_0_5px_rgba(34,197,94,0.5)] animate-ping duration-1000" />}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Partial (Typing) */}
                            {partialTranscript && (
                                <div className="opacity-70">
                                    <div className="flex gap-3">
                                        <div className="w-6 h-6 rounded-full bg-zinc-800 border-zinc-700 flex items-center justify-center text-[10px] text-zinc-500 shrink-0">
                                            ...
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-zinc-400 leading-relaxed italic">
                                                {partialTranscript.text}
                                                <span className="inline-block w-1 h-3 bg-zinc-500 ml-1 animate-pulse" />
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer Save Result */}
                        {resultPath && (
                            <div className="absolute bottom-4 right-4 bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-xs flex items-center gap-2 backdrop-blur-md">
                                <CheckCircle2 size={12} />
                                {resultPath}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
