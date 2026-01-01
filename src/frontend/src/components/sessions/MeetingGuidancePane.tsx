
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare, AlertCircle, Lightbulb, CheckCircle2,
    AlertTriangle, Brain, Sparkles, Copy, Check, History as HistoryIcon,
    ArrowRight, Activity, Zap
} from "lucide-react";
import * as Icons from "lucide-react"; // For dynamic action icons
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useGuidanceEngine } from "@/hooks/useGuidanceEngine";
import { useGuidanceActions } from "@/hooks/useGuidanceActions";
import type { GuidanceInsight } from "@/types/guidance";
import type { ActionConfig } from "@/types/slices/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

function GuidanceCard({
    insight,
    onDismiss,
    showDismiss = true
}: {
    insight: GuidanceInsight;
    index: number;
    onDismiss?: (id: string) => void;
    showDismiss?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const [showReasoning, setShowReasoning] = useState(false);
    const { executeAction } = useGuidanceActions(); // SOTA Action Handler

    const handleCopy = async () => {
        let textToCopy = insight.message;
        const match = textToCopy.match(/["“](.*?)["”]/); // Extract content inside quotes if present
        if (match && match[1]) {
            textToCopy = match[1];
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    const handleAction = (action: ActionConfig) => {
        executeAction(action);
    };

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'question':
                return {
                    icon: MessageSquare,
                    color: "bg-[oklch(0.95_0.05_240)] text-[oklch(0.6_0.15_240)] border-[oklch(0.8_0.1_240)]",
                    gradient: "from-[oklch(0.98_0.02_240)] to-[oklch(0.95_0.05_240)]"
                };
            case 'warning':
                return {
                    icon: AlertTriangle,
                    color: "bg-[oklch(0.95_0.05_30)] text-[oklch(0.6_0.2_30)] border-[oklch(0.8_0.15_30)]",
                    gradient: "from-[oklch(0.98_0.02_30)] to-[oklch(0.95_0.05_30)]"
                };
            case 'suggestion':
                return {
                    icon: Lightbulb,
                    color: "bg-[oklch(0.98_0.05_85)] text-[oklch(0.6_0.18_85)] border-[oklch(0.85_0.12_85)]",
                    gradient: "from-[oklch(0.99_0.02_85)] to-[oklch(0.95_0.08_85)]"
                };
            case 'response':
                return {
                    icon: CheckCircle2,
                    color: "bg-[oklch(0.96_0.05_140)] text-[oklch(0.55_0.15_140)] border-[oklch(0.8_0.1_140)]",
                    gradient: "from-[oklch(0.99_0.02_140)] to-[oklch(0.96_0.06_140)]"
                };
            case 'clarification':
                return {
                    icon: AlertCircle,
                    color: "bg-[oklch(0.96_0.04_50)] text-[oklch(0.6_0.15_50)] border-[oklch(0.85_0.1_50)]",
                    gradient: "from-[oklch(0.99_0.02_50)] to-[oklch(0.96_0.05_50)]"
                };
            case 'behavior':
                return {
                    icon: Activity,
                    color: "bg-[oklch(0.96_0.08_280)] text-[oklch(0.6_0.2_280)] border-[oklch(0.85_0.15_280)]",
                    gradient: "from-[oklch(0.99_0.02_280)] to-[oklch(0.96_0.08_280)]"
                };
            default:
                return {
                    icon: Sparkles,
                    color: "bg-muted text-muted-foreground border-border",
                    gradient: "from-background to-muted/50"
                };
        }
    };

    const config = getTypeConfig(insight.type);
    const Icon = config.icon;
    const isHighImpact = insight.impact === 'high';
    const confidence = insight.confidence || 85;

    // Dynamic Icon for Action
    const getActionIcon = (iconName?: string) => {
        if (!iconName) return Zap;
        // @ts-ignore - Dynamic access to Lucide icons
        return Icons[iconName] || Zap;
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{
                opacity: 1,
                x: isHighImpact && showDismiss ? [0, -2, 2, -2, 2, 0] : 0 // Subtle rattle for high impact
            }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.4, type: "tween" }}
            layout
            className="group relative"
        >
            {/* Impact Glow */}
            <div className={cn(
                "absolute -inset-0.5 rounded-lg opacity-0 transition-opacity duration-500 blur-sm",
                isHighImpact && showDismiss ? "bg-gradient-to-r from-[oklch(0.6_0.2_30)] to-[oklch(0.7_0.2_50)] opacity-40 animate-pulse" : ""
            )} />

            <Card className={cn(
                "relative border-l-4 transition-all overflow-hidden backdrop-blur-sm bg-white/90 dark:bg-black/40",
                config.color,
                isHighImpact && "shadow-md border-l-[oklch(0.6_0.2_30)]",
                !showDismiss && "opacity-80 grayscale-[0.3]"
            )}>
                <div className={cn("absolute inset-0 opacity-40 bg-gradient-to-br", config.gradient)} />

                <CardContent className="relative p-3.5">
                    <div className="flex items-start gap-3">
                        {/* Icon Box */}
                        <div className={cn(
                            "p-2 rounded-xl shrink-0 shadow-sm border bg-background/80 flex flex-col items-center justify-center gap-1",
                            config.color.split(' ')[1]
                        )}>
                            <Icon className="h-4 w-4" />
                            {isHighImpact && <span className="text-[9px] font-bold uppercase tracking-wider">IMP</span>}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                            {/* Header */}
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="font-bold text-sm tracking-tight text-foreground/90 leading-tight">
                                    {insight.title}
                                </h4>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-muted-foreground/70 flex items-center gap-0.5">
                                        <Brain className="h-2.5 w-2.5" />
                                        {confidence}%
                                    </span>
                                </div>
                            </div>

                            {/* Message Body */}
                            <p className="text-xs font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                {insight.message}
                            </p>

                            {/* Context & Reasoning Chain */}
                            <div className="space-y-1.5 pt-1">
                                {(insight as any).context && (
                                    <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80">
                                        <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 opacity-50" />
                                        <span>{(insight as any).context}</span>
                                    </div>
                                )}

                                {insight.reasoningChain && insight.reasoningChain.length > 0 && (
                                    <div className="pt-1">
                                        <button
                                            onClick={() => setShowReasoning(!showReasoning)}
                                            className="text-[10px] flex items-center gap-1 text-primary/70 hover:text-primary transition-colors font-medium border-b border-dashed border-primary/30 pb-0.5"
                                        >
                                            <Brain className="h-2.5 w-2.5" />
                                            Ver Raciocínio ({insight.reasoningChain.length} passos)
                                        </button>

                                        <AnimatePresence>
                                            {showReasoning && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="pl-2 border-l-2 border-primary/10 mt-1.5 space-y-1 overflow-hidden"
                                                >
                                                    {insight.reasoningChain.map((step, idx) => (
                                                        <div key={idx} className="text-[9px] text-muted-foreground leading-snug">
                                                            {idx + 1}. {step}
                                                        </div>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons (Executable Guidance) */}
                            {insight.actions && insight.actions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                                    {insight.actions.map((action, idx) => {
                                        const ActionIcon = getActionIcon(action.icon);
                                        return (
                                            <Button
                                                key={idx}
                                                variant="default" // Primary Action
                                                size="sm"
                                                className="h-7 text-xs gap-1.5 shadow-sm bg-primary/90 hover:bg-primary"
                                                onClick={() => handleAction(action)}
                                            >
                                                <ActionIcon className="h-3 w-3" />
                                                {action.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Standard Footer Actions */}
                            <div className="flex items-center gap-2 mt-3 pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px] gap-1.5 bg-background/50 hover:bg-background/80 border-primary/10 hover:border-primary/20 transition-all font-medium"
                                    onClick={handleCopy}
                                >
                                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                    {copied ? "Copiado" : "Copiar Script"}
                                </Button>

                                {showDismiss && onDismiss && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 ml-auto text-[10px] text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
                                        onClick={() => onDismiss(insight.id)}
                                    >
                                        Ignorar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

export function MeetingGuidancePane() {
    const { insights, history, dismissInsight, dismissedCount } = useGuidanceEngine();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < insights.length) {
                    dismissInsight(insights[index].id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [insights, dismissInsight]);

    return (
        <Card className="h-full bg-gradient-to-br from-background via-background to-muted/20 border-border/50 shadow-xl overflow-hidden flex flex-col">
            <CardHeader className="p-4 py-3 border-b bg-muted/5 backdrop-blur shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[oklch(0.6_0.15_240)]/10 text-[oklch(0.6_0.15_240)] ring-1 ring-[oklch(0.6_0.15_240)]/20">
                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                            AI Co-Pilot
                        </span>
                    </CardTitle>
                    {insights.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] font-mono gap-1 px-2 h-5 text-green-600 bg-green-500/10 border-green-500/20">
                            <Activity className="h-3 w-3 animate-pulse" />
                            LIVE
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-2 pb-1 bg-muted/5 border-b sticky top-0 z-10">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="active" className="text-xs">
                            Sugestões Ativas
                            {insights.length > 0 &&
                                <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1 rounded-full">{insights.length}</span>
                            }
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">
                            Histórico
                            <span className="ml-1.5 text-[10px] text-muted-foreground">{dismissedCount}</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="active" className="flex-1 p-0 m-0 overflow-hidden relative">
                    <ScrollArea className="h-full" role="region" aria-label="Sugestões ativas">
                        <div className="p-4 space-y-4" role="live" aria-live="polite">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {insights.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-12 text-center"
                                    >
                                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 ring-1 ring-primary/20">
                                            <Brain className="h-8 w-8 text-primary/40" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground/80">
                                            Monitorizando conversa...
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                                            O Co-Pilot está a analisar padrões de fala e contexto estratégico.
                                        </p>
                                    </motion.div>
                                ) : (
                                    insights.map((insight, index) => (
                                        <GuidanceCard
                                            key={insight.id}
                                            insight={insight}
                                            index={index}
                                            onDismiss={dismissInsight}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                </TabsContent>

                <TabsContent value="history" className="flex-1 p-0 m-0 overflow-hidden relative">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-4">
                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground/50">
                                    <HistoryIcon className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-xs">Nenhum insight no histórico</p>
                                </div>
                            ) : (
                                history.map((insight, index) => (
                                    <GuidanceCard
                                        key={`hist-${insight.id}`}
                                        insight={insight}
                                        index={index}
                                        showDismiss={false}
                                    />
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </Card>
    );
}
