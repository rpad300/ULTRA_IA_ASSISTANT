
import { useRef, useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AudioMeterProps {
    level: number; // 0 to 100
    label?: string;
    className?: string;
}

export function AudioMeter({ level, label, className }: AudioMeterProps) {
    // Peak Holding
    const [peak, setPeak] = useState(0);
    const peakTimeoutRef = useRef<any>(null);
    const controls = useAnimation();

    // Update Peak
    useEffect(() => {
        if (level > peak) {
            setPeak(level);
            if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current);
            peakTimeoutRef.current = setTimeout(() => setPeak(0), 1500); // Hold for 1.5s
        }
    }, [level, peak]);

    // Clipping Shake Animation
    useEffect(() => {
        if (level > 90) {
            controls.start({
                x: [-1, 1, -1, 1, 0],
                transition: { duration: 0.2 }
            });
        }
    }, [level, controls]);

    // Color Logic
    const getColor = (val: number) => {
        if (val > 90) return 'bg-red-500';
        if (val > 70) return 'bg-amber-400';
        return 'bg-emerald-500';
    };

    return (
        <div className={cn("space-y-1", className)}>
            {label && (
                <div className="flex justify-between text-[10px] uppercase font-medium text-zinc-500 tracking-wider">
                    <span>{label}</span>
                    <span className={cn(level > 90 ? "text-red-500 font-bold" : "text-zinc-600")}>{Math.round(level)}%</span>
                </div>
            )}

            <motion.div
                animate={controls}
                className="h-2 bg-zinc-900/50 rounded-full overflow-hidden border border-zinc-800 relative"
            >
                {/* Background Segments (Mask) - simulated via grid in CSS for performance or simple repeating gradient */}
                <div className="absolute inset-0 z-20 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(to right, transparent 2px, rgba(0,0,0,0.5) 3px)`,
                        backgroundSize: '4px 100%'
                    }}
                />

                {/* Main Level Bar */}
                <div
                    className={cn("h-full transition-all duration-75 ease-out", getColor(level))}
                    style={{ width: `${level}%` }}
                />

                {/* Peak Indicator */}
                {peak > level && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10 transition-all duration-300"
                        style={{ left: `${peak}%` }}
                    />
                )}
            </motion.div>
        </div>
    );
}
