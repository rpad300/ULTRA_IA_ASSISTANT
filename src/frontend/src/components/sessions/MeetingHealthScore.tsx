import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, Target, Users, MessageSquare } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { useMeetingHealthTimer } from "@/hooks/useMeetingHealthTimer";
import { getMeetingVibe, getScoreColorOKLCH, RING_GRADIENTS } from "@/utils/meeting-quality-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RingProps {
    radius: number;
    stroke: number;
    value: number;
    gradientId: string;
    label: string;
    icon: React.ReactNode;
}

const MemoizedRing = memo(function Ring({ radius, stroke, value, gradientId, label, icon }: RingProps) {
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <g role="graphics-symbol" aria-label={`${label} Score: ${value}`} className="cursor-help hover:opacity-80 transition-opacity">
                        <title>{label}: {value}%</title>
                        {/* Background Track */}
                        <circle
                            cx="100"
                            cy="100"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth={stroke}
                            fill="none"
                            className="text-muted/20"
                        />
                        {/* Animated Value Ring */}
                        <motion.circle
                            cx="100"
                            cy="100"
                            r={radius}
                            stroke={`url(#${gradientId})`}
                            strokeWidth={stroke}
                            fill="none"
                            strokeDasharray={circumference}
                            strokeLinecap="round"
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: offset }}
                            transition={{
                                type: "spring",
                                stiffness: 60,
                                damping: 15,
                                mass: 1
                            }}
                            className="drop-shadow-sm"
                        />
                    </g>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                    {icon}
                    <div className="flex flex-col">
                        <span className="font-semibold">{label}</span>
                        <span className="text-xs text-muted-foreground">Impacta a {label.toLowerCase()} da reunião.</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

