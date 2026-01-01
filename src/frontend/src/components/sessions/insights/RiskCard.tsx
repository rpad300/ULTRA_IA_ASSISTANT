import { useState, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, ShieldCheck, Sparkles, AlertOctagon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type Risk } from "@/store/meetingStore";
import { formatTime } from "@/utils/timeUtils";
import { motion, AnimatePresence } from "framer-motion";

interface RiskCardProps {
    risk: Risk;
    index: number;
}

export const RiskCard = memo(({ risk, index }: RiskCardProps) => {
    // Access UI slice from main store
    const { setFocusedBlockId } = useMeetingStore();
    const [isMitigating, setIsMitigating] = useState(false);
    const [mitigationPlan, setMitigationPlan] = useState<string | null>(null);

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'high':
                return {
                    bg: "bg-red-500/5",
                    border: "border-red-500/30",
                    text: "text-red-600 dark:text-red-400",
                    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                    icon: "text-red-500"
                };
            case 'medium':
                return {
                    bg: "bg-orange-500/5",
                    border: "border-orange-500/30",
                    text: "text-orange-600 dark:text-orange-400",
                    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
                    icon: "text-orange-500"
                };
            default:
                return {
                    bg: "bg-yellow-500/5",
                    border: "border-yellow-500/30",
                    text: "text-yellow-600 dark:text-yellow-400",
                    badge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
                    icon: "text-yellow-500"
                };
        }
    };

    const styles = getSeverityStyles(risk.severity);

    const handleGenerateMitigation = () => {
        setIsMitigating(true);
        // Mock AI Generation - in real app, call LLM
        setTimeout(() => {
            const suggestions = [
                "Suggested Script: 'Let's park this discussion for a separate offline meeting to avoid time overruns.'",
                "Action: Reassign lower priority tasks to next sprint.",
                "Script: 'To clarify, are we saying X is a blocker?'"
            ];
            setMitigationPlan(suggestions[Math.floor(Math.random() * suggestions.length)]);
            setIsMitigating(false);
        }, 1500);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.01 }}
            className="w-full"
        >
            <Card className={cn(
                "transition-all relative overflow-hidden",
                styles.bg,
                styles.border,
                // Soft pulse for high severity
                risk.severity === 'high' && "animate-pulse-subtle shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]"
            )}>
                {/* Gradient overlay for premium feel */}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30 pointer-events-none",
                    risk.severity === 'high' ? "from-red-500/10 to-transparent" : "from-orange-500/10 to-transparent"
                )} />

                <CardContent className="p-3 relative z-10">
                    <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 p-1.5 rounded-full bg-background/50 backdrop-blur-sm shadow-sm", styles.icon)}>
                            {risk.severity === 'high' ? <AlertOctagon className="h-4 w-4" /> :
                                risk.severity === 'medium' ? <AlertTriangle className="h-4 w-4" /> :
                                    <AlertCircle className="h-4 w-4" />}
                        </div>

                        <div className="flex-1 space-y-2">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider px-1.5", styles.badge)}>
                                        {risk.severity} Risk
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        {formatTime(risk.timestamp)}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <p className="text-sm font-medium leading-relaxed">
                                {risk.summary}
                            </p>

                            {/* Mitigation Section */}
                            <AnimatePresence>
                                {mitigationPlan && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="bg-background/60 backdrop-blur-md rounded-md p-2 border border-primary/10 text-xs"
                                    >
                                        <div className="flex items-center gap-1 text-primary mb-1 font-semibold">
                                            <ShieldCheck className="h-3 w-3" />
                                            AI Mitigation Plan
                                        </div>
                                        <p className="italic text-muted-foreground">{mitigationPlan}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Actions Footer */}
                            <div className="flex items-center gap-2 pt-1">
                                {risk.lineage?.blockId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] px-2 hover:bg-background/80"
                                        onClick={() => setFocusedBlockId(risk.lineage!.blockId!)}
                                    >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Context
                                    </Button>
                                )}

                                {!mitigationPlan && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn("h-6 text-[10px] px-2 ml-auto gap-1 transition-all",
                                            isMitigating ? "opacity-70" : "hover:border-primary/50"
                                        )}
                                        onClick={handleGenerateMitigation}
                                        disabled={isMitigating}
                                    >
                                        <Sparkles className={cn("h-3 w-3", isMitigating && "animate-spin")} />
                                        {isMitigating ? "Thinking..." : "Mitigate"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

RiskCard.displayName = "RiskCard";
