import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { workspaceApi } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Copy, 
    CheckCircle2, 
    Calendar, 
    Clock, 
    Users, 
    ArrowLeft,
    Plus,
    ExternalLink,
    CheckCircle,
    Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { formatRelativeTime } from "@/utils/timeUtils";

interface Decision {
    id: string;
    text: string;
    decidedBy: string;
    timestamp: number;
    taskId?: string;
}

interface Action {
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'completed';
    dueDate?: string;
    owner?: string;
    taskId?: string;
}

export function SessionSummaryView() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { transcriptBlocks, participants, elapsedTime, liveSummary } = useMeetingStore();
    const [copied, setCopied] = useState(false);
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [actions, setActions] = useState<Action[]>([]);
    
    const [sessionData, setSessionData] = useState<any>(null);
    
    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId) return;
            try {
                const res = await workspaceApi.get(`/sessions/${sessionId}`);
                setSessionData({
                    id: res.data.id,
                    type: res.data.type || 'Regular Meeting',
                    date: res.data.started_at || res.data.created_at,
                    duration: elapsedTime,
                    participants: participants.map(p => p.name || p.speakerId || 'Unknown')
                });
            } catch (error) {
                console.error("Failed to load session data:", error);
            }
        };
        loadSessionData();
    }, [sessionId]);
    
    if (!sessionData) {
        return <div>Loading session data...</div>;
    }
    
    // Generate summary from transcript
    useEffect(() => {
        if (transcriptBlocks.length === 0) return;
        
        // Extract decisions
        const decisionKeywords = ['decisão', 'decidir', 'decidimos', 'vamos', 'decision', 'decide', 'decided', 'agreed'];
        const extractedDecisions: Decision[] = [];
        
        transcriptBlocks.forEach(block => {
            const text = block.text.toLowerCase();
            if (decisionKeywords.some(kw => text.includes(kw)) && !text.includes('?')) {
                extractedDecisions.push({
                    id: `decision-${block.id}`,
                    text: block.text,
                    decidedBy: block.speaker,
                    timestamp: block.timestamp
                });
            }
        });
        
        setDecisions(extractedDecisions.slice(0, 10));
        
        // Extract actions from detectedActions
        const extractedActions: Action[] = useMeetingStore.getState().detectedActions.map(action => ({
            id: action.id,
            text: action.text,
            status: action.confirmed ? 'in_progress' : 'pending',
            owner: participants.find(p => p.speakerId === action.id)?.name,
            taskId: action.taskId
        }));
        
        setActions(extractedActions);
    }, [transcriptBlocks, participants]);
    
    // Generate short summary (3-5 sentences)
    const shortSummary = liveSummary 
        ? `${liveSummary.keyPoints.slice(0, 3).join(' ')} ${liveSummary.decisions.length > 0 ? `Decisões importantes foram tomadas.` : ''} ${liveSummary.actionItems.length > 0 ? `Foram identificadas ${liveSummary.actionItems.length} ações.` : ''}`
        : transcriptBlocks.length > 0
        ? `Reunião realizada com ${participants.length} participantes. ${transcriptBlocks.length} blocos de transcrição foram gerados. ${decisions.length > 0 ? `${decisions.length} decisões foram tomadas.` : ''} ${actions.length > 0 ? `${actions.length} ações foram identificadas.` : ''}`
        : 'Resumo da reunião será gerado aqui.';
    
    // Generate detailed summary sections
    const detailedSummary = {
        context: `Reunião do tipo ${sessionData.type} realizada em ${new Date(sessionData.date).toLocaleDateString('pt-PT')}. Participaram ${sessionData.participants.length} pessoas: ${sessionData.participants.join(', ')}.`,
        discussion: transcriptBlocks.length > 0 
            ? `Durante a reunião, foram discutidos vários tópicos. A transcrição contém ${transcriptBlocks.length} blocos de conversa, cobrindo diferentes aspectos do projeto.`
            : 'Discussão detalhada será disponibilizada aqui.',
        decisions: decisions.length > 0
            ? `Foram tomadas ${decisions.length} decisões importantes durante a reunião.`
            : 'Nenhuma decisão explícita foi registrada.',
        risks: useMeetingStore.getState().risks.length > 0
            ? `${useMeetingStore.getState().risks.length} riscos foram identificados durante a reunião.`
            : 'Nenhum risco foi explicitamente mencionado.'
    };
    
    const handleCopySummary = () => {
        navigator.clipboard.writeText(shortSummary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleCreateTask = (decisionId: string) => {
        const decision = decisions.find(d => d.id === decisionId);
        if (decision) {
            // TODO: Navigate to task creation with pre-filled data
            navigate(`/tasks?create=true&title=${encodeURIComponent(decision.text)}`);
        }
    };
    
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'in_progress':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        }
    };
    
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4" />;
            case 'in_progress':
                return <Circle className="h-4 w-4" />;
            default:
                return <Circle className="h-4 w-4" />;
        }
    };
    
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Resumo da Sessão</h1>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(sessionData.date).toLocaleDateString('pt-PT', { 
                                        day: 'numeric', 
                                        month: 'long', 
                                        year: 'numeric' 
                                    })}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatDuration(sessionData.duration)}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    {sessionData.participants.length} participantes
                                </div>
                            </div>
                        </div>
                    </div>
                    <Badge variant="outline">{sessionData.type}</Badge>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto min-h-0">
                {/* Left Column: Summaries */}
                <div className="col-span-1 lg:col-span-7 space-y-4">
                    {/* Short Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="p-4 border-b border-border">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-semibold">Resumo Curto</CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopySummary}
                                        className="gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-4 w-4" />
                                                Copiar
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <p className="text-sm leading-relaxed text-foreground/90">
                                    {shortSummary}
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                    
                    {/* Detailed Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="p-4 border-b border-border">
                                <CardTitle className="text-lg font-semibold">Resumo Detalhado</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Contexto</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {detailedSummary.context}
                                    </p>
                                </div>
                                
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Discussão</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {detailedSummary.discussion}
                                    </p>
                                </div>
                                
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Decisões</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {detailedSummary.decisions}
                                    </p>
                                </div>
                                
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Riscos</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {detailedSummary.risks}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
                
                {/* Right Column: Decisions & Actions */}
                <div className="col-span-1 lg:col-span-5 space-y-4">
                    {/* Decisions */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="p-4 border-b border-border">
                                <CardTitle className="text-lg font-semibold">Decisões</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {decisions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Nenhuma decisão registrada
                                    </p>
                                ) : (
                                    decisions.map((decision, index) => (
                                        <motion.div
                                            key={decision.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.3 + index * 0.05 }}
                                            className="p-3 rounded-lg border border-border bg-card/30 space-y-2"
                                        >
                                            <p className="text-sm font-medium leading-relaxed">
                                                {decision.text}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3 w-3" />
                                                    <span>{decision.decidedBy}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{formatRelativeTime(new Date(decision.timestamp * 1000))}</span>
                                                </div>
                                            </div>
                                            {!decision.taskId && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full text-xs h-7"
                                                    onClick={() => handleCreateTask(decision.id)}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Criar Task
                                                </Button>
                                            )}
                                        </motion.div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                    
                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="p-4 border-b border-border">
                                <CardTitle className="text-lg font-semibold">Ações</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {actions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Nenhuma ação registrada
                                    </p>
                                ) : (
                                    actions.map((action, index) => (
                                        <motion.div
                                            key={action.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.4 + index * 0.05 }}
                                            className={cn(
                                                "p-3 rounded-lg border space-y-2",
                                                getStatusColor(action.status)
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-1">
                                                    {getStatusIcon(action.status)}
                                                    <p className="text-sm font-medium leading-relaxed flex-1">
                                                        {action.text}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs opacity-80">
                                                {action.owner && (
                                                    <div className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" />
                                                        <span>{action.owner}</span>
                                                    </div>
                                                )}
                                                {action.dueDate && (
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>{new Date(action.dueDate).toLocaleDateString('pt-PT')}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {action.taskId && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full text-xs h-7"
                                                    onClick={() => navigate(`/tasks?task=${action.taskId}`)}
                                                >
                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                    Ver em Tasks
                                                </Button>
                                            )}
                                        </motion.div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