function AtmosphereRings({
    engagement,
    clarity,
    participation,
    progress
}: {
    engagement: number;
    clarity: number;
    participation: number;
    progress: number;
}) {
    return (
        <div className="relative w-full aspect-square max-w-[200px] md:max-w-[240px] mx-auto">
            <svg
                viewBox="0 0 200 200"
                className="w-full h-full transform -rotate-90"
            >
                <defs>
                    <linearGradient id="grad-engagement" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={RING_GRADIENTS.engagement.from} />
                        <stop offset="100%" stopColor={RING_GRADIENTS.engagement.to} />
                    </linearGradient>
                    <linearGradient id="grad-clarity" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={RING_GRADIENTS.clarity.from} />
                        <stop offset="100%" stopColor={RING_GRADIENTS.clarity.to} />
                    </linearGradient>
                    <linearGradient id="grad-participation" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={RING_GRADIENTS.participation.from} />
                        <stop offset="100%" stopColor={RING_GRADIENTS.participation.to} />
                    </linearGradient>
                    <linearGradient id="grad-progress" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={RING_GRADIENTS.progress.from} />
                        <stop offset="100%" stopColor={RING_GRADIENTS.progress.to} />
                    </linearGradient>
                </defs>

                {/* Outer Ring: Engagement (Most Critical) */}
                <MemoizedRing
                    radius={90}
                    stroke={12}
                    value={engagement}
                    gradientId="grad-engagement"
                    label="Engagement"
                    icon={<MessageSquare className="h-4 w-4" />}
                />

                {/* Middle Ring: Clarity */}
                <MemoizedRing
                    radius={74}
                    stroke={12}
                    value={clarity}
                    gradientId="grad-clarity"
                    label="Clarity"
                    icon={<Target className="h-4 w-4" />}
                />

                {/* Inner Ring: Participation */}
                <MemoizedRing
                    radius={58}
                    stroke={12}
                    value={participation}
                    gradientId="grad-participation"
                    label="Participation"
                    icon={<Users className="h-4 w-4" />}
                />

                {/* Core Ring: Progress */}
                <MemoizedRing
                    radius={42}
                    stroke={12}
                    value={progress}
                    gradientId="grad-progress"
                    label="Progress"
                    icon={<TrendingUp className="h-4 w-4" />}
                />
            </svg>

            {/* Center Content Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            </div>
        </div>
    );
}

export function MeetingHealthScore() {
    const meetingQualityScore = useMeetingStore(state => state.meetingQualityScore);
    const isRecording = useMeetingStore(state => state.isRecording);

    // Custom hook handles the interval updates efficiently
    useMeetingHealthTimer(20000);

    // WAITING STATE: Not recording
    if (!isRecording) {
        return (
            <Card className="border-border shadow-sm h-full flex flex-col justify-center opacity-70">
                <CardHeader className="p-4 border-b border-border/50">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        Live Atmosphere
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[200px] gap-3">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                        <Activity className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="font-medium text-sm text-muted-foreground">Waiting to Start</p>
                        <p className="text-xs text-muted-foreground/60 max-w-[180px]">
                            Metrics will activate once the session begins.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // LOADING STATE: Recording but no score yet
    if (!meetingQualityScore) {
        return (
            <Card className="border-border shadow-sm">
                <CardHeader className="p-4 border-b border-border/50">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Live Atmosphere
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="animate-pulse bg-muted rounded-full h-32 w-32 mb-4" />
                    <p className="text-xs text-muted-foreground text-center animate-pulse">
                        Synthesizing initial signals...
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { overall, engagement, clarity, participation, efficiency: progress, lastUpdated } = meetingQualityScore;
    const vibe = getMeetingVibe(meetingQualityScore);
    const overallColor = getScoreColorOKLCH(overall);

    const getTrendIcon = (score: number) => {
        if (score >= 80) return <TrendingUp className="h-4 w-4" />;
        if (score >= 60) return <Minus className="h-4 w-4" />;
        return <TrendingDown className="h-4 w-4" />;
    };

    return (
        <Card className="border-border shadow-md overflow-visible bg-gradient-to-b from-card to-muted/10 h-auto">
            <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary animate-pulse" style={{ animationDuration: overall > 80 ? '1s' : '3s' }} />
                    Live Atmosphere
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal opacity-70">
                    Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Badge>
            </CardHeader>
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-8 justify-center">

                    {/* Ring Visualizer */}
                    <div className="relative shrink-0">
                        <AtmosphereRings
                            engagement={engagement}
                            clarity={clarity}
                            participation={participation}
                            progress={progress}
                        />
                        {/* Floating Global Score in visual center */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <motion.div
                                key={overall}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex flex-col items-center"
                            >
                                <span className="text-3xl font-bold tracking-tighter transition-colors duration-500" style={{ color: overallColor }}>
                                    {overall}
                                </span>
                                <div className="text-muted-foreground" style={{ color: overallColor }}>
                                    {getTrendIcon(overall)}
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Vibe & Legend */}
                    <div className="flex flex-col gap-6 w-full max-w-xs">
                        <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Current Vibe</h4>
                            <motion.div
                                key={vibe}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-lg font-medium text-foreground"
                            >
                                {vibe}
                            </motion.div>
                        </div>

                        {/* Minimalist Legend for Ring Identification */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: RING_GRADIENTS.engagement.from, boxShadow: `0 0 8px ${RING_GRADIENTS.engagement.from}` }} />
                                <span className="text-muted-foreground">Engagement</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: RING_GRADIENTS.clarity.from, boxShadow: `0 0 8px ${RING_GRADIENTS.clarity.from}` }} />
                                <span className="text-muted-foreground">Clarity</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: RING_GRADIENTS.participation.from, boxShadow: `0 0 8px ${RING_GRADIENTS.participation.from}` }} />
                                <span className="text-muted-foreground">Participation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: RING_GRADIENTS.progress.from, boxShadow: `0 0 8px ${RING_GRADIENTS.progress.from}` }} />
                                <span className="text-muted-foreground">Progress</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
