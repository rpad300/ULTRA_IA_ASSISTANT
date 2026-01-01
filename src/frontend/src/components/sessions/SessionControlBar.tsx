
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { SessionHealthMonitor } from "./SessionHealthMonitor";
import { Chronometer } from "./Chronometer";
import { MasterControls } from "./MasterControls";
import { Toolbelt } from "./Toolbelt";
import { useSessionStatus } from "./useSessionStatus";
import { AudioLevelIndicators } from "./AudioLevelIndicators";

export function SessionControlBar() {
    const {
        startSession,
        pauseSession,
        resumeSession,
        stopSession,
        sessionId,
    } = useMeetingStore();

    const {
        isRecording,
        isPaused,
        elapsedTime,
        currentAudioLevel
    } = useSessionStatus();

    const handleStart = () => {
        const newSessionId = sessionId || `session-${Date.now()}`;
        startSession(newSessionId);
    };

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{
                y: 0,
                opacity: 1,
                backgroundColor: isPaused ? "rgba(251, 191, 36, 0.05)" : "rgba(var(--card), 0.8)", // Subtle Amber tint in Pause
            }}
            className={cn(
                "sticky top-0 z-20 w-full border-b border-border/40",
                "bg-card/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-card/60",
                "shadow-[0_4px_30px_rgba(0,0,0,0.1)]", // Neural glass depth
                "overflow-hidden"
            )}
        >
            {/* Audio Reactive Glow Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-border/50 overflow-hidden">
                {isRecording && !isPaused && (
                    <motion.div
                        className="absolute inset-0 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }} // Loop based movement
                        style={{
                            width: "50%",
                            filter: "blur(2px)",
                            opacity: 0.5 + (currentAudioLevel / 200) // Reactive opacity
                        }}
                        transition={{
                            x: {
                                repeat: Infinity,
                                duration: 2,
                                ease: "linear",
                                repeatType: "loop"
                            }
                        }}
                    />
                )}
            </div>

            <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">

                {/* ZONE A: Status & Vitals (Left) */}
                <div className="flex items-center gap-4 md:gap-6 flex-1 justify-start">
                    <Chronometer
                        elapsedTime={elapsedTime}
                        isRecording={isRecording}
                        isPaused={isPaused}
                        audioLevel={currentAudioLevel}
                    />

                    <div className="hidden sm:flex items-center gap-2">
                        <div className="h-6 w-px bg-border/50 mx-2" />
                        <SessionHealthMonitor />
                    </div>

                    {/* Audio Level Indicators - Only visible on large screens to avoid clutter */}
                    {isRecording && (
                        <div className="hidden lg:block w-32 opacity-80">
                            <AudioLevelIndicators />
                        </div>
                    )}
                </div>

                {/* ZONE B: Master Controls (Center) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto">
                    <div className="transition-all duration-500">
                        <MasterControls
                            isRecording={isRecording}
                            isPaused={isPaused}
                            onStart={handleStart}
                            onPause={pauseSession}
                            onResume={resumeSession}
                            onStop={stopSession}
                        />
                    </div>
                </div>

                {/* ZONE C: Toolbelt (Right) */}
                <div className="flex items-center gap-3 flex-1 justify-end">
                    <Toolbelt />
                </div>
            </div>
        </motion.div>
    );
}
