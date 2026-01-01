import { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    Zap,
    MicOff,
    Gauge,
    AlertTriangle,
    Smile
} from "lucide-react";
import { motion } from "framer-motion";
import { useMeetingAnalytics } from "@/hooks/useMeetingAnalytics";
import { getSpeakerColor } from "@/utils/colorUtils";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Sub-components for Micro-interactions ---

// Number Ticker Component
function CountUp({ value, duration = 1 }: { value: number; duration?: number }) {
    const [displayValue, setDisplayValue] = useState(0);
    const prevValue = useRef(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        const start = prevValue.current;
        const end = value;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
            setDisplayValue(Math.floor(progress * (end - start) + start));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
        prevValue.current = value;
    }, [value, duration]);

    return <span>{displayValue}</span>;
}

// Sparkline Component
function EngagementSparkline({ data }: { data: number[] }) {
    const height = 40;
    const width = 120;
    if (data.length < 2) return null;

    const max = Math.max(...data, 1); // Avoid div by zero
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (d / max) * height;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={width} height={height} className="overflow-visible opacity-80">
            <motion.path
                d={`M ${points}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="text-primary"
            />
            {/* Gradient area under the curve could be added here for extra polish */}
        </svg>
    );
}

// Donut Chart Component
function ParticipationDonut({
    stats,
    fairnessScore
}: {
    stats: { speaker: string; percentage: number }[],
    fairnessScore: number
}) {
    const size = 160;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
                {stats.map((stat, i) => {
                    const offset = (accumulatedOffset / 100) * circumference;
                    const dashArray = (stat.percentage / 100) * circumference;
                    accumulatedOffset += stat.percentage;

                    return (
                        <motion.circle
                            key={stat.speaker}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={getSpeakerColor(stat.speaker)}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dashArray} ${circumference}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                            initial={{ strokeDasharray: `0 ${circumference}` }}
                            animate={{ strokeDasharray: `${dashArray} ${circumference}` }}
                            transition={{ duration: 0.8, delay: i * 0.1, type: "spring", stiffness: 60 }}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold tracking-tighter">
                    <CountUp value={Math.round(fairnessScore)} />
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Fairness
                </span>
            </div>
        </div>
    );
}

// Glass Card wrapper
function MetricCard({
    icon: Icon,
    label,
    value,
    subValue,
    trend,
    alert,
    tooltipText
}: {
    icon: any,
    label: string,
    value: React.ReactNode,
    subValue?: string,
    trend?: 'up' | 'down' | 'neutral',
    alert?: boolean,
    tooltipText?: string
}) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={cn(
                            "p-3 rounded-xl border backdrop-blur-md transition-all cursor-help",
                            alert ? "bg-red-500/10 border-red-500/30" : "bg-card/40 border-border/50 hover:bg-card/60"
                        )}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className={cn(
                                "p-1.5 rounded-md",
                                alert ? "bg-red-500/20 text-red-500" : "bg-primary/10 text-primary"
                            )}>
                                <Icon className="h-4 w-4" />
                            </div>
                            {trend && (
                                <span className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                    trend === 'up' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                                )}>
                                    {trend === 'up' ? 'High' : 'Low'}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-xl font-bold tracking-tight">{value}</span>
                                {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
                            </div>
                        </div>
                    </motion.div>
                </TooltipTrigger>
                {tooltipText && (
                    <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                        <p>{tooltipText}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

export function AdvancedAnalyticsDashboard() {
    const {
        statsBySpeaker,
        uniqueSpeakers,
        fairnessScore,
        monopolyScore,
        pacing,
        engagementPulse,
        silenceRatio,
        interruptionsCount,
    } = useMeetingAnalytics();

    // Determine visual state for pacing
    const getPaceColor = (status: 'Slow' | 'Ideal' | 'Fast') => {
        if (status === 'Ideal') return "text-green-500";
        if (status === 'Fast') return "text-orange-500";
        return "text-blue-500";
    };

    return (
        <>
            <style>
                {`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                `}
            </style>
            <Card className="border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl shadow-lg border-t-white/10">
                <CardHeader className="p-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary animate-pulse" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-400">
                                Dinâmica Social
                            </span>
                        </CardTitle>
                        {monopolyScore.isMonopoly && (
                            <Badge variant="destructive" className="animate-pulse shadow-red-500/20 shadow-lg">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Monopólio Detectado
                            </Badge>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-4 space-y-6">

                    {/* Section 1: The Arena (Donut + Legend) */}
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative shrink-0">
                            <ParticipationDonut stats={statsBySpeaker} fairnessScore={fairnessScore} />
                            {/* Monopoly Ring Effect */}
                            {monopolyScore.isMonopoly && (
                                <motion.div
                                    className="absolute inset-[-10px] rounded-full border-2 border-red-500/30"
                                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                />
                            )}
                        </div>

                        <div className="flex-1 w-full space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                                Participation Share
                                <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                                    {uniqueSpeakers} speakers
                                </span>
                            </h4>
                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                                {statsBySpeaker.map((stat, i) => (
                                    <motion.div
                                        key={stat.speaker}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center justify-between text-xs group p-1.5 rounded-md hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div
                                                className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                                                style={{ backgroundColor: getSpeakerColor(stat.speaker), color: getSpeakerColor(stat.speaker) }}
                                            />
                                            <span className="truncate font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                                                {stat.speaker}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-muted-foreground">
                                                {Math.floor(stat.talkTimeSeconds)}s
                                            </span>
                                            <Badge variant="secondary" className="w-[48px] justify-center bg-white/5 hover:bg-white/10">
                                                {Math.round(stat.percentage)}%
                                            </Badge>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: High-Fidelity Metric Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                        {/* Interruption Metric */}
                        <MetricCard
                            icon={Zap}
                            label="Interrupções"
                            value={<CountUp value={interruptionsCount} />}
                            alert={interruptionsCount > 10}
                            trend={interruptionsCount > 5 ? 'up' : 'neutral'}
                            subValue="trocas rápidas"
                            tooltipText="Trocas de turno de fala em menos de 2s. Alto número indica debate acalorado."
                        />

                        {/* Silence Ratio */}
                        <MetricCard
                            icon={MicOff}
                            label="Silêncio"
                            value={`${Math.round(silenceRatio * 100)}%`}
                            subValue="tempo total"
                            tooltipText="Porcentagem de tempo sem fala detectada. Ideal entre 10-20% para reflexão."
                        />

                        {/* Pacing Engine */}
                        <MetricCard
                            icon={Gauge}
                            label="Ritmo (WPM)"
                            value={
                                <span className={getPaceColor(pacing.status)}>
                                    {Math.round(pacing.wpm)}
                                </span>
                            }
                            subValue={pacing.status}
                            tooltipText={`Ritmo médio da conversação. ${pacing.wpm > 180 ? 'Muito rápido' : pacing.wpm < 120 ? 'Lento' : 'Ideal'}.`}
                        />

                        {/* Engagement Pulse (Sparkline) */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="p-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur-md flex flex-col justify-between"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                                    <Smile className="h-4 w-4" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Engagement Pulse</p>
                                <EngagementSparkline data={engagementPulse} />
                            </div>
                        </motion.div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
