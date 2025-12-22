import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertCircle, Lightbulb, CheckCircle2, AlertTriangle, Brain, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { motion, AnimatePresence } from "framer-motion";

export interface GuidanceInsight {
    id: string;
    type: 'question' | 'warning' | 'suggestion' | 'response' | 'clarification' | 'behavior';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    context?: string;
    timestamp: number;
}

function GuidanceCard({ insight, index, onDismiss }: { insight: GuidanceInsight; index: number; onDismiss: (id: string) => void }) {
    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'question':
                return {
                    icon: MessageSquare,
                    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                    iconColor: "text-blue-500"
                };
            case 'warning':
                return {
                    icon: AlertTriangle,
                    color: "bg-red-500/10 text-red-500 border-red-500/20",
                    iconColor: "text-red-500"
                };
            case 'suggestion':
                return {
                    icon: Lightbulb,
                    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                    iconColor: "text-yellow-500"
                };
            case 'response':
                return {
                    icon: CheckCircle2,
                    color: "bg-green-500/10 text-green-500 border-green-500/20",
                    iconColor: "text-green-500"
                };
            case 'clarification':
                return {
                    icon: AlertCircle,
                    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
                    iconColor: "text-orange-500"
                };
            case 'behavior':
                return {
                    icon: Brain,
                    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
                    iconColor: "text-purple-500"
                };
            default:
                return {
                    icon: Sparkles,
                    color: "bg-muted text-muted-foreground border-border",
                    iconColor: "text-muted-foreground"
                };
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high':
                return "bg-red-500/20 text-red-500 border-red-500/40";
            case 'medium':
                return "bg-orange-500/20 text-orange-500 border-orange-500/40";
            case 'low':
                return "bg-blue-500/20 text-blue-500 border-blue-500/40";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    };

    const config = getTypeConfig(insight.type);
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
        >
            <Card className={cn(
                "border-l-4 transition-all",
                config.color,
                insight.priority === 'high' && "shadow-lg border-l-4 border-l-red-500"
            )}>
                <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                        <div className={cn("p-1.5 rounded-lg bg-background/50 shrink-0", config.iconColor)}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <h4 className="font-bold text-sm">{insight.title}</h4>
                                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getPriorityBadge(insight.priority))}>
                                            {insight.priority}
                                        </Badge>
                                    </div>
                                    <div className="bg-primary/10 border border-primary/20 rounded-md p-2.5 mb-1.5">
                                        <p className="text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                                            {insight.message}
                                        </p>
                                    </div>
                                    {insight.context && (
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            <span className="font-semibold">Porquê:</span> {insight.context}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 opacity-70 hover:opacity-100"
                                    onClick={() => onDismiss(insight.id)}
                                    aria-label={`Marcar "${insight.title}" como feito`}
                                    title="Marcar como feito"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

export function MeetingGuidancePane() {
    const { transcriptBlocks, detectedActions, risks, clarifications, participants } = useMeetingStore();
    const { selectedThreadId, messages } = useWorkspaceStore();
    const [guidanceInsights, setGuidanceInsights] = useState<GuidanceInsight[]>([]);
    const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

    const handleDismiss = (id: string) => {
        setDismissedInsights(prev => new Set([...prev, id]));
    };

    // Analyze context and generate guidance
    useEffect(() => {
        const generateGuidance = () => {
            const insights: GuidanceInsight[] = [];
            const now = Date.now();

            // Get thread context from preparation messages
            const threadContext = selectedThreadId
                ? messages
                    // @ts-ignore - thread_id missing in Message type definition but present in API response
                    .filter(m => m.thread_id === selectedThreadId)
                    .map(m => m.content)
                    .join(' ')
                : '';

            // Get recent transcript (last 10 blocks)
            const recentTranscript = transcriptBlocks.slice(-10);
            const recentText = recentTranscript.map(b => b.text).join(' ');

            // Analyze what's being discussed
            const recentSentiment = recentTranscript.map(b => b.sentiment || 'neutral');
            const negativeCount = recentSentiment.filter(s => s === 'negative').length;
            const positiveCount = recentSentiment.filter(s => s === 'positive').length;

            // 1. Questions to ask based on thread context - EXPLICIT SCRIPTS WITH DETAILED CONTEXT
            if (threadContext) {
                // Extract specific mentions from context
                const contextLines = threadContext.split('\n').filter(l => l.trim().length > 0);
                const budgetMentions = contextLines.filter(l => l.toLowerCase().includes('budget') || l.toLowerCase().includes('orçamento'));
                const timelineMentions = contextLines.filter(l => l.toLowerCase().includes('timeline') || l.toLowerCase().includes('prazo') || l.toLowerCase().includes('deadline'));

                // Check if budget was mentioned in context but not in meeting
                if (budgetMentions.length > 0 && !recentText.toLowerCase().includes('budget') && !recentText.toLowerCase().includes('orçamento')) {
                    const mention = budgetMentions[0].substring(0, 100);
                    insights.push({
                        id: `q-${now}-1`,
                        type: 'question',
                        priority: 'high',
                        title: 'PERGUNTE SOBRE O ORÇAMENTO',
                        message: 'PERGUNTE: "Podemos confirmar o status do orçamento? Qual é a situação atual e há alguma preocupação que precisamos abordar?"',
                        context: `Na preparação foi mencionado: "${mention}..." mas ainda não foi discutido na reunião`,
                        timestamp: now
                    });
                }

                // Check if timeline was mentioned in context but not in meeting
                if (timelineMentions.length > 0
                    && !recentText.toLowerCase().includes('timeline')
                    && !recentText.toLowerCase().includes('prazo')
                    && !recentText.toLowerCase().includes('deadline')
                    && !recentText.toLowerCase().includes('cronograma')) {
                    const mention = timelineMentions[0].substring(0, 100);
                    insights.push({
                        id: `q-${now}-2`,
                        type: 'question',
                        priority: 'high',
                        title: 'PERGUNTE SOBRE O PRAZO',
                        message: 'PERGUNTE: "Podemos revisar o cronograma? O prazo ainda está viável ou precisamos ajustar alguma coisa?"',
                        context: `Na preparação foi mencionado: "${mention}..." mas ainda não foi discutido na reunião`,
                        timestamp: now
                    });
                }
            }

            // 2. Warnings about negative sentiment - EXPLICIT SCRIPT WITH CONTEXT
            if (negativeCount > positiveCount && recentTranscript.length > 3) {
                const negativeBlocks = recentTranscript.filter(b => b.sentiment === 'negative');
                const negativeExamples = negativeBlocks.slice(-2).map(b =>
                    `${b.speaker}: "${b.text.substring(0, 60)}..."`
                ).join(' | ');

                insights.push({
                    id: `w-${now}-1`,
                    type: 'warning',
                    priority: 'high',
                    title: 'ABORDAR TOM NEGATIVO',
                    message: 'DIGA: "Vejo que há algumas preocupações. Podemos abordar estas questões diretamente? O que podemos fazer para resolver isso?"',
                    context: `${negativeCount} de ${recentTranscript.length} mensagens recentes com sentimento negativo. Exemplos: ${negativeExamples}`,
                    timestamp: now
                });
            }

            // 3. Suggestions based on detected actions - EXPLICIT SCRIPT
            if (detectedActions.length > 0 && detectedActions[detectedActions.length - 1].confirmed === false) {
                const lastAction = detectedActions[detectedActions.length - 1];
                insights.push({
                    id: `s-${now}-1`,
                    type: 'suggestion',
                    priority: 'medium',
                    title: 'CONFIRMAR AÇÃO DETECTADA',
                    message: `DIGA: "Entendi que precisamos ${lastAction.text.toLowerCase()}. Podemos confirmar quem será responsável e qual é o prazo?"`,
                    context: 'Ação detectada automaticamente',
                    timestamp: now
                });
            }

            // 4. Response suggestions based on questions asked - EXPLICIT SCRIPT WITH CONTEXT
            const questionKeywords = ['?', 'pergunta', 'question', 'como', 'quando', 'onde', 'quem', 'por que', 'why', 'how', 'when', 'where', 'who'];
            const hasQuestions = recentTranscript.some(b =>
                questionKeywords.some(keyword => b.text.toLowerCase().includes(keyword))
            );

            if (hasQuestions && recentTranscript.length > 0) {
                const lastBlock = recentTranscript[recentTranscript.length - 1];
                if (lastBlock.speaker !== 'You' && questionKeywords.some(k => lastBlock.text.includes(k))) {
                    const questionText = lastBlock.text.substring(0, 150);

                    // Check if there's relevant context in thread preparation
                    let contextInfo = `Pergunta feita por ${lastBlock.speaker}`;
                    if (threadContext) {
                        const questionLower = questionText.toLowerCase();
                        const relevantContext = threadContext.split('\n').find(line => {
                            const lineLower = line.toLowerCase();
                            return questionLower.split(' ').some(word =>
                                word.length > 4 && lineLower.includes(word)
                            );
                        });
                        if (relevantContext) {
                            contextInfo = `${lastBlock.speaker} perguntou sobre isso. Na preparação havia: "${relevantContext.substring(0, 80)}..."`;
                        }
                    }

                    insights.push({
                        id: `r-${now}-1`,
                        type: 'response',
                        priority: 'high',
                        title: 'RESPONDER À PERGUNTA',
                        message: `RESPONDA: "${questionText}" - Forneça uma resposta clara e completa. Se não souber, diga: "Vou verificar e retorno com uma resposta precisa."`,
                        context: contextInfo,
                        timestamp: now
                    });
                }
            }

            // 5. Clarifications needed - EXPLICIT SCRIPT
            if (clarifications.length > 0) {
                const lastClarification = clarifications[clarifications.length - 1];
                insights.push({
                    id: `c-${now}-1`,
                    type: 'clarification',
                    priority: 'medium',
                    title: 'CLARIFICAR PONTO IMPORTANTE',
                    message: `PERGUNTE: "${lastClarification.suggestion}" - Certifique-se de obter uma confirmação explícita.`,
                    context: lastClarification.context,
                    timestamp: now
                });
            }

            // 6. Behavioral guidance based on participation - EXPLICIT SCRIPT
            const uniqueSpeakers = new Set(recentTranscript.map(b => b.speaker)).size;
            if (uniqueSpeakers < 2 && recentTranscript.length > 5) {
                const otherParticipants = participants.filter(p => !recentTranscript.some(b => b.speaker === p.name || b.speaker === p.speakerId));
                const participantName = otherParticipants.length > 0 ? otherParticipants[0].name || otherParticipants[0].speakerId : 'outros participantes';
                insights.push({
                    id: `b-${now}-1`,
                    type: 'behavior',
                    priority: 'medium',
                    title: 'ENVOLVER OUTROS PARTICIPANTES',
                    message: `PERGUNTE: "${participantName}, qual é a sua opinião sobre isso?" ou "Alguém mais tem algo a adicionar?"`,
                    context: `${uniqueSpeakers} participante(s) ativo(s) nas últimas mensagens`,
                    timestamp: now
                });
            }

            // 7. Risks that need attention - EXPLICIT SCRIPT
            if (risks.length > 0) {
                const highRisks = risks.filter(r => r.severity === 'high');
                if (highRisks.length > 0) {
                    const riskSummary = highRisks[0].summary;
                    insights.push({
                        id: `w-${now}-2`,
                        type: 'warning',
                        priority: 'high',
                        title: 'ABORDAR RISCO URGENTE',
                        message: `DIGA: "Identifiquei uma preocupação: ${riskSummary}. Podemos discutir como vamos mitigar isso?"`,
                        context: `${highRisks.length} risco(s) de alta prioridade detectado(s)`,
                        timestamp: now
                    });
                }
            }

            // 8. Topics mentioned in context but not discussed - EXPLICIT SCRIPT
            if (threadContext && recentTranscript.length > 0) {
                const topicMap: Record<string, string> = {
                    'scope': 'escopo',
                    'escopo': 'escopo',
                    'requirement': 'requisitos',
                    'requisito': 'requisitos',
                    'deliverable': 'entregáveis',
                    'entregável': 'entregáveis',
                    'budget': 'orçamento',
                    'orçamento': 'orçamento',
                    'timeline': 'cronograma',
                    'prazo': 'cronograma',
                    'deadline': 'cronograma',
                    'risk': 'riscos',
                    'risco': 'riscos',
                    'stakeholder': 'stakeholders',
                    'stakeholders': 'stakeholders'
                };

                const contextLower = threadContext.toLowerCase();
                const recentTextLower = recentText.toLowerCase();

                const notDiscussedTopics: string[] = [];
                Object.keys(topicMap).forEach(key => {
                    if (contextLower.includes(key) && !recentTextLower.includes(key) && !recentTextLower.includes(topicMap[key])) {
                        notDiscussedTopics.push(topicMap[key]);
                    }
                });

                if (notDiscussedTopics.length > 0) {
                    const topicToAsk = notDiscussedTopics[0];
                    let questionScript = '';

                    if (topicToAsk === 'escopo') {
                        questionScript = 'PERGUNTE: "Podemos confirmar o escopo do projeto? Há algo que precisa ser esclarecido ou ajustado?"';
                    } else if (topicToAsk === 'requisitos') {
                        questionScript = 'PERGUNTE: "Os requisitos estão claros para todos? Há algum requisito que precisa ser revisado?"';
                    } else if (topicToAsk === 'entregáveis') {
                        questionScript = 'PERGUNTE: "Podemos revisar os entregáveis? Todos estão alinhados sobre o que será entregue?"';
                    } else if (topicToAsk === 'orçamento') {
                        questionScript = 'PERGUNTE: "Podemos confirmar o status do orçamento? Há alguma preocupação que precisamos abordar?"';
                    } else if (topicToAsk === 'cronograma') {
                        questionScript = 'PERGUNTE: "O cronograma ainda está viável? Precisamos ajustar algum prazo?"';
                    } else if (topicToAsk === 'riscos') {
                        questionScript = 'PERGUNTE: "Quais são os principais riscos que precisamos considerar? Como vamos mitigá-los?"';
                    } else {
                        questionScript = `PERGUNTE: "Podemos abordar o tópico de ${topicToAsk}? Há algo importante que precisamos discutir?"`;
                    }

                    insights.push({
                        id: `q-${now}-3`,
                        type: 'question',
                        priority: 'medium',
                        title: `ABORDAR: ${topicToAsk.toUpperCase()}`,
                        message: questionScript,
                        context: 'Mencionado na preparação do thread mas ainda não discutido',
                        timestamp: now
                    });
                }
            }

            // Sort by priority and timestamp (most recent first)
            insights.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                return b.timestamp - a.timestamp;
            });

            // Filter out dismissed insights and keep top 8
            const activeInsights = insights.filter(i => !dismissedInsights.has(i.id)).slice(0, 8);
            setGuidanceInsights(activeInsights);
        };

        // Generate guidance every 20 seconds (reduced from 5s for performance)
        generateGuidance();
        const interval = setInterval(generateGuidance, 20000);

        return () => clearInterval(interval);
    }, [transcriptBlocks, detectedActions, risks, clarifications, participants, selectedThreadId, messages, dismissedInsights]);

    return (
        <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-2 border-primary/20 shadow-xl overflow-hidden">
            <CardHeader className="p-3 border-b border-primary/20 bg-primary/5 shrink-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
                    Orientação em Tempo Real
                    {guidanceInsights.length > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs" aria-label={`${guidanceInsights.length} insights ativos`}>
                            {guidanceInsights.length}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent
                className="p-3 overflow-y-auto"
                style={{
                    maxHeight: '320px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--muted) var(--background)'
                }}
                aria-label="Orientação em tempo real - insights e scripts"
            >
                <AnimatePresence mode="popLayout">
                    {guidanceInsights.length === 0 ? (
                        <div className="text-center py-8" role="status" aria-live="polite">
                            <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                            <p className="text-sm text-muted-foreground">
                                Analisando o contexto da reunião...
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Os insights aparecerão aqui em tempo real
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2" role="list" aria-label="Lista de orientações">
                            {guidanceInsights.map((insight, index) => (
                                <GuidanceCard
                                    key={insight.id}
                                    insight={insight}
                                    index={index}
                                    onDismiss={handleDismiss}
                                />
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

