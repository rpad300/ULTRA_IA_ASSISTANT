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
    Search,
    Copy,
    GitCommit,
    Activity,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useIntelligenceEngine } from "@/hooks/useIntelligenceEngine";
import type { CrossMeetingPattern, RelatedMeetingExcerpt } from '@/types/slices/intelligence';
import { motion, AnimatePresence } from "framer-motion";

// --- Configuration ---

const PATTERN_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
    pattern: {
        icon: History,
        color: "text-blue-400",
        bg: "bg-blue-500/5",
        border: "border-blue-500/20",
        label: "Padrão Recorrente"
    },
    contradiction: {
        icon: AlertTriangle,
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        label: "Contradição Crítica"
    },
    sentiment_shift: { // New Type
        icon: Activity,
        color: "text-pink-400",
        bg: "bg-pink-500/5",
        border: "border-pink-500/20",
        label: "Desvio de Sentimento"
    },
    trend: {
        icon: TrendingUp,
        color: "text-emerald-400",
        bg: "bg-emerald-500/5",
        border: "border-emerald-500/20",
        label: "Tendência"
    },
    relationship: {
        icon: Users,
        color: "text-violet-400",
        bg: "bg-violet-500/5",
        border: "border-violet-500/20",
        label: "Relacionamento"
    }
};

const DEFAULT_CONFIG = {
    icon: Brain,
    color: "text-gray-400",
    bg: "bg-gray-500/5",
    border: "border-gray-500/20",
    label: "Insight"
};

// --- Sub-Components ---

function SentimentSparkline({ trend }: { trend: readonly number[] }) {
    // Simple SVG Sparkline
    if (!trend || trend.length < 2) return null;

    const width = 60;
    const height = 20;
    const max = Math.max(...trend, 0.5); // normalization
    const min = Math.min(...trend, -0.5);
    const context = max - min;

    const points = trend.map((val, i) => {
        const x = (i / (trend.length - 1)) * width;
        const y = height - ((val - min) / context) * height;
        return `${x},${y}`;
    }).join(" ");

    const isPositive = trend[trend.length - 1] > trend[0];
    const color = isPositive ? "#34d399" : "#f472b6"; // Emerald or Pink

    return (
        <div className="flex items-center gap-2" title="Tendência de Sentimento (5 reuniões)">
            <svg width={width} height={height} className="overflow-visible">
                <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                />
                {/* End dot */}
                <circle cx={(trend.length - 1) * (width / (trend.length - 1))} cy={height - ((trend[trend.length - 1] - min) / context) * height} r="2" fill={color} />
            </svg>
            <span className={cn("text-[10px] font-mono", isPositive ? "text-emerald-400" : "text-pink-400")}>
                {isPositive ? "+Trend" : "-Drop"}
            </span>
        </div>
    );
}

function NeuralBackground() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            {/* Random Moving Particles */}
            {[...Array(6)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full bg-primary/40 blur-sm"
                    initial={{
                        x: Math.random() * 100 + "%",
                        y: Math.random() * 100 + "%",
                        scale: Math.random() * 0.5 + 0.5
                    }}
                    animate={{
                        x: [
                            Math.random() * 100 + "%",
                            Math.random() * 100 + "%",
                            Math.random() * 100 + "%"
                        ],
                        y: [
                            Math.random() * 100 + "%",
                            Math.random() * 100 + "%",
                            Math.random() * 100 + "%"
                        ]
                    }}
                    transition={{
                        duration: 10 + Math.random() * 10,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    style={{
                        width: Math.random() * 60 + 20 + "px",
                        height: Math.random() * 60 + 20 + "px",
                    }}
                />
            ))}
            {/* Scanning Line */}
            <motion.div
                className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
        </div>
    );
}

