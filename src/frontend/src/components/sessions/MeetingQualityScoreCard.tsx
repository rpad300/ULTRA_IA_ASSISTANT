
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";

import { motion, AnimatePresence } from "framer-motion";
import {
    getScoreColorClass,
    getScoreLabel,
    METRIC_COLORS
} from "@/utils/meeting-quality-utils";
import { MeetingHealthGauge } from "./dashboard/MeetingHealthGauge";
import { ScoreHistorySparkline } from "./dashboard/ScoreHistorySparkline";
import { OptimizationTips } from "./dashboard/OptimizationTips";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function MeetingQualityScoreCard() {
    const {
        meetingQualityScore,
        isRecording,
        calculateMeetingQualityScore
    } = useMeetingStore();

    // Local state for UI
    const [isBreakdownOpen, setIsBreakdownOpen] = useState(false); // Collapsed by default on mobile (controlled via media query usually, but simple state here)
    const [previousScore, setPreviousScore] = useState(0);
    const [isCriticalDrop, setIsCriticalDrop] = useState(false);

    // Calculate quality score periodically
    useEffect(() => {
        if (!isRecording) return;

        // Initial calc
        calculateMeetingQualityScore();

        const interval = setInterval(() => {
            calculateMeetingQualityScore();
        }, 30000);

        return () => clearInterval(interval);
    }, [isRecording, calculateMeetingQualityScore]);

    // Monitor for critical drops
    useEffect(() => {
        if (meetingQualityScore) {
            const current = meetingQualityScore.overall;
            if (previousScore - current > 15) {
                setIsCriticalDrop(true);
                // Reset alert after 5s
                setTimeout(() => setIsCriticalDrop(false), 5000);
            }
            setPreviousScore(current);
        }
    }, [meetingQualityScore?.overall]);

    // Auto-expand breakdown on larger screens, collapse on mobile initially
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsBreakdownOpen(true);
            } else {
                setIsBreakdownOpen(false);
            }
        };

        handleResize(); // Set initial
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!meetingQualityScore) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm h-full flex flex-col justify-center items-center p-6 text-muted-foreground">
                <Activity className="h-8 w-8 mb-2 opacity-50 animate-pulse" />
                <p className="text-sm">Coletando dados da reunião...</p>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "border-border bg-card/50 backdrop-blur-sm transition-all duration-500",
            isCriticalDrop && "ring-2 ring-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        )}>
            <CardHeader className="p-3 border-b border-border/50 shrink-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Saúde da Reunião
                </CardTitle>
                <div className="flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={cn(
                            getScoreColorClass(meetingQualityScore.overall),
                            "border-current/20 bg-background/50"
                        )}
                    >
                        {getScoreLabel(meetingQualityScore.overall)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Top Section: Gauge & Score */}
                <div className="p-4 flex flex-col items-center relative overflow-hidden">
                    {/* Background Sparkline (Absolute) */}
                    <div className="absolute inset-x-0 bottom-0 h-16 opacity-10 pointer-events-none">
                        <ScoreHistorySparkline className="w-full h-full" />
                    </div>

                    <MeetingHealthGauge score={meetingQualityScore.overall} className="w-48 h-28 z-10" />

                    {/* Trend Line (Visible) */}
                    <div className="w-full h-8 mt-4 px-2">
                        <ScoreHistorySparkline className="w-full h-full opacity-60" />
                    </div>
                </div>

                {/* Optimization Tip */}
                <div className="px-3 pb-2">
                    <OptimizationTips metrics={meetingQualityScore} />
                </div>

                {/* Collapsible Breakdown */}
                <div className="border-t border-border/50">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full flex items-center justify-between p-3 h-auto hover:bg-muted/50 rounded-none text-muted-foreground text-xs"
                        onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
                    >
                        <span>Detalhamento de Métricas</span>
                        {isBreakdownOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>

                    <AnimatePresence initial={false}>
                        {isBreakdownOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="p-3 pt-0 space-y-3">
                                    <MetricRow
                                        label="Engajamento"
                                        value={meetingQualityScore.engagement}
                                        color={METRIC_COLORS.engagement}
                                        tooltip="Nível de interação ativa vs escuta passiva."
                                    />
                                    <MetricRow
                                        label="Clareza"
                                        value={meetingQualityScore.clarity}
                                        color={METRIC_COLORS.clarity}
                                        tooltip="Complexidade da linguagem e estrutura das frases."
                                    />
                                    <MetricRow
                                        label="Eficiência"
                                        value={meetingQualityScore.efficiency}
                                        color={METRIC_COLORS.efficiency}
                                        tooltip="Taxa de conclusão de tópicos por minuto."
                                    />
                                    <MetricRow
                                        label="Participação"
                                        value={meetingQualityScore.participation}
                                        color={METRIC_COLORS.participation}
                                        tooltip="Distribuição do tempo de fala entre os participantes."
                                    />
                                    <MetricRow
                                        label="Decisões"
                                        value={meetingQualityScore.decisionVelocity}
                                        color={METRIC_COLORS.decisionVelocity}
                                        tooltip="Frequência de decisões e ações detectadas."
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}

function MetricRow({ label, value, color, tooltip }: { label: string, value: number, color: string, tooltip: string }) {
    return (
        <div className="space-y-1 group">
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>{label}</span>
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">{tooltip}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <span className="font-mono font-medium" style={{ color: color }}>
                    {value}%
                </span>
            </div>
            <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, type: "spring" }}
                    className="h-full relative overflow-hidden"
                    style={{ backgroundColor: color }}
                >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </motion.div>
            </div>
        </div>
    );
}
