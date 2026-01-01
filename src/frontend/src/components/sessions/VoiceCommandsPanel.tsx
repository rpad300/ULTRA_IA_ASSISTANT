import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Command, RotateCcw, Sparkles } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { useVoiceIntelligence, type VoiceCommand } from "@/hooks/useVoiceIntelligence";
import { useSessionStatus } from "./useSessionStatus";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function VoiceCommandsPanel() {
    const {
        isListening: storeListening,
        toggleVoiceCommands,
        markCriticalMoment,
        pauseSession,
        resumeSession,
        toggleSilentMode,
        isSilentMode
    } = useMeetingStore();

    // Get real audio level for the Orb
    const { currentAudioLevel } = useSessionStatus();

    // Define Commands with Fuzzy Logic
    const commands: VoiceCommand[] = [
        {
            id: 'mark',
            description: 'Mark Critical Moment',
            keywords: ['mark', 'moment', 'important', 'critical'],
            synonyms: ['flag this', 'note this', 'highlight', 'save this point'],
            action: markCriticalMoment,
            undo: () => { /* No undo for marking yet, requires deleting the last marker */ }
        },
        {
            id: 'pause',
            description: 'Pause Session',
            keywords: ['pause', 'stop', 'hold', 'wait'],
            synonyms: ['take a break', 'pause recording', 'stop transcription'],
            action: pauseSession,
            undo: resumeSession
        },
        {
            id: 'resume',
            description: 'Resume Session',
            keywords: ['resume', 'start', 'continue', 'go'],
            synonyms: ['continue recording', 'start listening', 'keep going'],
            action: resumeSession,
            undo: pauseSession
        },
        {
            id: 'silent_on',
            description: 'Enable Silent Mode',
            keywords: ['silent', 'quiet', 'hush', 'mute'],
            synonyms: ['incognito mode', 'turn off sound', 'shut up'],
            action: () => !isSilentMode && toggleSilentMode(),
            undo: () => isSilentMode && toggleSilentMode()
        },
        {
            id: 'silent_off',
            description: 'Disable Silent Mode',
            keywords: ['speak', 'voice', 'sound', 'unmute'],
            synonyms: ['turn on sound', 'enable voice', 'talk to me'],
            action: () => isSilentMode && toggleSilentMode(),
            undo: () => !isSilentMode && toggleSilentMode()
        }
    ];

    // Simple Audio Feedback
    const playSuccessChime = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.error("Audio feedback failed", e);
        }
    };

    const { state, transcript, lastCommand, history, undoLastCommand } = useVoiceIntelligence({
        isListening: storeListening,
        commands,
        wakeWord: 'Ultra', // Optional wake word as requested
        minConfidence: 0.4,
        onCommandExecuted: playSuccessChime
    });

    // --- Visual Logic ---

    // Orb Colors (OKLCH)
    const orbColors = {
        idle: "bg-slate-400/20",
        listening: "bg-[oklch(0.6_0.2_270)]", // Blue/Violet
        processing: "bg-[oklch(0.85_0.15_80)]", // Gold
        success: "bg-[oklch(0.7_0.2_140)]", // Green
        error: "bg-[oklch(0.65_0.25_30)]", // Red
    };

    // Derived Orb Scale (Reacts to voice volume if listening)
    const orbScale = state === 'listening'
        ? 1 + (currentAudioLevel * 2) // Scale up to 3x with loud voice
        : state === 'processing' ? 1.2 : 1;


    // Helpers for Suggestions
    const [showSuggestions, setShowSuggestions] = useState(false);

    return (
        <Card className="relative overflow-hidden border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl transition-all duration-500 group">
            {/* Glassmorphism Background Gradient Hint */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />

            <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white/90">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    Intelligent Voice Orb
                </CardTitle>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/50 hover:text-white"
                        onClick={() => setShowSuggestions(!showSuggestions)}
                    >
                        <Command className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={storeListening ? "default" : "outline"}
                        size="sm"
                        onClick={toggleVoiceCommands}
                        className={cn(
                            "h-7 px-3 text-xs transition-all duration-300",
                            storeListening ? "bg-indigo-600 hover:bg-indigo-700 border-transparent" : "border-white/20 bg-white/5 hover:bg-white/10"
                        )}
                    >
                        {storeListening ? (
                            <><Mic className="h-3 w-3 mr-1.5" /> Listening</>
                        ) : (
                            <><MicOff className="h-3 w-3 mr-1.5" /> Standby</>
                        )}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 relative min-h-[160px] flex flex-col justify-center items-center">

                {/* --- THE VOICE ORB --- */}
                <div className="relative w-24 h-24 flex items-center justify-center my-6">
                    {/* Outer Glow Ring */}
                    <motion.div
                        className={cn("absolute inset-0 rounded-full blur-xl transition-colors duration-500", orbColors[state])}
                        animate={{
                            scale: state === 'listening' ? [1, 1.1, 1] : 1,
                            opacity: state === 'listening' ? 0.6 : 0.3
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />

                    {/* The Core Orb */}
                    <motion.div
                        className={cn("w-16 h-16 rounded-full shadow-inner flex items-center justify-center relative z-10 backdrop-blur-md border border-white/20 transition-colors duration-300", orbColors[state])}
                        animate={{
                            scale: orbScale,
                            rotate: state === 'processing' ? 360 : 0
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20
                        }}
                    >
                        {/* Internal Core Pulse */}
                        <div className="w-8 h-8 rounded-full bg-white/20 blur-sm" />
                    </motion.div>

                    {/* Wake Word Hint */}
                    <div className="absolute -bottom-8 text-[10px] text-white/30 uppercase tracking-widest font-medium">
                        {state === 'listening' ? "Say 'Ultra...'" : state.toUpperCase()}
                    </div>
                </div>

                {/* --- Live Transcript / Feedback --- */}
                <div className="w-full px-6 pb-6 text-center h-16 flex flex-col justify-end">
                    <AnimatePresence mode="wait">
                        {transcript ? (
                            <motion.div
                                key="transcript"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-lg font-light text-white/90 truncate"
                            >
                                "{transcript}"
                            </motion.div>
                        ) : lastCommand ? (
                            <motion.div
                                key="last-cmd"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                    "text-sm font-medium px-3 py-1.5 rounded-full inline-block backdrop-blur-sm border",
                                    lastCommand.type === 'command' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                                )}
                            >
                                {lastCommand.text}
                            </motion.div>
                        ) : (
                            <motion.p
                                key="idle"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.4 }}
                                className="text-xs text-white/40 italic"
                            >
                                Ready to assist...
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- Floating Suggestions Overlay --- */}
                <AnimatePresence>
                    {showSuggestions && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center p-4 space-y-2"
                        >
                            <p className="text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Voice Commands</p>
                            <div className="grid grid-cols-1 gap-2 w-full max-w-[200px]">
                                {commands.map(cmd => (
                                    <div key={cmd.id} className="text-xs text-white/80 bg-white/10 px-3 py-2 rounded-lg border border-white/5 flex items-center justify-between group-hover:border-white/20 transition-colors">
                                        <span>{cmd.description}</span>
                                        <span className="text-[10px] text-white/30 italic">"Ultra {cmd.keywords[0]}..."</span>
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-4 text-xs text-white/40 hover:text-white"
                                onClick={() => setShowSuggestions(false)}
                            >
                                Close
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- History Stack (Bottom Edge) --- */}
                <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
                    {history.slice(0, 1).map((h) => (
                        <motion.div
                            key={h.timestamp}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="text-[10px] text-white/20 flex items-center gap-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                            {h.command}
                        </motion.div>
                    ))}
                </div>

                {/* Undo Trigger (Visible if history exists) */}
                {history.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute bottom-1 left-1 h-6 w-6 text-white/20 hover:text-white hover:bg-white/10 transition-colors"
                        onClick={undoLastCommand}
                        title="Undo Last Command"
                    >
                        <RotateCcw className="h-3 w-3" />
                    </Button>
                )}

            </CardContent>
        </Card>
    );
}
