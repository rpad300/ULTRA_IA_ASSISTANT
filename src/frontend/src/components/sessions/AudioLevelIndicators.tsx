import { motion, useSpring, useTransform, useMotionValue, MotionValue } from "framer-motion";
import { Mic, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useEffect, useState, useRef, memo, useMemo } from "react";

// --- Configuration & Constants ---
const SPRING_CONFIG = { stiffness: 300, damping: 20, mass: 0.5 };
const PEAK_HOLD_TIME_MS = 1000;
const PEAK_DECAY_RATE = 0.5;

import { AudioDeviceSelector } from "./AudioDeviceSelector";

// Pseudo-Logarithmic Scaling for "Pro" feel
// Maps linear 0-100 input to a curve that emphasizes the upper range (where clipping matters)
// while compressing the noise floor.
const toLogScale = (linear: number) => {
    // Simple quadratic ease-out implementation for visual "log-like" behavior
    // 50% linear -> 75% visual
    // 80% linear -> 96% visual
    if (linear <= 0) return 0;
    // return Math.pow(linear / 100, 0.5) * 100; // Too aggressive
    // Mixing linear and log:
    return (linear * 0.4) + (Math.pow(linear / 100, 0.7) * 60);
};

// OKLCH Colors
const COLORS = {
    mic: {
        from: "oklch(0.6 0.15 240)", // Blue
        to: "oklch(0.85 0.1 190)",   // Cyan
        glow: "oklch(0.85 0.1 190)"
    },
    system: {
        from: "oklch(0.55 0.2 300)", // Purple
        to: "oklch(0.75 0.18 330)",  // Magenta
        glow: "oklch(0.75 0.18 330)"
    },
    clip: "oklch(0.65 0.25 20)",     // Red Alert
};

// --- Custom Hooks ---

/**
 * Smoothing Engine & Peak Telemetry
 * Handles 60fps smoothing and peak hold logic detached from React render cycle where possible
 */
function useAudioTelemetry(targetLevel: number) {
    // Current smoothed level (0-100)
    const smoothLevel = useSpring(0, SPRING_CONFIG);

    // Peak Hold Logic
    const peakLevel = useMotionValue(0);
    const lastPeakTime = useRef<number>(0);

    // Apply scaling to the target before feeding the physics engine
    // This gives the meter a "Logarithmic" movement feel
    const scaledTarget = useMemo(() => toLogScale(targetLevel), [targetLevel]);

    useEffect(() => {
        smoothLevel.set(scaledTarget);

        const currentPeak = peakLevel.get();
        if (scaledTarget > currentPeak) {
            peakLevel.set(scaledTarget);
            lastPeakTime.current = Date.now();
        }
    }, [scaledTarget, smoothLevel, peakLevel]);

    // Decay loop for Peak
    useEffect(() => {
        let frameId: number;
        const update = () => {
            const now = Date.now();
            const timeSincePeak = now - lastPeakTime.current;
            const currentPeak = peakLevel.get();

            if (timeSincePeak > PEAK_HOLD_TIME_MS && currentPeak > 0) {
                const newPeak = Math.max(0, currentPeak - PEAK_DECAY_RATE);
                peakLevel.set(newPeak);
            }
            frameId = requestAnimationFrame(update);
        };
        frameId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frameId);
    }, [peakLevel]);

    return { smoothLevel, peakLevel, scaledTarget };
}

// --- Sub-Components ---

/**
 * AudioMeter: Optimized with CSS Gradients and Tooltips
 */
