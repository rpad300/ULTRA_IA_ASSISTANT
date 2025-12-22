import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";

export function FlowPredictionPane() {
    const { 
        flowPredictions, 
        isRecording, 
        predictNextTopics 
    } = useMeetingStore();
    
    // Predict next topics periodically
    useEffect(() => {
        if (!isRecording) return;
        
        const interval = setInterval(() => {
            predictNextTopics();
        }, 45000); // Predict every 45 seconds (optimized for performance)
        
        return () => clearInterval(interval);
    }, [isRecording, predictNextTopics]);
    
    const formatEstimatedTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        return minutes > 0 ? `${minutes} min` : `${seconds}s`;
    };
    
    const getTopicLabel = (topic: string) => {
        const labels: Record<string, string> = {
            'budget': 'Orçamento',
            'timeline': 'Cronograma',
            'scope': 'Escopo',
            'risks': 'Riscos',
            'decisions': 'Decisões'
        };
        return labels[topic] || topic;
    };
    
    if (flowPredictions.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Previsão de Fluxo
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Previsões de próximos tópicos aparecerão aqui
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
                    Previsão de Fluxo
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <AnimatePresence mode="popLayout">
                    {flowPredictions.map((prediction, index) => (
                        <motion.div
                            key={prediction.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className="p-3 rounded-lg border border-border bg-card/50 text-xs space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Lightbulb className="h-4 w-4 text-yellow-400" />
                                        <Badge variant="outline" className="text-xs">
                                            {getTopicLabel(prediction.predictedTopic)}
                                        </Badge>
                                    </div>
                                    <Badge 
                                        variant="outline" 
                                        className={cn(
                                            "text-xs",
                                            prediction.confidence > 70 && "border-green-500/50 text-green-400",
                                            prediction.confidence > 50 && prediction.confidence <= 70 && "border-yellow-500/50 text-yellow-400",
                                            prediction.confidence <= 50 && "border-gray-500/50 text-gray-400"
                                        )}
                                    >
                                        {Math.round(prediction.confidence)}%
                                    </Badge>
                                </div>
                                
                                <p className="text-xs font-medium leading-relaxed">
                                    {prediction.reason}
                                </p>
                                
                                <div className="flex items-center gap-2 text-xs opacity-70">
                                    <Clock className="h-3 w-3" />
                                    <span>Estimado em {formatEstimatedTime(prediction.estimatedTime)}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

