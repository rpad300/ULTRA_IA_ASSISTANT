import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, MessageSquare, Clock, TrendingUp } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

export function AdvancedAnalyticsDashboard() {
    const {
        transcriptBlocks,
        elapsedTime,
        isRecording
    } = useMeetingStore();

    const analytics = useMemo(() => {
        const totalBlocks = transcriptBlocks.length;
        const uniqueSpeakers = new Set(transcriptBlocks.map(b => b.speaker)).size;
        const totalWords = transcriptBlocks.reduce((sum, b) => sum + b.text.split(' ').length, 0);

        // Talk time distribution
        const talkTimeByParticipant = new Map<string, number>();
        transcriptBlocks.forEach(block => {
            const current = talkTimeByParticipant.get(block.speaker) || 0;
            // Estimate: ~150 words per minute
            const words = block.text.split(' ').length;
            const estimatedSeconds = (words / 150) * 60;
            talkTimeByParticipant.set(block.speaker, current + estimatedSeconds);
        });

        const totalTalkTime = Array.from(talkTimeByParticipant.values()).reduce((sum, t) => sum + t, 0);
        const talkTimeDistribution = Array.from(talkTimeByParticipant.entries()).map(([speaker, time]) => ({
            speaker,
            time,
            percentage: totalTalkTime > 0 ? (time / totalTalkTime) * 100 : 0
        })).sort((a, b) => b.percentage - a.percentage);

        // Interruption frequency (blocks that start within 1 second of previous)
        let interruptions = 0;
        for (let i = 1; i < transcriptBlocks.length; i++) {
            const prev = transcriptBlocks[i - 1];
            const curr = transcriptBlocks[i];
            if (curr.speaker !== prev.speaker && (curr.timestamp - prev.timestamp) < 2) {
                interruptions++;
            }
        }

        // Energy level (based on sentiment and pace)
        const positiveBlocks = transcriptBlocks.filter(b => b.sentiment === 'positive').length;
        const energyLevel = totalBlocks > 0 ? (positiveBlocks / totalBlocks) * 100 : 50;

        // Words per minute
        const minutes = elapsedTime / 60;
        const wordsPerMinute = minutes > 0 ? totalWords / minutes : 0;

        return {
            totalBlocks,
            uniqueSpeakers,
            totalWords,
            talkTimeDistribution: talkTimeDistribution.slice(0, 5),
            interruptions,
            energyLevel,
            wordsPerMinute
        };
    }, [transcriptBlocks, elapsedTime]);

    if (!isRecording || transcriptBlocks.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Analytics Avançados
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Analytics aparecerão quando a reunião começar
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Analytics Avançados
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-4 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {/* Talk Time Distribution */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Distribuição de Tempo de Fala
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {analytics.talkTimeDistribution.map((item, index) => (
                            <motion.div
                                key={item.speaker}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="space-y-1"
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <span className="truncate flex-1">{item.speaker}</span>
                                    <span className="text-muted-foreground ml-2">
                                        {Math.round(item.percentage)}%
                                    </span>
                                </div>
                                <Progress value={item.percentage} className="h-1.5" />
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg border border-border bg-card/30">
                        <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Blocos</span>
                        </div>
                        <p className="text-lg font-semibold">{analytics.totalBlocks}</p>
                    </div>

                    <div className="p-2 rounded-lg border border-border bg-card/30">
                        <div className="flex items-center gap-1 mb-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Participantes</span>
                        </div>
                        <p className="text-lg font-semibold">{analytics.uniqueSpeakers}</p>
                    </div>

                    <div className="p-2 rounded-lg border border-border bg-card/30">
                        <div className="flex items-center gap-1 mb-1">
                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Pal/min</span>
                        </div>
                        <p className="text-lg font-semibold">{Math.round(analytics.wordsPerMinute)}</p>
                    </div>

                    <div className="p-2 rounded-lg border border-border bg-card/30">
                        <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Interrupções</span>
                        </div>
                        <p className="text-lg font-semibold">{analytics.interruptions}</p>
                    </div>
                </div>

                {/* Energy Level */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Nível de Energia</span>
                        <Badge variant="outline" className="text-xs">
                            {Math.round(analytics.energyLevel)}%
                        </Badge>
                    </div>
                    <Progress value={analytics.energyLevel} className="h-2" />
                </div>
            </CardContent>
        </Card>
    );
}

