import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

export function MeetingQualityScoreCard() {
    const { 
        meetingQualityScore,
        isRecording,
        calculateMeetingQualityScore
    } = useMeetingStore();
    
    // Calculate quality score periodically
    useEffect(() => {
        if (!isRecording) return;
        
        const interval = setInterval(() => {
            calculateMeetingQualityScore();
        }, 30000); // Calculate every 30 seconds (optimized for performance)
        
        return () => clearInterval(interval);
    }, [isRecording, calculateMeetingQualityScore]);
    
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };
    
    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excelente';
        if (score >= 60) return 'Bom';
        if (score >= 40) return 'Regular';
        return 'Precisa Melhorar';
    };
    
    const getTrendIcon = (score: number) => {
        if (score >= 80) return <TrendingUp className="h-4 w-4 text-green-400" />;
        if (score >= 60) return <Minus className="h-4 w-4 text-yellow-400" />;
        return <TrendingDown className="h-4 w-4 text-red-400" />;
    };
    
    if (!meetingQualityScore) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Score de Qualidade
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Score será calculado durante a reunião
                    </p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Score de Qualidade
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-4">
                {/* Overall Score */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className={cn(
                                "text-4xl font-bold",
                                getScoreColor(meetingQualityScore.overall)
                            )}
                        >
                            {meetingQualityScore.overall}
                        </motion.div>
                        {getTrendIcon(meetingQualityScore.overall)}
                    </div>
                    <Badge 
                        variant="outline" 
                        className={cn(
                            getScoreColor(meetingQualityScore.overall),
                            "border-current"
                        )}
                    >
                        {getScoreLabel(meetingQualityScore.overall)}
                    </Badge>
                </div>
                
                {/* Breakdown */}
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span>Engajamento</span>
                            <span className={getScoreColor(meetingQualityScore.engagement)}>
                                {meetingQualityScore.engagement}%
                            </span>
                        </div>
                        <Progress value={meetingQualityScore.engagement} className="h-1.5" />
                    </div>
                    
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span>Clareza</span>
                            <span className={getScoreColor(meetingQualityScore.clarity)}>
                                {meetingQualityScore.clarity}%
                            </span>
                        </div>
                        <Progress value={meetingQualityScore.clarity} className="h-1.5" />
                    </div>
                    
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span>Eficiência</span>
                            <span className={getScoreColor(meetingQualityScore.efficiency)}>
                                {meetingQualityScore.efficiency}%
                            </span>
                        </div>
                        <Progress value={meetingQualityScore.efficiency} className="h-1.5" />
                    </div>
                    
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span>Participação</span>
                            <span className={getScoreColor(meetingQualityScore.participation)}>
                                {meetingQualityScore.participation}%
                            </span>
                        </div>
                        <Progress value={meetingQualityScore.participation} className="h-1.5" />
                    </div>
                    
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span>Velocidade de Decisão</span>
                            <span className={getScoreColor(meetingQualityScore.decisionVelocity)}>
                                {meetingQualityScore.decisionVelocity}%
                            </span>
                        </div>
                        <Progress value={meetingQualityScore.decisionVelocity} className="h-1.5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

