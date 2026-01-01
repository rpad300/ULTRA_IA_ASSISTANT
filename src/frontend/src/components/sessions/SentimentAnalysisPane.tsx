import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, Wind, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { useEmotionalClimate } from "@/hooks/useEmotionalClimate";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Animated Number Component
function AnimatedMetric({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="flex flex-col items-center bg-card/40 rounded-lg p-2 border border-white/5">
            <span className={cn("text-xl font-bold font-mono tracking-tight tabular-nums", color)}>
                {/* Simple animation via key */}
                <motion.span
                    key={value}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    {value}
                </motion.span>
                %
            </span>
            <span className="text-[10px] text-muted-foreground uppercase opacity-70">{label}</span>
        </div>
    );
}

export function SentimentAnalysisPane() {
    // SOTA Hook
    const { positive, neutral, negative, overall, vibe, trend, criticalMoment } = useEmotionalClimate();
    const { setFocusedBlockId } = useMeetingStore();

    // Vibrant OKLCH-derived colors for Chart
    const chartData = useMemo(() => {
        // Transform trend data relative to chart needs
        // We want a stacked area or a "pulse".
        // Let's do a "Sentiment Flow": +1 for Pos, 0 for Neu, -1 for Neg, but cumulative?
        // User asked for "Stacked Area" OR "Pulse".
        // Stacked Area usually means % of sentiment over time window.
        // Let's create a sliding window relative distribution 
        // OR better: A smoothed "Sentiment Velocity" curve.

        // Actually, user explicitly asked for "Stacked Area or Pulse".
        // Stacked Area is great for showing composition over time.

        return trend.map((t, i) => ({
            index: i,
            id: t.id,
            sentiment: t.sentiment,
            // Stack values: 1 for correct sentiment, 0 for others
            pos: t.sentiment === 'positive' ? 1 : 0,
            neu: t.sentiment === 'neutral' ? 1 : 0,
            neg: t.sentiment === 'negative' ? 1 : 0,
            speaker: t.speaker,
            text: t.text
        }));
    }, [trend]);

    // Dynamic Glow Aura based on Overall Sentiment
    const glowColor = useMemo(() => {
        switch (overall) {
            case 'positive': return "shadow-[0_0_50px_-12px_rgba(16,185,129,0.5)] border-emerald-500/30";
            case 'negative': return "shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)] border-rose-500/30";
            default: return "shadow-[0_0_50px_-12px_rgba(234,179,8,0.5)] border-amber-500/30";
        }
    }, [overall]);

    const headerIcon = useMemo(() => {
        switch (overall) {
            case 'positive': return <TrendingUp className="h-4 w-4 text-emerald-400" />;
            case 'negative': return <TrendingDown className="h-4 w-4 text-rose-400" />;
            default: return <Minus className="h-4 w-4 text-amber-400" />;
        }
    }, [overall]);

    const handleTrendClick = (blockId: string) => {
        setFocusedBlockId(blockId);
    };

    if (trend.length === 0) {
        return (
            <Card className="border-border/50 bg-black/20 backdrop-blur-xl h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
                    <Activity className="h-8 w-8 opacity-50" />
                    <span className="text-xs font-medium">Waiting for signals...</span>
                </div>
            </Card>
        );
    }

    return (
        <Card className={cn("border-border/40 bg-card/10 backdrop-blur-xl overflow-hidden transition-all duration-700", glowColor)}>
            <CardHeader className="p-4 border-b border-border/10 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                        <Zap className="h-4 w-4 text-primary" />
                        Emotional Climate
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {criticalMoment.type !== 'stable' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                    criticalMoment.type === 'upturn' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                )}
                            >
                                {criticalMoment.type === 'upturn' ? "Upturn" : "Drop"}
                            </motion.div>
                        )}
                        <Badge variant="outline" className="text-xs backdrop-blur-md bg-background/20 border-border/20">
                            {headerIcon}
                            <span className="ml-1.5 capitalize font-mono tracking-tighter">{vibe}</span>
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 relative">
                {/* 1. Main Metrics - Spring Physics Integers defined via simple Key mainly, or we could use MotionValue for integers but keeping it simple for now */}
                <div className="grid grid-cols-3 gap-1 p-4 pb-2">
                    <AnimatedMetric label="Positivity" value={positive} color="text-emerald-400" />
                    <AnimatedMetric label="Neutrality" value={neutral} color="text-amber-400" />
                    <AnimatedMetric label="Negativity" value={negative} color="text-rose-400" />
                </div>

                {/* 2. Stacked Area Chart "Sentiment Pulse" */}
                <div className="h-32 w-full mt-2 relative group">
                    {/* Blurry Glow Background behind chart */}
                    <div className={cn("absolute inset-0 opacity-20 blur-2xl transition-colors duration-1000 pointer-events-none",
                        overall === 'positive' ? 'bg-emerald-500/30' : overall === 'negative' ? 'bg-rose-500/30' : 'bg-amber-500/30'
                    )} />

                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradNeu" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            {/* We stack them to show volume composition */}
                            <Area
                                type="monotone"
                                dataKey="neg"
                                stackId="1"
                                stroke="#f43f5e"
                                fill="url(#gradNeg)"
                                strokeWidth={2}
                                isAnimationActive={true}
                            />
                            <Area
                                type="monotone"
                                dataKey="neu"
                                stackId="1"
                                stroke="#f59e0b"
                                fill="url(#gradNeu)"
                                strokeWidth={2}
                                isAnimationActive={true}
                            />
                            <Area
                                type="monotone"
                                dataKey="pos"
                                stackId="1"
                                stroke="#10b981"
                                fill="url(#gradPos)"
                                strokeWidth={2}
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* 3. Interactive Trend Bar (Deep Linking) */}
                <div className="px-4 pb-4 mt-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Live Stream</span>
                        <Wind className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                    <div className="flex h-3 gap-0.5 w-full mask-linear-fade">
                        <TooltipProvider delayDuration={0}>
                            {trend.map((block) => (
                                <Tooltip key={block.id}>
                                    <TooltipTrigger asChild>
                                        <motion.button
                                            layoutId={`block-${block.id}`}
                                            initial={{ scaleY: 0 }}
                                            animate={{ scaleY: 1 }}
                                            className={cn(
                                                "flex-1 rounded-sm cursor-pointer transition-all hover:scale-y-150 hover:brightness-125 focus:ring-1 focus:ring-ring focus:outline-none relative",
                                                block.sentiment === 'positive' ? "bg-emerald-500" : block.sentiment === 'negative' ? "bg-rose-500" : "bg-amber-500/80"
                                            )}
                                            onClick={() => handleTrendClick(block.id)}
                                            whileHover={{ zIndex: 10 }}
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-black/90 text-xs p-2 border-white/10 backdrop-blur-xl">
                                        <p className="font-bold text-emerald-400 mb-0.5">{block.speaker}</p>
                                        <p className="text-white/80 max-w-[200px] truncate">{block.text}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </TooltipProvider>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}

