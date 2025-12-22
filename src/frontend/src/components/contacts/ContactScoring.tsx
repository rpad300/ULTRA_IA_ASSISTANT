import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    Users,
    MessageSquare,
    Award,
    Target,
    Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ContactScores {
    relationship: number; // 0-100
    engagement: number; // 0-100
    influence: number; // 0-100
    value: number; // 0-100
    overall: number; // 0-100
    trend: 'up' | 'down' | 'stable';
    lastUpdated: number;
}

interface ContactScoringProps {
    contactId: string;
    meetingsCount?: number;
    tasksCount?: number;
    projectsInCommon?: number;
}

export function ContactScoring({
    meetingsCount = 0,
    tasksCount = 0,
    projectsInCommon = 0
}: ContactScoringProps) {
    // Calculate scores based on available data
    const scores: ContactScores = useMemo(() => {
        // Relationship Score: Based on meetings and projects in common
        const relationshipScore = Math.min(100,
            (meetingsCount * 5) + (projectsInCommon * 15) + (tasksCount * 3)
        );

        // Engagement Score: Based on interaction frequency
        const engagementScore = Math.min(100,
            meetingsCount > 10 ? 85 :
                meetingsCount > 5 ? 70 :
                    meetingsCount > 2 ? 50 : 30
        );

        // Influence Score: Simulated based on role and interactions
        const influenceScore = Math.min(100,
            meetingsCount > 8 ? 75 :
                meetingsCount > 4 ? 60 : 40
        );

        // Value Score: Based on tasks and projects
        const valueScore = Math.min(100,
            (tasksCount * 10) + (projectsInCommon * 20)
        );

        // Overall Score: Weighted average
        const overall = Math.round(
            relationshipScore * 0.3 +
            engagementScore * 0.25 +
            influenceScore * 0.25 +
            valueScore * 0.2
        );

        // Determine trend (simulated)
        const trend: 'up' | 'down' | 'stable' =
            meetingsCount > 8 ? 'up' :
                meetingsCount < 3 ? 'down' : 'stable';

        return {
            relationship: Math.round(relationshipScore),
            engagement: Math.round(engagementScore),
            influence: Math.round(influenceScore),
            value: Math.round(valueScore),
            overall,
            trend,
            lastUpdated: Date.now()
        };
    }, [meetingsCount, tasksCount, projectsInCommon]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        if (score >= 40) return "text-orange-400";
        return "text-red-400";
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 80) return "bg-green-500/20";
        if (score >= 60) return "bg-yellow-500/20";
        if (score >= 40) return "bg-orange-500/20";
        return "bg-red-500/20";
    };

    const getTrendIcon = () => {
        switch (scores.trend) {
            case 'up':
                return <TrendingUp className="h-4 w-4 text-green-400" />;
            case 'down':
                return <TrendingDown className="h-4 w-4 text-red-400" />;
            default:
                return null;
        }
    };

    const recommendations = useMemo(() => {
        const recs: string[] = [];

        if (scores.relationship < 50) {
            recs.push("Agende mais reuniões para fortalecer o relacionamento");
        }
        if (scores.engagement < 50) {
            recs.push("Aumente a frequência de interações");
        }
        if (scores.influence < 50) {
            recs.push("Identifique oportunidades para aumentar influência");
        }
        if (scores.value < 50) {
            recs.push("Crie mais tasks e projetos em comum");
        }

        if (recs.length === 0) {
            recs.push("Relacionamento saudável - mantenha o engajamento");
        }

        return recs;
    }, [scores]);

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        Contact Intelligence Score
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {getTrendIcon()}
                        <Badge
                            variant="outline"
                            className={cn("text-xs", getScoreBgColor(scores.overall))}
                        >
                            {scores.overall}/100
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Overall Score Gauge */}
                <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                        <svg className="transform -rotate-90 w-32 h-32">
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                className="text-muted"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={`${(scores.overall / 100) * 351.86} 351.86`}
                                className={cn("transition-all duration-500", getScoreColor(scores.overall))}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className={cn("text-2xl font-bold", getScoreColor(scores.overall))}>
                                    {scores.overall}
                                </div>
                                <div className="text-xs text-muted-foreground">Overall</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span>Relationship</span>
                            </div>
                            <span className={cn("font-medium", getScoreColor(scores.relationship))}>
                                {scores.relationship}%
                            </span>
                        </div>
                        <Progress value={scores.relationship} className="h-1.5" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                <span>Engagement</span>
                            </div>
                            <span className={cn("font-medium", getScoreColor(scores.engagement))}>
                                {scores.engagement}%
                            </span>
                        </div>
                        <Progress value={scores.engagement} className="h-1.5" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <Target className="h-3 w-3 text-muted-foreground" />
                                <span>Influence</span>
                            </div>
                            <span className={cn("font-medium", getScoreColor(scores.influence))}>
                                {scores.influence}%
                            </span>
                        </div>
                        <Progress value={scores.influence} className="h-1.5" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <Award className="h-3 w-3 text-muted-foreground" />
                                <span>Value</span>
                            </div>
                            <span className={cn("font-medium", getScoreColor(scores.value))}>
                                {scores.value}%
                            </span>
                        </div>
                        <Progress value={scores.value} className="h-1.5" />
                    </div>
                </div>

                {/* Recommendations */}
                <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold">
                        <Info className="h-3 w-3" />
                        Recommendations
                    </div>
                    <ul className="space-y-1">
                        {recommendations.map((rec, idx) => (
                            <motion.li
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                            >
                                <span className="text-primary mt-0.5">•</span>
                                <span>{rec}</span>
                            </motion.li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

