import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, X, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";

export function RealTimeCoaching() {
    const { 
        coachingInsights, 
        isRecording, 
        analyzeUserSpeaking,
        dismissCoachingInsight 
    } = useMeetingStore();
    
    // Analyze user speaking periodically
    useEffect(() => {
        if (!isRecording) return;
        
        const interval = setInterval(() => {
            analyzeUserSpeaking();
        }, 20000); // Analyze every 20 seconds (optimized for performance)
        
        return () => clearInterval(interval);
    }, [isRecording, analyzeUserSpeaking]);
    
    const getSeverityColor = (severity: 'good' | 'warning' | 'critical') => {
        switch (severity) {
            case 'good':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'warning':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'critical':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
    };
    
    const getSeverityIcon = (severity: 'good' | 'warning' | 'critical') => {
        switch (severity) {
            case 'good':
                return <CheckCircle2 className="h-4 w-4" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4" />;
            case 'critical':
                return <AlertCircle className="h-4 w-4" />;
        }
    };
    
    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            tone: 'Tom',
            pace: 'Ritmo',
            question: 'Pergunta',
            interruption: 'Interrupção',
            silence: 'Silêncio',
            assertiveness: 'Assertividade'
        };
        return labels[type] || type;
    };
    
    const recentInsights = coachingInsights.slice(-3); // Show last 3
    
    if (recentInsights.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        Real-Time Coaching
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Coaching insights aparecerão aqui enquanto você fala
                    </p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    Real-Time Coaching
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <AnimatePresence mode="popLayout">
                    {recentInsights.map((insight, index) => (
                        <motion.div
                            key={insight.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                getSeverityColor(insight.severity)
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        {getSeverityIcon(insight.severity)}
                                        <Badge variant="outline" className="text-xs">
                                            {getTypeLabel(insight.type)}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => dismissCoachingInsight(insight.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                                
                                <p className="text-xs font-medium leading-relaxed">
                                    {insight.message}
                                </p>
                                
                                {insight.suggestion && (
                                    <div className="pt-1 border-t border-current/20">
                                        <p className="text-xs opacity-90 italic">
                                            💡 {insight.suggestion}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

