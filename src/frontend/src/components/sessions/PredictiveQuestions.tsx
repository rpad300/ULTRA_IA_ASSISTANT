import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Copy, Zap, Pin, MessageSquarePlus, Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePredictiveQuestionEngine } from "@/hooks/usePredictiveQuestionEngine";
import { useEffect } from "react";

export function PredictiveQuestions() {
    // "Intelligence Hook" - Logic Decoupling
    const {
        predictiveQuestions,
        prepareResponse,
        togglePin,
        isRecording
    } = usePredictiveQuestionEngine();

    // A11y: Keyboard Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'q') {
                const firstCard = document.querySelector('[data-question-card="0"]') as HTMLElement;
                firstCard?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleCopy = (question: string) => {
        navigator.clipboard.writeText(question);
        toast.success("Pergunta copiada para a área de transferência", {
            description: "Pronta para colar no chat da reunião."
        });
    };

    const handleCoPilotInject = (question: any) => {
        prepareResponse(question);
        toast.info("Envelhecendo no Co-Pilot...", {
            description: "A IA está a rascunhar uma resposta estratégica."
        });
    };

    const handleContextClick = (context: string) => {
        // "Smart Relevance" - Context Lineage
        // Ideally this would dispatch a scroll event to TranscriptPane
        toast.info("Contexto localizado", {
            description: `Saltando para o momento: "${context}"` // Simulated for now
        });
    };

    if (!isRecording && predictiveQuestions.length === 0) {
        return (
            <Card className="h-full border-dashed border-border/50 bg-card/30 flex items-center justify-center p-6">
                <div className="text-center space-y-2 opacity-50">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">A aguardar início da sessão...</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full border-border/40 bg-card/30 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="p-3 border-b border-white/5 dark:border-white/5 shrink-0 bg-white/5 dark:bg-black/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        <Zap className="h-4 w-4 text-primary" />
                        Scripting Engine
                    </CardTitle>
                    {isRecording && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-500 border-green-500/20 animate-pulse">
                            LIVE
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-3 overflow-y-auto space-y-3 flex-1 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20" role="live" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                    {predictiveQuestions.map((q, index) => (
                        <motion.div
                            key={q.id}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -20, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="relative group"
                        >
                            <div
                                tabIndex={0}
                                data-question-card={index}
                                className={cn(
                                    "p-3 rounded-xl border transition-all duration-300 relative overflow-hidden",
                                    // "Neural Glass" Styling with OKLCH Priority Gradients
                                    q.priority === 'high'
                                        ? "bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.15)] dark:shadow-[0_0_20px_-5px_rgba(239,68,68,0.2)]"
                                        : q.priority === 'medium'
                                            ? "bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20"
                                            : "bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20"
                                )}
                            >
                                {/* High Priority Pulsing Glow */}
                                {q.priority === 'high' && (
                                    <div className="absolute inset-0 bg-red-500/5 animate-pulse rounded-xl pointer-events-none" />
                                )}

                                <div className="relative z-10 space-y-2">
                                    {/* Header: Badges & Actions */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-background/50 backdrop-blur-md border-white/10">
                                                {q.category.toUpperCase()}
                                            </Badge>

                                            {/* Confidence Indicator */}
                                            {q.confidence && (
                                                <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-background/30 px-1.5 py-0.5 rounded-full border border-white/5">
                                                    <Activity className="h-3 w-3 text-primary/70" />
                                                    <span>{q.confidence}%</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-6 w-6 hover:bg-background/40",
                                                    q.isPinned && "text-primary"
                                                )}
                                                onClick={() => togglePin(q.id)}
                                                title={q.isPinned ? "Desafixar" : "Fixar no Topo"}
                                            >
                                                <Pin className={cn("h-3.5 w-3.5", q.isPinned ? "fill-current" : "text-muted-foreground")} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 hover:bg-background/40"
                                                onClick={() => handleCopy(q.question)}
                                                title="Copiar Pergunta"
                                            >
                                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Question Text */}
                                    <p className={cn(
                                        "text-sm font-semibold leading-snug tracking-tight",
                                        q.priority === 'high' ? "text-red-950 dark:text-red-50" : "text-foreground/90"
                                    )}>
                                        {q.question}
                                    </p>

                                    {/* Footer: Context & Co-Pilot Bridge */}
                                    <div className="flex items-end justify-between gap-2 pt-1">
                                        <button
                                            onClick={() => handleContextClick(q.context)}
                                            className="text-xs text-muted-foreground/80 hover:text-primary transition-colors text-left flex items-start gap-1 max-w-[70%]"
                                        >
                                            <span className="shrink-0 mt-0.5">↳</span>
                                            <span className="italic truncate hover:whitespace-normal line-clamp-1 hover:line-clamp-none">
                                                {q.context}
                                            </span>
                                        </button>

                                        <Button
                                            size="sm"
                                            variant={q.priority === 'high' ? "default" : "secondary"}
                                            className={cn(
                                                "h-7 text-[10px] px-2 shadow-sm",
                                                q.priority === 'high' ? "bg-red-600 hover:bg-red-700 text-white border-none" : "bg-background/50 hover:bg-background/80"
                                            )}
                                            onClick={() => handleCoPilotInject(q)}
                                        >
                                            <MessageSquarePlus className="h-3 w-3 mr-1.5" />
                                            Preparar
                                            <ArrowRight className="h-3 w-3 ml-1 opacity-50" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {predictiveQuestions.length === 0 && isRecording && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center p-8 text-muted-foreground/50 space-y-2"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <Activity className="h-8 w-8 relative z-10" />
                        </div>
                        <p className="text-xs font-medium">Analisando contexto...</p>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}

// Default export for lazy loading if needed, though named export is preferred in this codebase
export default PredictiveQuestions;

