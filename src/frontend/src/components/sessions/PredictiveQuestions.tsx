import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Copy, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function PredictiveQuestions() {
    const { 
        predictiveQuestions, 
        isRecording, 
        generatePredictiveQuestions 
    } = useMeetingStore();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    // Generate questions periodically
    useEffect(() => {
        if (!isRecording) return;
        
        const interval = setInterval(() => {
            generatePredictiveQuestions();
        }, 30000); // Generate every 30 seconds (optimized for performance)
        
        return () => clearInterval(interval);
    }, [isRecording, generatePredictiveQuestions]);
    
    const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
        switch (priority) {
            case 'high':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'medium':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'low':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        }
    };
    
    const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
            risk: 'Risco',
            clarification: 'Esclarecimento',
            'follow-up': 'Seguimento',
            strategic: 'Estratégico'
        };
        return labels[category] || category;
    };
    
    const handleCopy = (question: string, id: string) => {
        navigator.clipboard.writeText(question);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    
    if (predictiveQuestions.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        Perguntas Sugeridas
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Perguntas contextuais serão sugeridas aqui
                    </p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Perguntas Sugeridas
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <AnimatePresence mode="popLayout">
                    {predictiveQuestions.map((question, index) => (
                        <motion.div
                            key={question.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                getPriorityColor(question.priority)
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                            {getCategoryLabel(question.category)}
                                        </Badge>
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "text-xs",
                                                question.priority === 'high' && "border-red-500/50 text-red-400",
                                                question.priority === 'medium' && "border-yellow-500/50 text-yellow-400",
                                                question.priority === 'low' && "border-blue-500/50 text-blue-400"
                                            )}
                                        >
                                            {question.priority === 'high' ? 'Alta' : question.priority === 'medium' ? 'Média' : 'Baixa'}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => handleCopy(question.question, question.id)}
                                    >
                                        {copiedId === question.id ? (
                                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                                        ) : (
                                            <Copy className="h-3 w-3" />
                                        )}
                                    </Button>
                                </div>
                                
                                <p className="text-xs font-medium leading-relaxed">
                                    {question.question}
                                </p>
                                
                                {question.context && (
                                    <div className="pt-1 border-t border-current/20">
                                        <p className="text-xs opacity-70 italic">
                                            📌 {question.context}
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

