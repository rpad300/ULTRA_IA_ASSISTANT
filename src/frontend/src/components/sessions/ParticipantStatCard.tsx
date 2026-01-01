import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Mic, MousePointerClick, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { formatTime } from "@/utils/timeUtils";
import { TooltipWrapper } from "@/components/ui/tooltip";
import { getSpeakerColor } from "@/utils/colorUtils";

// --- SVG Components ---

interface EngagementDonutProps {
    percentage: number;
    color?: string;
    size?: number;
    strokeWidth?: number;
}

const EngagementDonut = ({ percentage, color = "currentColor", size = 40, strokeWidth = 3 }: EngagementDonutProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    className="text-muted/20"
                />
                <circle
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    className="transition-all duration-500 ease-out"
                    strokeLinecap="round"
                />
            </svg>
            <span className="absolute text-[10px] font-semibold">{percentage}%</span>
        </div>
    );
};

interface SparklineProps {
    data: number[];
    color?: string;
    height?: number;
    width?: number;
}

const Sparkline = ({ data, color = "currentColor", height = 24, width = 60 }: SparklineProps) => {
    if (!data || data.length < 2) return <div style={{ width, height }} className="bg-muted/10 rounded" />;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((val: number, i: number) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

// --- Component Interface ---

export interface InsightsData {
    id: string;
    name: string;
    isGuest: boolean;
    isSpeaking: boolean;
    speakingTime: number;
    contributions: number;
    airtimePercentage: number;
    avgSentiment: number;
    activityTrend: number[];
    lastActive: number;
}

interface ParticipantStatCardProps {
    data: InsightsData;
    isFiltered: boolean;
    onClick: () => void;
}

export function ParticipantStatCard({ data: p, isFiltered, onClick }: ParticipantStatCardProps) {
    // Generate stable color for this participant
    const speakerColor = useMemo(() => getSpeakerColor(p.name), [p.name]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "relative p-4 group transition-all duration-200 cursor-pointer rounded-lg sm:rounded-none shrink-0",
                "w-[85vw] sm:w-auto snap-center sm:snap-align-none border sm:border-0 border-border bg-card sm:bg-transparent shadow-sm sm:shadow-none",
                "hover:bg-muted/30 sm:hover:bg-muted/30",
                isFiltered
                    ? "bg-primary/5 sm:bg-primary/5 border-primary/20 sm:border-l-primary sm:border-l-2"
                    : "sm:border-l-2 sm:border-l-transparent",
                p.isSpeaking && "bg-muted/30 sm:bg-muted/30"
            )}
            onClick={onClick}
        >
            {/* Active Speaker Glow Effect - Desktop Left Border or Mobile Ring */}
            {p.isSpeaking && (
                <motion.div
                    layoutId="speaking-glow"
                    className="absolute inset-0 border-2 border-primary/20 rounded-lg sm:rounded-none pointer-events-none"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
            )}

            <div className="flex items-start justify-between">
                {/* Left: Avatar & Info */}
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all relative overflow-hidden shrink-0",
                            p.isSpeaking ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100",
                        )}
                        style={{
                            backgroundColor: speakerColor,
                            color: '#1a1a1a' // Dark text usually works better on pastel OKLCH
                        }}
                    >
                        {p.name[0]?.toUpperCase() || "?"}
                        {p.isSpeaking && (
                            <div className="absolute bottom-0 inset-x-0 h-1/3 bg-black/10 flex items-end justify-center pb-1">
                                <div className="flex gap-0.5 h-full items-end">
                                    {[1, 2, 3].map(i => (
                                        <motion.div
                                            key={i}
                                            className="w-0.5 bg-black/40"
                                            animate={{ height: ["20%", "100%", "20%"] }}
                                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className={cn("text-sm font-medium leading-none truncate", p.isSpeaking && "text-primary")}>
                                {p.name}
                            </h4>
                            {p.isGuest && <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">Guest</Badge>}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <TooltipWrapper content="Speaking Time">
                                <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(p.speakingTime)}
                                </span>
                            </TooltipWrapper>
                            <TooltipWrapper content="Contributions">
                                <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                                    <motion.div
                                        animate={p.isSpeaking ? { scale: [1, 1.2, 1] } : {}}
                                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                                    >
                                        <Mic className="h-3 w-3" />
                                    </motion.div>
                                    {p.contributions}
                                </span>
                            </TooltipWrapper>
                        </div>
                    </div>
                </div>

                {/* Right: Viz */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">

                    {/* Sentiment Indicator */}
                    {(p.avgSentiment > 0.2 || p.avgSentiment < -0.2) && (
                        <TooltipWrapper content={`Sentiment: ${p.avgSentiment > 0.2 ? "Positive" : "Negative"}`}>
                            <div className={cn(
                                "text-lg",
                                p.avgSentiment > 0.2 ? "text-green-500 scale-100" : "text-red-500 scale-100"
                            )}>
                                {p.avgSentiment > 0.2 ? "😊" : "😟"}
                            </div>
                        </TooltipWrapper>
                    )}

                    {/* Sparkline (Desktop only usually, but good for Tablet too) */}
                    <div className="hidden sm:block opacity-50 group-hover:opacity-100 transition-opacity w-[50px]">
                        <TooltipWrapper content="Activity over time">
                            <div>
                                <Sparkline data={p.activityTrend} color={speakerColor} />
                            </div>
                        </TooltipWrapper>
                    </div>

                    {/* Airtime Donut */}
                    <div className="flex flex-col items-center">
                        <TooltipWrapper content="Percentage of total airtime">
                            <div>
                                <EngagementDonut
                                    percentage={p.airtimePercentage}
                                    color={speakerColor}
                                    size={36}
                                />
                            </div>
                        </TooltipWrapper>
                    </div>
                </div>
            </div>

            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <TooltipWrapper content="Click to filter transcript">
                    <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                </TooltipWrapper>
            </div>

            {/* "Dormant" State Overlay */}
            {p.contributions === 0 && !p.isSpeaking && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg sm:rounded-none z-10">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Listening...
                    </span>
                </div>
            )}
        </motion.div>
    );
}
