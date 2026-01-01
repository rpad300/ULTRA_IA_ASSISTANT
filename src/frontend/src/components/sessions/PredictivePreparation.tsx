import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
    Users,
    MessageSquare,
    AlertTriangle,
    FileText,
    Download,
    Bot,
    ArrowRight,
    Shield,
    CheckCircle2,
    Target,
    Activity,
    BrainCircuit
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePredictiveEngine } from "@/hooks/usePredictiveEngine";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Micro-Components ---

function ProbabilityRing({ percentage, color }: { percentage: number; color?: string }) {
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const strokeColor = color || "currentColor";

    return (
        <div className="relative flex items-center justify-center">
            <svg width="24" height="24" className="-rotate-90">
                <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="opacity-10"
                />
                <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    fill="transparent"
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <span className="absolute text-[8px] font-bold">{Math.round(percentage)}</span>
        </div>
    );
}

function BattleCard({ risk }: { risk: { risk: string; probability: number; battleCard: string; status: 'active' | 'mitigated' } }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <motion.div
            layout
            className={cn(
                "group relative border rounded-xl overflow-hidden transition-all duration-300",
                risk.status === 'mitigated'
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
            )}
        >
            <div
                className="p-3 cursor-pointer flex items-center justify-between"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        risk.status === 'mitigated' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                        {risk.status === 'mitigated' ? <Shield className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                        <p className={cn("text-xs font-semibold", risk.status === 'mitigated' && "line-through opacity-70")}>
                            {risk.risk}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">Probability:</span>
                            <div className="h-1 w-12 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    className={cn("h-full", risk.status === 'mitigated' ? "bg-green-500" : "bg-red-500")}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${risk.probability}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                </Button>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-background/40 backdrop-blur-md border-t border-border/50"
                    >
                        <div className="p-3 pt-2 space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Shield className="h-3 w-3" /> Counter-Strategy (Battle Card)
                            </h4>
                            <p className="text-xs leading-relaxed italic border-l-2 border-primary/30 pl-2">
                                "{risk.battleCard}"
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// --- Main Component ---

export function PredictivePreparation() {
    const {
        currentPrep,
        isGenerating,
        generatePreparation,
        sendToCoPilot,
        exportDocument
    } = usePredictiveEngine();

    return (
        <Card className="h-full border-border bg-card/40 backdrop-blur-xl shadow-sm flex flex-col relative overflow-hidden group/card">
            {/* Neural Pulse Background Effect */}
            {isGenerating && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <motion.div
                        className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"
                        animate={{ top: ["0%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute rounded-full border border-primary/20"
                            style={{
                                left: "50%",
                                top: "50%",
                                x: "-50%",
                                y: "-50%"
                            }}
                            initial={{ width: 0, height: 0, opacity: 1 }}
                            animate={{ width: 400 + i * 100, height: 400 + i * 100, opacity: 0 }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                        />
                    ))}
                </div>
            )}

            <CardHeader className="p-4 border-b border-border/40 shrink-0 bg-muted/5 z-10 glass-header">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/10 shadow-inner">
                            <BrainCircuit className={cn("h-4 w-4", isGenerating && "animate-pulse")} />
                        </div>
                        <div className="flex flex-col">
                            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                Strategic Anticipation
                            </span>
                            {currentPrep && (
                                <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-1">
                                    <Activity className="h-2.5 w-2.5" />
                                    Live Context Active
                                </span>
                            )}
                        </div>
                    </CardTitle>
                    <div className="flex gap-1">
                        {currentPrep && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => exportDocument('pdf')}
                                            className="h-7 w-7 p-0"
                                        >
                                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Export PDF</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <Button
                            size="sm"
                            variant={currentPrep ? "outline" : "default"}
                            onClick={generatePreparation}
                            disabled={isGenerating}
                            className={cn(
                                "text-xs h-7 transition-all",
                                !currentPrep && "animate-shimmer bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_100%] text-white border-0"
                            )}
                        >
                            {isGenerating ? (
                                <>
                                    <Sparkles className="h-3 w-3 mr-1.5 animate-spin" />
                                    Analyzing...
                                </>
                            ) : currentPrep ? 'Regenerate' : 'Generate Strategy'}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar z-10 relative">
                {!currentPrep && !isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-muted-foreground opacity-80">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-card/50 p-6 rounded-full border border-dashed border-border mb-4"
                        >
                            <Target className="h-10 w-10 text-primary/40" />
                        </motion.div>
                        <p className="text-sm font-medium text-foreground">Awaiting Strategic Calibration</p>
                        <p className="text-xs max-w-[200px] mt-1 leading-relaxed">
                            Activate the engine to analyze participants, anticipate risks, and map the meeting terrain.
                        </p>
                    </div>
                ) : currentPrep ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 space-y-6"
                    >
                        {/* 1. Topics Tracker (Dynamic) */}
                        <section className="space-y-3">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Topic Trajectory
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {currentPrep.likelyTopics.map((topic, i) => (
                                    <motion.div
                                        key={i}
                                        layout
                                        className={cn(
                                            "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                                            topic.status === 'discussed'
                                                ? "bg-primary/10 border-primary/20 text-primary"
                                                : "bg-card/30 border-white/5 hover:bg-card/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {topic.status === 'discussed' ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                            ) : (
                                                <div className="h-3.5 w-3.5 rounded-full border-2 border-muted shrink-0" />
                                            )}
                                            <span className={cn("text-xs font-medium truncate", topic.status === 'discussed' && "line-through opacity-70")}>
                                                {topic.topic}
                                            </span>
                                        </div>
                                        <ProbabilityRing percentage={topic.confidence} color={topic.status === 'discussed' ? '#10b981' : undefined} />
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        {/* 2. Stakeholder Intelligence */}
                        <section className="space-y-3">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Users className="h-3 w-3" /> Stakeholder Mapping
                            </h3>
                            <div className="space-y-3">
                                {currentPrep.participantInsights.map((participant, idx) => (
                                    <div key={idx} className="relative pl-3 border-l-2" style={{ borderColor: participant.color }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold">{participant.name}</span>
                                            <div className="flex gap-1">
                                                {participant.historicalAttention.map((area, ii) => (
                                                    <Badge key={ii} variant="secondary" className="text-[9px] h-4 px-1 py-0 shadow-none bg-background/50 border-border/50">
                                                        {area}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-snug mb-2 italic">
                                            "{participant.insights[0]}"
                                        </p>
                                        <div className="space-y-1">
                                            {participant.likelyQuestions.map((q, qi) => (
                                                <div key={qi} className="group flex items-center gap-2 bg-muted/10 p-1.5 rounded-md hover:bg-muted/20 transition-colors">
                                                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="text-[10px] flex-1">{q}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                                        onClick={() => sendToCoPilot(q)}
                                                        title="Prep answer with Co-Pilot"
                                                    >
                                                        <Bot className="h-3 w-3 text-primary" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 3. Risk Battle Cards */}
                        <section className="space-y-3">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Shield className="h-3 w-3" /> Risk Mitigation
                            </h3>
                            <div className="space-y-2">
                                {currentPrep.risks.map((risk, idx) => (
                                    <BattleCard key={idx} risk={risk} />
                                ))}
                            </div>
                        </section>
                    </motion.div>
                ) : null}
            </CardContent>
        </Card>
    );
}