function HistoricalContextModal({
    isOpen,
    onClose,
    snippet,
    blocks
}: {
    isOpen: boolean;
    onClose: () => void;
    snippet: RelatedMeetingExcerpt | null;
    blocks: any[];
}) {
    return (
        <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl bg-black/90 border-border backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-md">
                        <History className="h-4 w-4 text-primary" />
                        Time Travel: {snippet?.meetingTitle}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-mono">
                        {snippet?.date ? new Date(snippet.date).toLocaleDateString() : ''} — Historical Context
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="bg-muted/10 rounded-lg p-1 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {blocks.map((block) => (
                            <div
                                key={block.id}
                                className={cn(
                                    "p-3 rounded text-sm border-l-2 transition-colors",
                                    block.isHighlight
                                        ? "bg-primary/10 border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-white/5"
                                )}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={cn("text-xs font-bold", block.isHighlight ? "text-primary" : "text-muted-foreground/70")}>{block.speaker}</span>
                                    <span className="text-[10px] font-mono opacity-50">-05:22</span>
                                </div>
                                <p className="leading-relaxed">{block.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>Close Context</Button>
                    <Button size="sm" variant="secondary" className="gap-2">
                        <Copy className="h-3.5 w-3.5" /> Copy Quote
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Component ---

export function CrossMeetingIntelligence() {
    const {
        crossMeetingPatterns,
        isAnalyzingPatterns,
        addNotification
    } = useMeetingStore();

    const {
        generateActionPlan,
        openTimeTravel,
        closeTimeTravel,
        historicalContext
    } = useIntelligenceEngine();

    const [selectedPattern, setSelectedPattern] = useState<CrossMeetingPattern | null>(null);
    const [justGeneratedAction, setJustGeneratedAction] = useState<string | null>(null);

    const handleGenerateAction = (pattern: CrossMeetingPattern) => {
        const success = generateActionPlan(pattern);
        if (success) {
            setJustGeneratedAction(pattern.id);
            setTimeout(() => setJustGeneratedAction(null), 2000); // Reset animation state
        }
    };

    const handleFeedback = (e: React.MouseEvent, patternId: string, type: 'like' | 'dislike') => {
        e.stopPropagation();

        if (type === 'dislike') {
            // "Transparent Feedback" Mock
            const reason = window.prompt("Help us improve: Why is this not relevant?\n1. Incorrect\n2. Obvious\n3. Duplicated", "1");
            console.log("Feedback reason:", reason);
        }

        addNotification({
            type: 'info',
            title: 'Learning Signal Sent',
            message: `Feedback recorded for pattern ${patternId} for Neural Engine optimization.`,
            priority: 'low'
        });
    };

    return (
        <>
            <Card className="border-border bg-card/40 backdrop-blur-md h-full flex flex-col overflow-hidden relative shadow-xl">
                {/* Header */}
                <CardHeader className="p-4 border-b border-border/50 shrink-0 bg-card/50 z-10">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                            <div className="relative">
                                <Brain className={cn("h-4 w-4 text-primary transition-all duration-700", isAnalyzingPatterns ? "animate-pulse text-violet-400" : "")} />
                                {isAnalyzingPatterns && (
                                    <motion.span
                                        className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                                        animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                            </div>
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                                Cross-Meeting Intelligence
                            </span>
                        </CardTitle>
                        {isAnalyzingPatterns && (
                            <div className="flex items-center gap-1.5 text-[10px] text-violet-400 font-medium uppercase tracking-wider animate-pulse">
                                <Sparkles className="h-3 w-3" />
                                Connecting Nodes...
                            </div>
                        )}
                    </div>
                </CardHeader>

                {/* Main List */}
                <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar relative">

                    {isAnalyzingPatterns && <NeuralBackground />}

                    <div className="p-4 space-y-3 relative z-10">
                        <AnimatePresence mode="popLayout">
                            {/* Loading State */}
                            {crossMeetingPatterns === undefined && (
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} className="h-28 w-full rounded-xl bg-white/5" />
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
                                    <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary/20 to-violet-500/10 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                                        <GitCommit className="h-8 w-8 text-primary/60" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-foreground mb-1">Knowledge Graph Idle</h3>
                                    <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                                        No new cross-references detected. The neural engine is monitoring for semantic links.
                                    </p>
                                </motion.div>
                            )}

                            {/* Patterns List */}
                            {crossMeetingPatterns?.map((pattern) => {
                                const config = PATTERN_CONFIG[pattern.type] || DEFAULT_CONFIG;
                                const Icon = config.icon;
                                const isCritical = pattern.contradictionSeverity === 'critical';

                                return (
                                    <motion.div
                                        key={pattern.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{
                                            opacity: 1,
                                            scale: 1,
                                            y: 0,
                                            boxShadow: isCritical ? "0 0 0 1px rgba(239, 68, 68, 0.4), 0 4px 20px rgba(239, 68, 68, 0.1)" : "none"
                                        }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        whileHover={{ scale: 1.01 }}
                                        onClick={() => setSelectedPattern(pattern)}
                                        className={cn(
                                            "group cursor-pointer rounded-xl border p-4 transition-all duration-300 relative overflow-hidden backdrop-blur-md",
                                            "bg-card/60 hover:bg-card/80",
                                            config.border
                                        )}
                                    >
                                        {/* Background gradient hint */}
                                        <div className={cn("absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity", config.bg)} />

                                        {/* Content Wrapper */}
                                        <div className="relative">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-2.5">
                                                <Badge variant="secondary" className={cn("text-[10px] px-2 py-0.5 h-6 bg-background/50 backdrop-blur-md border-white/10 shadow-sm", config.color)}>
                                                    <Icon className="h-3 w-3 mr-1.5" />
                                                    {config.label}
                                                </Badge>
                                                {pattern.type === 'sentiment_shift' && pattern.sentimentTrend && (
                                                    <SentimentSparkline trend={pattern.sentimentTrend} />
                                                )}
                                                {isCritical && (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 animate-pulse">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        CRITICAL ALERT
                                                    </div>
                                                )}
                                            </div>

                                            {/* Description */}
                                            <p className="text-xs font-medium leading-relaxed text-foreground/90 line-clamp-3 mb-3 pl-1">
                                                {pattern.description}
                                            </p>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-white/10 group-hover:border-primary/20 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <div className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                                                                    <Zap className={cn("h-3 w-3", pattern.confidence > 85 ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")} />
                                                                    <span className="text-[10px] font-mono text-muted-foreground">
                                                                        {Math.round(pattern.confidence)}%
                                                                    </span>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Confidence Score</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>

                                                    {pattern.relatedMeetings?.length ? (
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                                                            <GitCommit className="h-3 w-3" />
                                                            {pattern.relatedMeetings.length} Refs
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-green-500/20 hover:text-green-400" onClick={(e) => handleFeedback(e, pattern.id, 'like')}>
                                                        <ThumbsUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400" onClick={(e) => handleFeedback(e, pattern.id, 'dislike')}>
                                                        <ThumbsDown className="h-3 w-3" />
                                                    </Button>
                                                    <div className="w-px h-3 bg-border mx-1" />
                                                    <span className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                                                        Deep Dive <ArrowRight className="h-3 w-3" />
                                                    </span>
                                                </div>
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
                    <DialogContent className="max-w-xl bg-card/95 border-border backdrop-blur-xl shadow-2xl">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={cn("p-2.5 rounded-xl shadow-inner", selectedPattern && (PATTERN_CONFIG[selectedPattern.type] || DEFAULT_CONFIG).bg)}>
                                    {selectedPattern && (() => {
                                        const Icon = (PATTERN_CONFIG[selectedPattern.type] || DEFAULT_CONFIG).icon;
                                        return <Icon className={cn("h-6 w-6", (PATTERN_CONFIG[selectedPattern.type] || DEFAULT_CONFIG).color)} />;
                                    })()}
                                </div>
                                <div className="space-y-0.5">
                                    <DialogTitle className="text-lg font-bold">Deep Insight Analysis</DialogTitle>
                                    <DialogDescription className="text-xs flex items-center gap-2">
                                        Generated via Neural Engine • {selectedPattern && new Date(selectedPattern.timestamp).toLocaleTimeString()}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {selectedPattern && (
                            <div className="space-y-6 pt-2">
                                {/* Core Analysis Block */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Search className="h-3 w-3" /> Analysis Logic
                                    </h4>
                                    <p className="text-sm leading-relaxed text-foreground bg-muted/30 p-4 rounded-xl border border-white/5 font-medium shadow-sm">
                                        {selectedPattern.description}
                                    </p>
                                </div>

                                {/* Resolution Script (Conditional) */}
                                {selectedPattern.type === 'contradiction' && selectedPattern.resolutionScript && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                                                <Sparkles className="h-3 w-3" /> Diplomatic Resolution Script
                                            </h4>
                                            <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground gap-1">
                                                <Copy className="h-3 w-3" /> Copy
                                            </Button>
                                        </div>
                                        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl relative group">
                                            <p className="text-sm text-orange-200/90 italic oldstyle-nums leading-relaxed">
                                                "{selectedPattern.resolutionScript}"
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Semantic Lineage */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <History className="h-3 w-3" /> Semantic Lineage
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedPattern.relatedMeetings?.map((excerpt, idx) => (
                                            <div key={idx} className="group flex flex-col gap-2 text-xs p-3 rounded-xl border border-white/5 bg-black/20 hover:bg-black/30 transition-all">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-md">
                                                        <History className="h-3 w-3 text-primary/70" />
                                                        <span className="font-semibold text-primary/90">{excerpt.meetingTitle}</span>
                                                        <span className="text-[10px] text-muted-foreground opacity-70">
                                                            {new Date(excerpt.date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                                                        onClick={() => openTimeTravel(excerpt)}
                                                    >
                                                        Review Context <ArrowRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <p className="text-muted-foreground pl-1 border-l-2 border-primary/20 italic">
                                                    "{excerpt.snippet}"
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setSelectedPattern(null)}>
                                        Dismiss
                                    </Button>
                                    <div className="relative">
                                        <Button
                                            size="sm"
                                            className={cn("gap-2 transition-all duration-300", justGeneratedAction === selectedPattern.id ? "bg-green-500 hover:bg-green-600 text-white" : "bg-primary hover:bg-primary/90")}
                                            onClick={() => handleGenerateAction(selectedPattern)}
                                            disabled={!!justGeneratedAction}
                                        >
                                            {justGeneratedAction === selectedPattern.id ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Action Plan Created
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="h-4 w-4" />
                                                    Generate Action Plan
                                                </>
                                            )}
                                        </Button>

                                        {/* Feed-Forward Light Trail Animation */}
                                        <AnimatePresence>
                                            {justGeneratedAction === selectedPattern.id && (
                                                <motion.div
                                                    className="absolute top-1/2 left-1/2 h-4 w-4 rounded-full bg-primary z-50 pointer-events-none blur-sm"
                                                    initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                                                    animate={{
                                                        x: 400, // Move right towards LiveInsights pane
                                                        y: 100,
                                                        opacity: 0,
                                                        scale: 0.2
                                                    }}
                                                    transition={{ duration: 0.8, ease: "easeIn" }}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Historical Context Modal (Time Travel) */}
                <HistoricalContextModal
                    isOpen={historicalContext.isOpen}
                    onClose={closeTimeTravel}
                    snippet={historicalContext.snippet}
                    blocks={historicalContext.surroundingBlocks}
                />
            </Card>
        </>
    );
}
