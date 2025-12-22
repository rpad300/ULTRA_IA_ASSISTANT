import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
    Users,
    MessageSquare,
    AlertCircle,
    FileText,
    Download
} from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";

export function PredictivePreparation() {
    const {
        prepDocuments,
        sessionId,
        generatePrepDocument
    } = useMeetingStore();
    const [isGenerating, setIsGenerating] = useState(false);

    const currentPrep = prepDocuments[prepDocuments.length - 1];

    const handleGenerate = async () => {
        if (!sessionId) return;
        setIsGenerating(true);
        generatePrepDocument(sessionId);
        setTimeout(() => setIsGenerating(false), 2000);
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Preparação Preditiva
                    </CardTitle>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs h-7"
                    >
                        {isGenerating ? 'Gerando...' : 'Gerar Preparação'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {!currentPrep ? (
                    <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground mb-2">
                            Gere um documento de preparação para esta reunião
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="text-xs"
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Gerar Preparação
                        </Button>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        {/* Participant Insights */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                                <Users className="h-3 w-3" />
                                Insights dos Participantes
                            </div>
                            <div className="space-y-2 pl-5">
                                {currentPrep.participantInsights.map((participant, idx) => (
                                    <div key={idx} className="p-2 rounded bg-muted/50 text-xs">
                                        <p className="font-medium mb-1">{participant.name}</p>
                                        <ul className="space-y-1 text-muted-foreground">
                                            {participant.insights.map((insight, i) => (
                                                <li key={i} className="flex items-start gap-1">
                                                    <span className="text-primary">•</span>
                                                    <span>{insight}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {participant.likelyQuestions.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-border">
                                                <p className="text-xs font-medium mb-1">Perguntas Prováveis:</p>
                                                <ul className="space-y-1 text-muted-foreground">
                                                    {participant.likelyQuestions.map((q, i) => (
                                                        <li key={i} className="flex items-start gap-1">
                                                            <MessageSquare className="h-3 w-3 mt-0.5 text-primary" />
                                                            <span>{q}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Likely Topics */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                                <FileText className="h-3 w-3" />
                                Tópicos Prováveis
                            </div>
                            <div className="flex flex-wrap gap-2 pl-5">
                                {currentPrep.likelyTopics.map((topic, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                        {topic}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Suggested Questions */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                                <MessageSquare className="h-3 w-3" />
                                Perguntas Sugeridas
                            </div>
                            <div className="space-y-1 pl-5">
                                {currentPrep.suggestedQuestions.map((question, idx) => (
                                    <div key={idx} className="p-2 rounded bg-primary/5 text-xs border border-primary/10">
                                        {question}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Risks */}
                        {currentPrep.risks.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold">
                                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                                    Riscos Identificados
                                </div>
                                <div className="space-y-1 pl-5">
                                    {currentPrep.risks.map((risk, idx) => (
                                        <div key={idx} className="p-2 rounded bg-yellow-500/10 text-xs border border-yellow-500/20 text-yellow-400">
                                            {risk}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Download Button */}
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs"
                            onClick={() => {
                                // TODO: Implement download
                                console.log('Download prep document');
                            }}
                        >
                            <Download className="h-3 w-3 mr-1" />
                            Baixar Documento de Preparação
                        </Button>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}