const AudioMeter = memo(({
    level,
    peak,
    colors,
    detecting,
    label,
    icon: Icon,
    rawValue // Passed for tooltip accuracy
}: {
    level: MotionValue<number>;
    peak: MotionValue<number>;
    colors: typeof COLORS.mic;
    detecting: boolean;
    label: string;
    icon: any;
    rawValue: number;
}) => {
    // Dynamic styles
    const barGradient = useTransform(level, (l) => {
        if (l > 90) return `linear-gradient(90deg, ${colors.from}, ${COLORS.clip})`;
        return `linear-gradient(90deg, ${colors.from}, ${colors.to})`;
    });

    const tipColor = useTransform(level, (l) => l > 90 ? COLORS.clip : colors.to);

    // Critical Alert Shake
    const xShake = useTransform(level, (l) => {
        if (l > 97) return Math.sin(Date.now() / 10) * 1;
        return 0;
    });

    // Generate specific dB string for Tooltip
    // Approximate mapping: 100% = 0dB, 50% = -12dB, 0% = -Inf
    const dBValue = rawValue > 0 ? (20 * Math.log10(rawValue / 100)).toFixed(1) : "-Inf";

    return (
        <div
            className="flex flex-col gap-1 w-full max-w-[200px] group select-none relative"
            role="meter"
            aria-label={`${label} Level`}
            aria-valuenow={Math.round(rawValue)}
            title={`${label}: ${Math.round(rawValue)}% (${dBValue} dB)`} // Native Tooltip for zero-overhead
        >
            <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5 transition-colors duration-300", detecting ? "text-foreground" : "text-muted-foreground/40")} />
                    <span className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors duration-300",
                        detecting ? "text-foreground/80" : "text-muted-foreground/40")}>
                        {label}
                    </span>
                </div>
                <div className="hidden sm:flex gap-2 text-[8px] text-muted-foreground/30 font-mono">
                    <span>-40</span>
                    <span>-10</span>
                    <span>0</span>
                </div>
            </div>

            {/* The Meter Track */}
            <div className="relative h-2 w-full bg-black/40 rounded-sm overflow-hidden ring-1 ring-white/5 backdrop-blur-sm">
                {/* CSS Mask Grid - Replaces 40 DOM nodes */}
                <div
                    className="absolute inset-0 z-20 w-full h-full pointer-events-none mix-blend-overlay"
                    style={{
                        backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.8) 3px, rgba(0,0,0,0.8) 4px)`
                    }}
                />

                {/* Main Level Bar */}
                <motion.div
                    className="h-full relative z-10 will-change-transform"
                    style={{
                        width: useTransform(level, l => `${l}%`),
                        background: barGradient,
                        boxShadow: "inset 1px 1px 0px rgba(255,255,255,0.2)",
                        x: xShake
                    }}
                >
                    {/* Glowing Tip */}
                    <motion.div
                        className="absolute right-0 top-0 bottom-0 w-[2px]"
                        style={{
                            backgroundColor: tipColor,
                            boxShadow: useTransform(level, (l) => `0 0 ${l * 0.15}px ${l > 90 ? COLORS.clip : colors.glow}`)
                        }}
                    />
                </motion.div>

                {/* Ghost Peak Indicator */}
                <motion.div
                    className="absolute top-0 bottom-0 w-[1.5px] bg-white/90 z-10 shadow-[0_0_4px_rgba(255,255,255,0.5)]"
                    style={{
                        left: useTransform(peak, p => `${p}%`),
                    }}
                />
            </div>
        </div>
    );
});

AudioMeter.displayName = "AudioMeter";

// --- Main Component ---

export function AudioLevelIndicators() {
    const { audioLevel, systemAudioLevel, audioServiceStatus, getAudioServiceStatus } = useMeetingStore();

    // Internal state for raw values (updated via polling/store)
    const [rawLevels, setRawLevels] = useState({ mic: 0, system: 0 });
    const [detecting, setDetecting] = useState({ mic: false, system: false });

    // Sync from store/service
    useEffect(() => {
        // Priority: Service Status (Realtime) > Store (Legacy/Browser)
        if (audioServiceStatus) {
            setRawLevels({
                mic: audioServiceStatus.levels?.mic?.rms ?? audioLevel,
                system: audioServiceStatus.levels?.system?.rms ?? systemAudioLevel
            });
            setDetecting({
                mic: (audioServiceStatus.levels?.mic?.rms ?? 0) > 0 || audioLevel > 0,
                system: (audioServiceStatus.levels?.system?.rms ?? 0) > 0 || systemAudioLevel > 0
            });
        } else {
            setRawLevels({ mic: audioLevel, system: systemAudioLevel });
            setDetecting({ mic: audioLevel > 0, system: systemAudioLevel > 0 });
        }
    }, [audioLevel, systemAudioLevel, audioServiceStatus]);

    // Polling logic for higher fidelity if service is capturing
    useEffect(() => {
        if (audioServiceStatus?.status.status !== 'capturing') return;

        const interval = setInterval(() => {
            getAudioServiceStatus().catch(() => { });
        }, 500);

        return () => clearInterval(interval);
    }, [audioServiceStatus?.status.status, getAudioServiceStatus]);

    // Telemetry Hooks
    const micTelemetry = useAudioTelemetry(rawLevels.mic);
    const systemTelemetry = useAudioTelemetry(rawLevels.system);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 py-2 px-3 bg-muted/20 sm:bg-transparent rounded-lg sm:rounded-none w-full sm:w-auto overflow-hidden">

            {/* Microphone Section: Selector + Meter */}
            <div className="flex items-center gap-2">
                <AudioDeviceSelector mode="mic" minimal className="w-[140px]" />
                <AudioMeter
                    label="MIC"
                    icon={Mic}
                    level={micTelemetry.smoothLevel}
                    peak={micTelemetry.peakLevel}
                    colors={COLORS.mic}
                    detecting={detecting.mic}
                    rawValue={rawLevels.mic}
                />
            </div>

            <div className="w-px h-8 bg-border/40 hidden sm:block mx-2" /> {/** Separator **/}

            {/* System Audio Section: Selector + Meter */}
            <div className="flex items-center gap-2">
                <AudioDeviceSelector mode="system" minimal className="w-[140px]" />
                <AudioMeter
                    label="SYS"
                    icon={Volume2}
                    level={systemTelemetry.smoothLevel}
                    peak={systemTelemetry.peakLevel}
                    colors={COLORS.system}
                    detecting={detecting.system}
                    rawValue={rawLevels.system}
                />
            </div>
        </div>
    );
}
