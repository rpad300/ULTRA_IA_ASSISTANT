import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Brain,
    TrendingUp,
    AlertTriangle,
    Users,
    History,
    Zap,
    ThumbsUp,
    ThumbsDown,
    ArrowRight,
    Sparkles,
    Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import type { CrossMeetingPattern } from "@/types/slices/intelligence";
import { motion, AnimatePresence } from "framer-motion";

// --- Configuration ---

const PATTERN_CONFIG: Record<string, { icon: any; color: string; label: string; bg: string }> = {
    pattern: {
        icon: History,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        label: "Padrão Recorrente"
    },
    contradiction: {
        icon: AlertTriangle,
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20",
        label: "Contradição"
    },
    trend: {
        icon: TrendingUp,
        color: "text-green-400",
        bg: "bg-green-500/10 border-green-500/20",
        label: "Tendência de Mercado"
    },
    relationship: {
        icon: Users,
        color: "text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20",
        label: "Relacionamento"
    }
};

const DEFAULT_CONFIG = {
    icon: Brain,
    color: "text-gray-400",
    bg: "bg-gray-500/10 border-gray-500/20",
    label: "Insight"
};

// --- Utilities ---

function timeAgo(timestamp: number) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
}

// --- Components ---

export function CrossMeetingIntelligence() {
    const {
        crossMeetingPatterns,
        isAnalyzingPatterns,
        addNotification // Using explicitly to simulate feedback action
    } = useMeetingStore();

    const [selectedPattern, setSelectedPattern] = useState<CrossMeetingPattern | null>(null);

    const handleFeedback = (e: React.MouseEvent, patternId: string, type: 'like' | 'dislike') => {
        e.stopPropagation();
        // Here we would call an API or store action. For now, we simulate it.
        console.log(`User ${type}d pattern ${patternId}`);
        addNotification({
            type: 'info',
            title: 'Feedback Enviado',
            message: `Você marcou este padrão como ${type === 'like' ? 'útil' : 'não relevante'}. O modelo aprenderá com isso.`,
            priority: 'low'
        });
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm h-full flex flex-col overflow-hidden relative">
            <CardHeader className="p-4 border-b border-border shrink-0 bg-card/80 z-10">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <div className="relative">
                            <Brain className={cn("h-4 w-4 text-primary transition-all duration-700", isAnalyzingPatterns ? "animate-pulse text-purple-400" : "")} />
                            {isAnalyzingPatterns && (
                                <motion.span
                                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-purple-500"
                                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            )}
                        </div>
                        Cross-Meeting Intelligence
                    </CardTitle>
                    {isAnalyzingPatterns && (
                        <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium uppercase tracking-wider animate-pulse">
                            <Sparkles className="h-3 w-3" />
                            Analyzing
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar relative">
                <div className="p-4 space-y-3">
                    <AnimatePresence mode="popLayout">
                        {/* Loading State (Initial) */}
                        {crossMeetingPatterns === undefined && (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-24 w-full rounded-lg bg-white/5" />
                                ))}
                            </div>
                        )}

                        {/* Empty State */}
                        {crossMeetingPatterns && crossMeetingPatterns.length === 0 && !isAnalyzingPatterns && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-12 text-center"
                            >
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                    <Search className="h-6 w-6 text-primary/60" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground mb-1">Aguardando Insights</h3>
                                <p className="text-xs text-muted-foreground max-w-[200px]">
                                    A IA está monitorando suas reuniões para encontrar padrões cruzados.
                                </p>
                            </motion.div>
                        )}

                        {/* Patterns List */}
                        {crossMeetingPatterns?.map((pattern) => {
                            const config = PATTERN_CONFIG[pattern.type] || DEFAULT_CONFIG;
                            const Icon = config.icon;

                            return (
                                <motion.div
                                    key={pattern.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => setSelectedPattern(pattern)}
                                    className={cn(
                                        "group cursor-pointer rounded-xl border p-3.5 transition-all duration-200 hover:shadow-md relative overflow-hidden",
                                        "bg-card hover:border-primary/30",
                                        config.bg
                                    )}
                                >
                                    {/* Type Badge & Time */}
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 h-5 bg-background/50 backdrop-blur-md border-0", config.color)}>
                                            <Icon className="h-3 w-3 mr-1" />
                                            {config.label}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                                            {timeAgo(pattern.timestamp)}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <p className="text-xs font-medium leading-relaxed text-foreground/90 line-clamp-3 mb-3">
                                        {pattern.description}
                                    </p>

                                    {/* Footer: Confidence & Actions */}
                                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-white/10 group-hover:border-primary/20 transition-colors">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-1.5 cursor-help">
                                                        <Zap className={cn("h-3 w-3", pattern.confidence > 85 ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")} />
                                                        <span className="text-[10px] font-mono text-muted-foreground">
                                                            {Math.round(pattern.confidence)}%
                                                        </span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Nível de Confiança da IA</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 duration-200">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-green-500/20 hover:text-green-400" onClick={(e) => handleFeedback(e, pattern.id, 'like')}>
                                                <ThumbsUp className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400" onClick={(e) => handleFeedback(e, pattern.id, 'dislike')}>
                                                <ThumbsDown className="h-3 w-3" />
                                            </Button>
                                            <div className="w-px h-3 bg-border mx-1" />
                                            <span className="text-[10px] text-primary flex items-center gap-0.5">
                                                Ver Detalhes <ArrowRight className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </CardContent>

            {/* Deep Dive Dialog */}
            <Dialog open={!!selectedPattern} onOpenChange={(open) => !open && setSelectedPattern(null)}>
                <DialogContent className="max-w-xl bg-card border-border">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={cn("p-2 rounded-lg", selectedPattern && (PATTERN_CONFIG[selectedPattern.type] || DEFAULT_CONFIG).bg)}>
                                {selectedPattern && (() => {
                                    const Icon = (PATTERN_CONFIG[selectedPattern.type] || DEFAULT_CONFIG).icon;
                                    return <Icon className={cn("h-5 w-5", (PATTERN_CONFIG[selectedPattern.type] || DEFAULT_CONFIG).color)} />;
                                })()}
                            </div>
                            <div>
                                <DialogTitle className="text-lg">Detalhes do Insight</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Descoberto {selectedPattern && timeAgo(selectedPattern.timestamp)} com {selectedPattern && Math.round(selectedPattern.confidence)}% de confiança
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {selectedPattern && (
                        <div className="space-y-6 pt-2">
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Análise Central</h4>
                                <p className="text-sm leading-relaxed text-foreground bg-muted/40 p-4 rounded-lg border border-border/50">
                                    {selectedPattern.description}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linhagem da Informação</h4>
                                <div className="space-y-2">
                                    {/* Mock Lineage - In production, use real snippets */}
                                    {selectedPattern.relatedMeetings?.map((mid, idx) => (
                                        <div key={idx} className="flex gap-3 text-xs p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                                            <div className="mt-0.5">
                                                <History className="h-3.5 w-3.5 text-primary/70" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-medium">Reunião Referenciada {mid.substring(0, 8)}...</p>
                                                <p className="text-muted-foreground italic">"Contexto relevante extraído desta reunião..."</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedPattern.relatedMeetings || selectedPattern.relatedMeetings.length === 0) && (
                                        <p className="text-xs text-muted-foreground pl-2">Nenhuma reunião específica vinculada nos metadados.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-border">
                                <Button size="sm" variant="outline" onClick={() => setSelectedPattern(null)}>Fechar</Button>
                                <Button size="sm" className="gap-2">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Gerar Plano de Ação
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
