import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ListTodo, Mail, ExternalLink, Calendar, MessageSquarePlus, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useContextData } from "@/hooks/useContextData";
import { useMeetingStore } from "@/store/meetingStore";
import { toast } from "sonner";

// --- Components ---

// 1. Decision Card with Lineage
const DecisionCard = memo(({ decision, index }: { decision: import('@/hooks/useContextData').EnrichedDecision; index: number }) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="group"
    >
        <Card className={cn(
            "border-border/50 bg-card/40 hover:bg-card/60 transition-all",
            decision.isRelevant && "ring-1 ring-[oklch(0.7_0.15_140)] border-[oklch(0.8_0.1_140)] bg-[oklch(0.96_0.03_140)]/30"
        )}>
            <CardContent className="p-2.5">
                <div className="flex items-start gap-2.5">
                    <div className={cn(
                        "mt-0.5 p-1 rounded-full shrink-0",
                        decision.isRelevant ? "bg-[oklch(0.7_0.15_140)]/20 text-[oklch(0.6_0.15_140)]" : "bg-green-500/10 text-green-500"
                    )}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-medium leading-tight", decision.isRelevant && "text-foreground")}>
                            {decision.text}
                        </p>
                        <button className="flex items-center gap-1.5 mt-1.5 group/link text-[10px] text-muted-foreground hover:text-primary transition-colors text-left">
                            <ArrowUpRight className="h-3 w-3 opacity-50 group-hover/link:opacity-100" />
                            <span className="truncate max-w-[150px]">{decision.meetingTitle}</span>
                            <span className="opacity-50">• {decision.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </motion.div>
));
DecisionCard.displayName = "DecisionCard";

// 2. Task Card with "Mention in Meeting"
const TaskCard = memo(({ task, index, onMention }: { task: import('@/hooks/useContextData').EnrichedTask; index: number; onMention: (task: import('@/hooks/useContextData').EnrichedTask) => void }) => {
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return "bg-[oklch(0.95_0.05_30)] text-[oklch(0.6_0.2_30)] border-[oklch(0.9_0.05_30)]";
            case 'medium': return "bg-[oklch(0.96_0.04_50)] text-[oklch(0.6_0.15_50)] border-[oklch(0.9_0.05_50)]";
            case 'low': return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            default: return "bg-muted text-muted-foreground border-border";
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative"
        >
            {task.isRelevant && (
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[oklch(0.7_0.15_240)]/30 to-purple-500/30 rounded-lg blur-sm opacity-50 animate-pulse pointer-events-none" />
            )}
            <Card className={cn(
                "relative border-border/50 transition-all bg-card/40 hover:bg-card/80",
                task.isRelevant && "border-[oklch(0.7_0.15_240)]/40 bg-[oklch(0.96_0.03_240)]/20 shadow-sm"
            )}>
                <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-xs font-medium leading-snug flex-1">{task.title}</p>
                        {task.isRelevant && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary/20 text-primary bg-primary/5">
                                Relevant
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-normal border-0", getPriorityColor(task.priority))}>
                                {task.priority}
                            </Badge>
                            {task.dueDate && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Calendar className="h-3 w-3 opacity-70" />
                                    <span>{task.dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                </div>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                            onClick={() => onMention(task)}
                            title="Mencionar na reunião"
                        >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});
TaskCard.displayName = "TaskCard";

// 3. Email Card with AI Summary
const EmailCard = memo(({ email, index }: { email: import('@/hooks/useContextData').EnrichedEmail; index: number }) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
    >
        <Card className={cn(
            "border-border/50 bg-card/40 hover:bg-card/60 transition-all group",
            email.isRelevant && "ring-1 ring-purple-500/30 border-purple-500/30 bg-purple-500/5"
        )}>
            <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-full bg-purple-500/10 text-purple-500 shrink-0">
                            <Mail className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{email.subject}</p>
                            <p className="text-[10px] text-muted-foreground truncate opacity-80">{email.from} • {email.date.toLocaleDateString()}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
                        <ExternalLink className="h-3 w-3" />
                    </Button>
                </div>

                {/* AI TL;DR */}
                <div className="relative pl-2.5 ml-2 border-l-2 border-primary/20">
                    <p className="text-[10px] italic text-muted-foreground leading-relaxed font-serif">
                        "{email.aiSummary}"
                    </p>
                    <div className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-primary/40" />
                </div>
            </CardContent>
        </Card>
    </motion.div>
));
EmailCard.displayName = "EmailCard";

// --- Main Layout ---

interface ContextPaneProps {
    threadId?: string;
    companyId?: string;
    projectId?: string;
}

export function ContextPane({ threadId, companyId, projectId }: ContextPaneProps) {
    const { tasks, emails, decisions, isLoading } = useContextData({ threadId, companyId, projectId });
    const { addManualGuidance } = useMeetingStore();

    const handleMentionTask = (task: import('@/hooks/useContextData').EnrichedTask) => {
        // Inject guidance into the engine
        addManualGuidance({
            id: `manual-${Date.now()}` as import("@/types/guidance").GuidanceId,
            type: 'suggestion',
            priority: 'high',
            title: `Contexto: ${task.title}`,
            message: `Sugestão: Pergunte "Como está o progresso da tarefa '${task.title}'? Precisa de desbloqueio?"`,
            timestamp: Date.now(),
            confidence: 100,
            impact: 'medium',
            context: "Cross-Pane Action"
        });

        toast.success("Sugestão adicionada ao AI Co-Pilot");
    };

    return (
        <div className="h-full flex flex-col space-y-6 overflow-hidden">
            {/* Last Decisions */}
            <div className="space-y-3 shrink-0">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1 rounded-md bg-green-500/10 text-green-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Decisões Recentes</h3>
                </div>

                <div className="space-y-2">
                    {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-16 w-full rounded-xl bg-muted/40 animate-pulse" />
                        ))
                    ) : decisions.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2 italic opacity-60">Nenhuma decisão recente encontrada.</p>
                    ) : (
                        decisions.slice(0, 3).map((decision, i) => (
                            <DecisionCard key={decision.id} decision={decision} index={i} />
                        ))
                    )}
                </div>
            </div>

            {/* Open Tasks */}
            <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between px-1 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-blue-500/10 text-blue-500">
                            <ListTodo className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tarefas Abertas</h3>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{tasks.length}</Badge>
                </div>

                <div className="space-y-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-24 w-full rounded-xl bg-muted/40 animate-pulse" />
                        ))
                    ) : tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4 border border-dashed rounded-xl border-border/50">
                            <CheckCircle2 className="h-8 w-8 text-muted-foreground/20 mb-2" />
                            <p className="text-xs font-medium text-foreground/70">O horizonte está limpo</p>
                            <p className="text-[10px] text-muted-foreground max-w-[150px]">
                                Todas as tarefas críticas estão sob controlo para este projeto.
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {tasks.map((task, i) => (
                                <TaskCard key={task.id} task={task} index={i} onMention={handleMentionTask} />
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Recent Emails */}
            <div className="space-y-3 shrink-0">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1 rounded-md bg-purple-500/10 text-purple-500">
                        <Mail className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Emails Recentes</h3>
                </div>

                <div className="space-y-2">
                    {isLoading ? (
                        <div className="h-20 w-full rounded-xl bg-muted/40 animate-pulse" />
                    ) : emails.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2 italic opacity-60">Caixa de entrada limpa.</p>
                    ) : (
                        emails.slice(0, 2).map((email, i) => (
                            <EmailCard key={email.id} email={email} index={i} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

