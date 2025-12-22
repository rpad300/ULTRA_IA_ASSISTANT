import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Flag, Volume2, VolumeX, FileText, Mic, MicOff, AlertCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { AdaptiveLayout } from "./AdaptiveLayout";
import { NotificationCenter } from "./NotificationCenter";
import { useOverlayStore } from "@/store/overlayStore";
import { useEffect } from "react";
import { AudioDeviceSelector } from "./AudioDeviceSelector";
import { AudioServiceControl } from "./AudioServiceControl";
import { AudioLevelIndicators } from "./AudioLevelIndicators";

export function SessionControlBar() {
    const {
        isRecording,
        isPaused,
        isSilentMode,
        elapsedTime,
        startSession,
        pauseSession,
        resumeSession,
        stopSession,
        toggleSilentMode,
        markCriticalMoment,
        sessionId,
        microphonePermission,
        systemAudioPermission,
        isAudioCapturing,
        checkMicrophonePermission,
        requestMicrophonePermission,
        requestSystemAudioPermission,
        audioServiceStatus,
    } = useMeetingStore();

    useEffect(() => {
        // Check microphone permission on mount
        checkMicrophonePermission();
    }, [checkMicrophonePermission]);

    const { openOverlay } = useOverlayStore();

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTranscriptionStatus = () => {
        if (!isRecording) return { label: "Stopped", color: "bg-muted text-muted-foreground border-border" };
        if (isPaused) return { label: "Paused", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
        return { label: "Recording", color: "bg-green-500/10 text-green-500 border-green-500/20" };
    };

    const status = getTranscriptionStatus();

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm p-4 shadow-sm"
        >
            <div className="flex items-center justify-between gap-4">
                {/* Left: Timer and Status */}
                <div className="flex items-center gap-4">
                    <motion.div
                        className="font-mono text-lg font-semibold"
                        animate={isRecording && !isPaused ? {
                            scale: [1, 1.05, 1],
                        } : {}}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        {formatTime(elapsedTime)}
                    </motion.div>
                    <Badge variant="outline" className={cn("text-xs", status.color)}>
                        {status.label}
                        {isRecording && !isPaused && (
                            <motion.span
                                className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500"
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        )}
                    </Badge>

                    {/* Microphone Permission Status */}
                    {microphonePermission !== 'unknown' && (
                        <Badge
                            variant="outline"
                            className={cn("text-xs gap-1 cursor-pointer hover:opacity-80 transition-opacity", {
                                "bg-green-500/10 text-green-500 border-green-500/20": microphonePermission === 'granted',
                                "bg-red-500/10 text-red-500 border-red-500/20": microphonePermission === 'denied',
                                "bg-yellow-500/10 text-yellow-500 border-yellow-500/20": microphonePermission === 'prompt',
                            })}
                            onClick={requestMicrophonePermission}
                            title="Click to request microphone permission"
                        >
                            {microphonePermission === 'granted' ? (
                                <Mic className="h-3 w-3" />
                            ) : microphonePermission === 'denied' ? (
                                <MicOff className="h-3 w-3" />
                            ) : (
                                <AlertCircle className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline">
                                {microphonePermission === 'granted' ? 'Mic OK' :
                                    microphonePermission === 'denied' ? 'Mic Denied' :
                                        'Mic Permission'}
                            </span>
                        </Badge>
                    )}

                    {/* PicoVoice Status Badge */}
                    <Badge
                        variant="outline"
                        className={cn("text-xs gap-1 transition-opacity", {
                            "bg-green-500/10 text-green-500 border-green-500/20": useMeetingStore(state => state.picoVoiceStatus) === 'ready',
                            "bg-red-500/10 text-red-500 border-red-500/20": useMeetingStore(state => state.picoVoiceStatus) === 'failed',
                            "bg-yellow-500/10 text-yellow-500 border-yellow-500/20": useMeetingStore(state => state.picoVoiceStatus) === 'initializing',
                            "bg-muted text-muted-foreground border-border": useMeetingStore(state => state.picoVoiceStatus) === 'unknown',
                            "hidden": useMeetingStore(state => state.picoVoiceStatus) === 'unknown' && !isRecording,
                        })}
                        title="Speaker Identification (PicoVoice) Status"
                    >
                        <User className="h-3 w-3" />
                        <span className="hidden sm:inline">
                            {useMeetingStore(state => state.picoVoiceStatus) === 'ready' ? 'Speaker ID Active' :
                                useMeetingStore(state => state.picoVoiceStatus) === 'failed' ? 'ID Failed' :
                                    useMeetingStore(state => state.picoVoiceStatus) === 'initializing' ? 'ID Init...' : 'ID Unknown'}
                        </span>
                    </Badge>

                    {/* System Audio Permission Status */}
                    <Badge
                        variant="outline"
                        className={cn("text-xs gap-1 cursor-pointer hover:opacity-80 transition-opacity", {
                            "bg-green-500/10 text-green-500 border-green-500/20": systemAudioPermission === 'granted' || !!audioServiceStatus,
                            "bg-red-500/10 text-red-500 border-red-500/20": systemAudioPermission === 'denied' && !audioServiceStatus,
                            "bg-yellow-500/10 text-yellow-500 border-yellow-500/20": systemAudioPermission === 'prompt' && !audioServiceStatus,
                            "bg-muted text-muted-foreground border-border": systemAudioPermission === 'not_requested' && !audioServiceStatus,
                        })}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!audioServiceStatus) {
                                requestSystemAudioPermission();
                            }
                        }}
                        title={audioServiceStatus ? "System audio captured natively by C# service" : "Click to request system audio permission"}
                    >
                        {systemAudioPermission === 'granted' || !!audioServiceStatus ? (
                            <Volume2 className="h-3 w-3" />
                        ) : systemAudioPermission === 'denied' ? (
                            <VolumeX className="h-3 w-3" />
                        ) : (
                            <AlertCircle className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">
                            {!!audioServiceStatus ? 'Native Audio' :
                                systemAudioPermission === 'granted' ? 'System OK' :
                                    systemAudioPermission === 'denied' ? 'System Denied' :
                                        systemAudioPermission === 'prompt' ? 'System Permission' :
                                            'System Audio'}
                        </span>
                    </Badge>

                    {/* Audio Device Selector */}
                    {systemAudioPermission === 'granted' && (
                        <AudioDeviceSelector />
                    )}

                    {/* C# Audio Service Control */}
                    <AudioServiceControl />

                    {/* Audio Level Indicators */}
                    {isRecording && isAudioCapturing && (
                        <AudioLevelIndicators />
                    )}
                </div>

                {/* Right: Control Buttons */}
                <div className="flex items-center gap-2">
                    {!isRecording ? (
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                onClick={() => {
                                    const newSessionId = sessionId || `session-${Date.now()}`;
                                    startSession(newSessionId);
                                }}
                                className="gap-2"
                            >
                                <Play className="h-4 w-4" />
                                Start Transcription
                            </Button>
                        </motion.div>
                    ) : (
                        <>
                            {isPaused ? (
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Button
                                        onClick={resumeSession}
                                        variant="outline"
                                        className="gap-2"
                                    >
                                        <Play className="h-4 w-4" />
                                        Resume
                                    </Button>
                                </motion.div>
                            ) : (
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Button
                                        onClick={pauseSession}
                                        variant="outline"
                                        className="gap-2"
                                    >
                                        <Pause className="h-4 w-4" />
                                        Pause
                                    </Button>
                                </motion.div>
                            )}
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    onClick={stopSession}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <Square className="h-4 w-4" />
                                    Stop
                                </Button>
                            </motion.div>
                        </>
                    )}

                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Button
                            onClick={() => openOverlay('teleprompter')}
                            variant="outline"
                            className="gap-2"
                            title="Open Teleprompter"
                        >
                            <FileText className="h-4 w-4" />
                            <span className="hidden sm:inline">Teleprompter</span>
                        </Button>
                    </motion.div>

                    {isRecording && (
                        <>
                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <Button
                                    onClick={markCriticalMoment}
                                    variant="outline"
                                    size="icon"
                                    className="gap-2"
                                    title="Mark critical moment"
                                >
                                    <Flag className="h-4 w-4" />
                                </Button>
                            </motion.div>
                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <Button
                                    onClick={toggleSilentMode}
                                    variant={isSilentMode ? "default" : "outline"}
                                    size="icon"
                                    className="gap-2"
                                    title={isSilentMode ? "Disable silent mode" : "Enable silent mode"}
                                >
                                    {isSilentMode ? (
                                        <VolumeX className="h-4 w-4" />
                                    ) : (
                                        <Volume2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </motion.div>
                        </>
                    )}

                    {/* Adaptive Layout Control */}
                    <AdaptiveLayout
                        panelIds={['transcript', 'participants', 'summary', 'guidance', 'insights', 'health', 'timeline']}
                    />

                    {/* Notification Center */}
                    <div className="relative">
                        <NotificationCenter />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
