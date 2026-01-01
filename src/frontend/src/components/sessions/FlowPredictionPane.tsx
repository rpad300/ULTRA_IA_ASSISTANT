import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Clock, Lightbulb, Play, X, ArrowDown, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePredictionEngine } from "@/hooks/usePredictionEngine";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function FlowPredictionPane() {
    const {
        predictions,
        currentTopic,
        optimisticTopic,
        topPredictionTimeLeft,
        actions
    } = usePredictionEngine();

    // Helper for time formatting
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper for OKLCH glow based on confidence
    const getConfidenceStyles = (confidence: number) => {
        // High confidence (green-ish/cyan)
        if (confidence > 80) return {
            borderColor: "oklch(0.7 0.15 150)",
            glow: "shadow-[0_0_15px_oklch(0.7_0.15_150/0.3)]",
            text: "text-[oklch(0.7_0.15_150)]",
            pulse: true
        };
        // Medium (yellow/amber)
        if (confidence > 50) return {
            borderColor: "oklch(0.8 0.15 85)",
            glow: "shadow-[0_0_10px_oklch(0.8_0.15_85/0.2)]",
            text: "text-[oklch(0.8_0.15_85)]",
            pulse: false
        };
        // Low (gray/blue)
        return {
            borderColor: "oklch(0.7 0.05 250)",
            glow: "",
            text: "text-muted-foreground",
            pulse: false
        };
    };

    if (predictions.length === 0 && !currentTopic) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm h-full flex flex-col justify-center items-center p-6 text-muted-foreground/50">
                <Map className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs font-mono">Aguardando percurso...</p>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm h-full flex flex-col overflow-hidden">
            <CardHeader className="p-3 border-b border-border bg-card/30 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Map className="h-4 w-4 text-primary" />
                    <span>Meeting Roadmap</span>
                    <Badge variant="outline" className="ml-auto text-[10px] font-mono opacity-70">
                        AUTO-NAV
                    </Badge>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto relative scrollbar-thin">
                {/* Timeline Container */}
                <div className="relative pl-6 pr-3 py-4 space-y-6">

                    {/* Continuous Dotted Line Background */}
                    <div className="absolute left-[1.125rem] top-4 bottom-4 w-px border-l-2 border-dotted border-primary/20" />

                    {/* CURRENT TOPIC (The Present) */}
                    <div className="relative z-10">
                        {/* Dot */}
                        <div className="absolute -left-[1.35rem] top-3 h-4 w-4 rounded-full bg-primary ring-4 ring-primary/20 shadow-[0_0_10px_theme(colors.primary.DEFAULT)] flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-background" />
                        </div>

                        <div className="ml-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Em Progresso
                            </h3>
                            <div className={cn(
                                "p-3 rounded-lg border bg-primary/10 border-primary/30 relative overflow-hidden transition-all duration-500",
                                optimisticTopic ? "opacity-50 blur-[1px]" : "opacity-100"
                            )}>
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    <span className="font-semibold text-sm">
                                        {currentTopic || "Início da Sessão"}
                                    </span>
                                </div>
                                <div className="absolute top-0 right-0 p-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ANIMATED FLOW LINE (SVG for moving dashes) */}
                    {/* ANIMATED FLOW LINE (SVG for moving dashes) */}
                    <div className="absolute left-[1.125rem] top-12 bottom-4 w-1 overflow-visible pointer-events-none">
                        <svg className="h-full w-full overflow-visible" preserveAspectRatio="none">
                            <motion.path
                                d="M 0 0 V 2000" // Long vertical path
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray="6 6"
                                className="text-primary/30"
                                initial={{ strokeDashoffset: 0 }}
                                animate={{ strokeDashoffset: 12 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                fill="none"
                            />
                        </svg>
                    </div>

                    {/* FUTURE PREDICTIONS */}
                    <AnimatePresence mode="popLayout">
                        {predictions.map((p, index) => {
                            const styles = getConfidenceStyles(p.confidence);
                            const isNext = index === 0;
                            const isMobileCompactHidden = index > 0; // Logic for mobile hiding invoked via CSS classes

                            return (
                                <motion.div
                                    key={p.id}
                                    layoutId={p.id}
                                    initial={{ opacity: 0, x: -20, height: 0 }}
                                    animate={{
                                        opacity: isNext ? 1 : 0.7 - (index * 0.15),
                                        x: 0,
                                        height: 'auto',
                                        transition: { type: "spring", stiffness: 300, damping: 30 }
                                    }}
                                    exit={{ opacity: 0, x: 20, height: 0 }}
                                    className={cn(
                                        "relative z-10 group",
                                        // Mobile Compact: Hide non-immediate predictions on small screens, show all on md+
                                        isMobileCompactHidden ? "hidden md:block" : "block"
                                    )}
                                    // Accessibility
                                    aria-label={`Previsão: ${p.predictedTopic}`}
                                    aria-live={isNext ? "polite" : "off"}
                                >
                                    {/* Connection Node */}
                                    <div className={cn(
                                        "absolute -left-[1.3rem] top-4 h-3 w-3 rounded-full border-2 bg-background transition-colors duration-300",
                                        styles.borderColor,
                                        isNext ? "scale-110" : "scale-100 opacity-60"
                                    )} style={{ borderColor: styles.borderColor }} />

                                    <div className="ml-2">
                                        {/* Progressive Countdown for Next Item */}
                                        {isNext && topPredictionTimeLeft !== null && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center gap-1 text-[10px] text-primary mb-1 font-mono"
                                            >
                                                <ArrowDown className="h-3 w-3 animate-bounce" />
                                                <span>Em ~{formatTime(topPredictionTimeLeft)}</span>
                                            </motion.div>
                                        )}

                                        {/* Card */}
                                        <div
                                            className={cn(
                                                "p-3 rounded- border transition-all duration-300 relative",
                                                "hover:bg-accent/5", // Interactive hover
                                                styles.glow,
                                                optimisticTopic === p.predictedTopic ? "ring-2 ring-primary scale-[1.02]" : ""
                                            )}
                                            style={{ borderColor: styles.borderColor }}
                                        >
                                            {/* Pulse Effect for High Confidence */}
                                            {styles.pulse && (
                                                <div className="absolute inset-0 rounded-lg animate-pulse bg-primary/5 pointer-events-none" />
                                            )}

                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">
                                                            {p.predictedTopic}
                                                        </span>
                                                        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", styles.text)}>
                                                            {Math.round(p.confidence)}%
                                                        </Badge>
                                                    </div>

                                                    {/* Reasoning with Context Link Hook */}
                                                    <div className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1">
                                                        <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
                                                        <span>{p.reasoning}</span>
                                                        {p.lineage?.blockId && (
                                                            <Button
                                                                variant="link"
                                                                className="h-auto p-0 text-[10px] text-primary ml-1 underline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // SOTA: Emit event to focus on context
                                                                    console.log('Focus Context:', p.lineage?.blockId);
                                                                }}
                                                            >
                                                                (Ver contexto)
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Steering Controls (Visible on Hover/Focus) */}
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 hover:bg-primary/20 hover:text-primary"
                                                                    onClick={() => actions.jumpToTopic(p)}
                                                                    aria-label="Pular para este tópico agora"
                                                                >
                                                                    {optimisticTopic === p.predictedTopic ? (
                                                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                                    ) : (
                                                                        <Play className="h-3 w-3" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left">
                                                                <p>Pular para aqui</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>

                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                                                                    onClick={() => actions.ignorePrediction(p.id)}
                                                                    aria-label="Ignorar esta previsão"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left">
                                                                <p>Ignorar</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>

                                            {/* Time Estimate Footer */}
                                            <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1 opacity-60">
                                                <Clock className="h-3 w-3" />
                                                <span>+{Math.round(p.estimatedTime / 60)} min</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}
