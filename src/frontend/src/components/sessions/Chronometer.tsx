
import { motion, useAnimationControls } from "framer-motion";
import { useEffect } from "react";

interface ChronometerProps {
    elapsedTime: number;
    isRecording: boolean;
    isPaused: boolean;
    audioLevel?: number; // Optional for backward compatibility, but we will pass it
}

export function Chronometer({ elapsedTime, isRecording, isPaused, audioLevel = 0 }: ChronometerProps) {
    const controls = useAnimationControls();

    useEffect(() => {
        if (isRecording && !isPaused) {
            // Map 0-100 audio level to shadow blur radius and opacity
            // Sensitivity adjustment: amplify small signals
            const intensity = Math.min(audioLevel * 1.5, 100) / 100;

            controls.start({
                textShadow: `0 0 ${10 * intensity}px rgba(16, 185, 129, ${0.3 + (0.5 * intensity)})`,
                scale: 1 + (0.02 * intensity), // Subtle scale bump on loud sounds
                transition: { type: "tween", duration: 0.1 } // Fast reaction
            });
        } else {
            controls.start({
                textShadow: "0 0 0px rgba(0,0,0,0)",
                scale: 1,
                transition: { duration: 0.5 }
            });
        }
    }, [audioLevel, isRecording, isPaused, controls]);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const h = hrs > 0 ? `${hrs}:` : '';
        const m = mins.toString().padStart(2, '0');
        const s = secs.toString().padStart(2, '0');

        return `${h}${m}:${s}`;
    };

    return (
        <div className="relative font-mono text-xl tracking-wider font-bold tabular-nums text-foreground/90 select-none flex items-center justify-center">
            {/* The main numbers */}
            <motion.div
                animate={controls}
            >
                {formatTime(elapsedTime)}
            </motion.div>

            {/* Back glow for "SOTA" feel - now strictly reactive */}
            {isRecording && !isPaused && (
                <motion.div
                    className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full -z-10"
                    animate={{
                        opacity: 0.2 + (audioLevel / 200), // Base glow + reactive boost
                        scale: 0.8 + (audioLevel / 300),
                    }}
                    transition={{ type: "tween", duration: 0.1 }}
                />
            )}
        </div>
    );
}
