
import { useEffect, useState } from "react";
import { motion, useSpring, useTransform, animate } from "framer-motion";
import { getScoreColorOKLCH } from "@/utils/meeting-quality-utils";
import { cn } from "@/lib/utils";

interface MeetingHealthGaugeProps {
    score: number;
    className?: string;
}

export function MeetingHealthGauge({ score, className }: MeetingHealthGaugeProps) {
    // Spring for smooth needle movement
    const scoreSpring = useSpring(score, { stiffness: 60, damping: 15 });

    // Transform score (0-100) to rotation degrees (-90 to 90)
    // 0 -> -90deg, 50 -> 0deg, 100 -> 90deg
    const needleRotation = useTransform(scoreSpring, [0, 100], [-90, 90]);

    // Number Ticker Logic
    const [displayScore, setDisplayScore] = useState(score);

    useEffect(() => {
        scoreSpring.set(score);

        // Animate the number display
        const controls = animate(displayScore, score, {
            duration: 1.5,
            onUpdate: (latest) => setDisplayScore(Math.round(latest)),
            ease: "easeOut"
        });

        return () => controls.stop();
    }, [score]);

    const color = getScoreColorOKLCH(score);

    return (
        <div
            className={cn("relative flex flex-col items-center justify-center", className)}
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            aria-label="Overall Meeting Quality Score"
        >
            {/* SVG Gauge */}
            <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                {/* Background Arc */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                    className="text-muted/20"
                />

                {/* Colored Active Arc (Masked or partial if needed, but simple needle is cleaner for SOTA look) */}
                {/* Let's do a gradient arc that fills up to the point? No, User asked for "needle or circular fill". 
                    A needle is more "Cockpit". Let's update to a segmented gauge look.
                */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#gauge-gradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    className="opacity-80"
                />

                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="oklch(0.55 0.22 25)" /> {/* Red */}
                        <stop offset="50%" stopColor="oklch(0.75 0.16 85)" />  {/* Yellow */}
                        <stop offset="100%" stopColor="oklch(0.65 0.18 150)" /> {/* Green */}
                    </linearGradient>
                </defs>

                {/* Needle */}
                <motion.g style={{ rotate: needleRotation, originX: "100px", originY: "100px" }}>
                    <line
                        x1="100" y1="100"
                        x2="100" y2="30"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        className="text-foreground"
                    />
                    <circle cx="100" cy="100" r="6" fill="currentColor" className="text-foreground" />
                </motion.g>

                {/* Ticks (Optional polish) */}
                <g className="text-muted/40 font-mono text-[10px]">
                    <text x="20" y="115" textAnchor="middle">0</text>
                    <text x="100" y="85" textAnchor="middle">50</text>
                    <text x="180" y="115" textAnchor="middle">100</text>
                </g>
            </svg>

            {/* Score Display (Number Ticker) */}
            <div className="absolute -bottom-2 flex flex-col items-center">
                <motion.div
                    className="text-4xl font-bold tabular-nums tracking-tighter"
                    style={{ color }}
                >
                    {displayScore}
                </motion.div>
            </div>
        </div>
    );
}
