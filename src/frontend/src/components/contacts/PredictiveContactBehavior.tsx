import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Brain,
    Calendar,
    MessageSquare,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Prediction {
    type: 'next_interaction' | 'topic' | 'decision' | 'risk' | 'opportunity';
    title: string;
    description: string;
    confidence: number;
    timeframe?: string;
    suggestedAction?: string;
}

interface PredictiveContactBehaviorProps {
    contactId: string;
    meetingsCount?: number;
    lastMeetingDate?: Date;
    projectsInCommon?: number;
}

export function PredictiveContactBehavior({
    meetingsCount = 0,
    lastMeetingDate,
    projectsInCommon = 0
}: PredictiveContactBehaviorProps) {
    const predictions: Prediction[] = useMemo(() => {
        const preds: Prediction[] = [];

        // Next Interaction Prediction
        const daysSinceLastMeeting = lastMeetingDate
            ? Math.floor((Date.now() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24))
            : 30;

        const nextInteractionDays = meetingsCount > 5 ? 7 : 14;
        preds.push({
            type: 'next_interaction',
            title: 'Next Interaction',
            description: `Provável interação em ${nextInteractionDays} dias`,
            confidence: meetingsCount > 5 ? 75 : 60,
            timeframe: `${nextInteractionDays} days`,
            suggestedAction: 'Agendar reunião de follow-up'
        });

        // Topic Prediction
        if (projectsInCommon > 0) {
            preds.push({
                type: 'topic',
                title: 'Likely Topics',
                description: 'Status do projeto, próximas entregas, bloqueios',
                confidence: 70,
                suggestedAction: 'Preparar atualização de status'
            });
        }

        // Decision Prediction
        if (meetingsCount > 3) {
            preds.push({
                type: 'decision',
                title: 'Decision Probability',
                description: `${meetingsCount > 8 ? 75 : 50}% chance de decisão positiva`,
                confidence: meetingsCount > 8 ? 80 : 60,
                suggestedAction: 'Apresentar proposta formal'
            });
        }

        // Risk Detection
        if (daysSinceLastMeeting > 30 && meetingsCount > 0) {
            preds.push({
                type: 'risk',
                title: 'Engagement Risk',
                description: 'Engajamento pode estar diminuindo',
                confidence: 65,
                suggestedAction: 'Reconectar urgentemente'
            });
        }

        // Opportunity Detection
        if (meetingsCount > 5 && projectsInCommon > 1) {
            preds.push({
                type: 'opportunity',
                title: 'Expansion Opportunity',
                description: 'Alto potencial para novos projetos',
                confidence: 70,
                suggestedAction: 'Propor novo projeto'
            });
        }

        return preds;
    }, [meetingsCount, lastMeetingDate, projectsInCommon]);

    const getPredictionIcon = (type: string) => {
        switch (type) {
            case 'next_interaction':
                return <Calendar className="h-4 w-4" />;
            case 'topic':
                return <MessageSquare className="h-4 w-4" />;
            case 'decision':
                return <CheckCircle2 className="h-4 w-4" />;
            case 'risk':
                return <AlertCircle className="h-4 w-4" />;
            case 'opportunity':
                return <TrendingUp className="h-4 w-4" />;
            default:
                return <Brain className="h-4 w-4" />;
        }
    };

    const getPredictionColor = (type: string) => {
        switch (type) {
            case 'next_interaction':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'topic':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'decision':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'risk':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'opportunity':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    Predictive Behavior
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {predictions.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground">
                            Insuficientes dados para previsões precisas
                        </p>
                    </div>
                ) : (
                    predictions.map((prediction, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                getPredictionColor(prediction.type)
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        {getPredictionIcon(prediction.type)}
                                        <div className="flex-1">
                                            <p className="font-medium">{prediction.title}</p>
                                            <p className="text-xs opacity-80 mt-0.5">
                                                {prediction.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                        {prediction.confidence}%
                                    </Badge>
                                </div>

                                {prediction.timeframe && (
                                    <div className="flex items-center gap-1 text-xs opacity-80">
                                        <Clock className="h-3 w-3" />
                                        <span>{prediction.timeframe}</span>
                                    </div>
                                )}

                                {prediction.suggestedAction && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs h-7 mt-2"
                                        onClick={() => {
                                            // TODO: Implement action
                                            console.log('Action:', prediction.suggestedAction);
                                        }}
                                    >
                                        {prediction.suggestedAction}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

