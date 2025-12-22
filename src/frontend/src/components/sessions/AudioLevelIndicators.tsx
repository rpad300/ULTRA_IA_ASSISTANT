import { motion } from "framer-motion";
import { Mic, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useEffect, useState } from "react";

export function AudioLevelIndicators() {
    const { audioLevel, systemAudioLevel, audioServiceStatus, getAudioServiceStatus } = useMeetingStore();
    const [levels, setLevels] = useState({ mic: audioLevel, system: systemAudioLevel });
    const [detecting, setDetecting] = useState({ mic: audioLevel > 0, system: systemAudioLevel > 0 });

    // Update levels from C# service if available, otherwise use browser levels
    useEffect(() => {
        const updateLevels = () => {
            if (audioServiceStatus?.microphone || audioServiceStatus?.systemAudio) {
                setLevels({
                    mic: audioServiceStatus.microphone?.level ?? audioLevel,
                    system: audioServiceStatus.systemAudio?.level ?? systemAudioLevel
                });
                setDetecting({
                    mic: audioServiceStatus.microphone?.detectingAudio ?? (audioLevel > 0),
                    system: audioServiceStatus.systemAudio?.detectingAudio ?? (systemAudioLevel > 0)
                });
            } else {
                setLevels({ mic: audioLevel, system: systemAudioLevel });
                setDetecting({ mic: audioLevel > 0, system: systemAudioLevel > 0 });
            }
        };

        updateLevels();

        // Poll C# service status more frequently when capturing to get real-time levels
        if (audioServiceStatus?.isCapturing) {
            const interval = setInterval(() => {
                getAudioServiceStatus().catch((err) => {
                    // Suppress errors during polling to avoid console noise
                    if (import.meta.env.DEV) {
                        console.debug('[AudioLevelIndicators] Poll failed:', err);
                    }
                });
            }, 500); // Update every 500ms to reduce server load

            return () => clearInterval(interval);
        }
    }, [audioLevel, systemAudioLevel, audioServiceStatus, getAudioServiceStatus]);

    return (
        <div className="flex items-center gap-3">
            {/* Microphone Level */}
            <div className="flex items-center gap-2">
                <Mic className={cn("h-3 w-3", detecting.mic ? "text-muted-foreground" : "text-muted-foreground/50")} />
                <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className={cn("h-full", detecting.mic ? "bg-blue-500" : "bg-muted-foreground/30")}
                        initial={{ width: 0 }}
                        animate={{ width: `${levels.mic}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </div>
                <span className={cn("text-xs text-muted-foreground hidden sm:inline", !detecting.mic && "text-muted-foreground/50")}>
                    {levels.mic}%
                </span>
            </div>

            {/* System Audio Level */}
            <div className="flex items-center gap-2">
                <Volume2 className={cn("h-3 w-3", detecting.system ? "text-muted-foreground" : "text-muted-foreground/50")} />
                <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className={cn("h-full", detecting.system ? "bg-purple-500" : "bg-muted-foreground/30")}
                        initial={{ width: 0 }}
                        animate={{ width: `${levels.system}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </div>
                <span className={cn("text-xs hidden sm:inline", detecting.system ? "text-muted-foreground" : "text-muted-foreground/50")}>
                    {levels.system}%
                </span>
            </div>
        </div>
    );
}




