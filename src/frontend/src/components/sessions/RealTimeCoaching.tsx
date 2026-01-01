import { useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, X, AlertCircle, CheckCircle2, AlertTriangle, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import { useCoachingEngine } from "@/hooks/useCoachingEngine";

export function RealTimeCoaching() {
    const {
        coachingInsights,
        dismissCoachingInsight
    } = useMeetingStore();

    const { currentWpm, heartbeatState, paceProgress } = useCoachingEngine();

    // Keyboard Shortcut: Alt + H to dismiss/hide (simulated by just clearing insights for now or could implement full hide)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'h') {
                // Dismiss all current insights
                coachingInsights.forEach(i => dismissCoachingInsight(i.id));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [coachingInsights, dismissCoachingInsight]);

    const getSeverityStyles = (severity: 'good' | 'warning' | 'critical') => {
        switch (severity) {
            case 'good':
                return {
                    bg: 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20',
                    border: 'border-emerald-500/20',
                    text: 'text-emerald-600 dark:text-emerald-400',
                    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
                    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                };
            case 'warning':
                return {
                    bg: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20',
                    border: 'border-amber-500/20',
                    text: 'text-amber-600 dark:text-amber-400',
                    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
                    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                };
            case 'critical':
                return {
                    bg: 'bg-gradient-to-r from-red-500/10 to-rose-500/10 hover:from-red-500/20 hover:to-rose-500/20',
                    border: 'border-red-500/30 animate-pulse-border', // Custom class for border glow
                    text: 'text-red-600 dark:text-red-400',
                    icon: <AlertCircle className="h-4 w-4 text-red-500" />,
                    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                };
        }
    };

    // Heartbeat Animation Variants
    const heartbeatVariants = {
        calm: { scale: [1, 1.05, 1], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }, color: "var(--emerald-500)" },
        warning: { scale: [1, 1.1, 1], transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }, color: "var(--amber-500)" },
        critical: { scale: [1, 1.2, 1], transition: { duration: 0.4, repeat: Infinity, ease: "easeInOut" }, color: "var(--red-500)" }
    };

    // Get Heartbeat Color for CSS
    const getHeartbeatColor = () => {
        if (heartbeatState === 'critical') return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]';
        if (heartbeatState === 'warning') return 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]';
        return 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]';
    };

    const recentInsights = coachingInsights.slice(-3).reverse(); // Newest top

    return (
        <Card className="border-border/50 bg-background/40 backdrop-blur-xl shadow-xl overflow-hidden h-full flex flex-col transition-all duration-300 group hover:shadow-2xl hover:bg-background/50">
            {/* Header with Neural Heartbeat */}
            <CardHeader className="p-4 border-b border-border/40 shrink-0 flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                    <motion.div
                        className={cn("relative z-10 p-1.5 rounded-full bg-background/50 border border-border/30", getHeartbeatColor())}
                        animate={heartbeatState}
                        variants={heartbeatVariants as any}
                    >
                        <Brain className="h-5 w-5 fill-current/10" />

                        {/* Ping Ring */}
                        {heartbeatState !== 'calm' && (
                            <motion.div
                                className="absolute inset-0 rounded-full border border-current opacity-50"
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 2, opacity: 0 }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        )}
                    </motion.div>

                    <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight text-foreground/90">
                            Neural Coach
                        </span>
                        <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-mono", getHeartbeatColor())}>
                                {currentWpm} WPM
                            </span>
                            {/* Mini Pace Gauge */}
                            <div className="w-16 h-1 bg-muted/50 rounded-full overflow-hidden">
                                <motion.div
                                    className={cn("h-full rounded-full transition-colors duration-500",
                                        paceProgress > 85 ? "bg-red-500" :
                                            paceProgress > 65 ? "bg-amber-500" :
                                                paceProgress < 20 ? "bg-blue-400" : "bg-emerald-500"
                                    )}
                                    layout
                                    initial={{ width: '50%' }}
                                    animate={{ width: `${paceProgress}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background/30 backdrop-blur-md border-border/40">
                        Running
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto overflow-x-hidden relative min-h-[150px]" style={{ scrollbarWidth: 'thin' }}>
                <AnimatePresence mode="popLayout" initial={false}>
                    {recentInsights.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 p-6 text-center space-y-2"
                        >
                            <Activity className="h-8 w-8 opacity-20" />
                            <p className="text-xs font-medium">Listening to telemetry...</p>
                        </motion.div>
                    ) : (
                        <div className="p-3 space-y-3">
                            {recentInsights.map((insight) => {
                                const styles = getSeverityStyles(insight.severity);
                                return (
                                    <motion.div
                                        key={insight.id}
                                        layout
                                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                        exit={{ opacity: 0, x: -20, scale: 0.9 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        className={cn(
                                            "relative rounded-xl border p-3.5 shadow-sm backdrop-blur-md transition-all",
                                            styles.bg,
                                            styles.border,
                                            styles.glow
                                        )}
                                        role={insight.severity === 'critical' ? "alert" : "status"}
                                        aria-live={insight.severity === 'critical' ? "assertive" : "polite"}
                                    >
                                        {/* Sparkle Effect for Good insights */}
                                        {insight.severity === 'good' && (
                                            <div className="absolute -top-1 -right-1 pointer-events-none">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: [0, 1.2, 0], rotate: 180 }}
                                                    transition={{ duration: 0.8 }}
                                                >
                                                    <Zap className="h-4 w-4 text-emerald-400 fill-emerald-200" />
                                                </motion.div>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    {styles.icon}
                                                    <span className={cn("text-[10px] font-bold uppercase tracking-wider opacity-80", styles.text)}>
                                                        {insight.type}
                                                    </span>
                                                </div>

                                                <p className="text-xs font-medium leading-relaxed text-foreground/90">
                                                    {insight.message}
                                                </p>

                                                {/* Actionable Script */}
                                                {insight.suggestion && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="mt-2 text-xs bg-background/40 rounded-lg p-2 border border-current/10"
                                                    >
                                                        <div className="flex gap-1.5 ">
                                                            <span className="shrink-0 text-primary font-bold text-[10px] pt-0.5">TRY:</span>
                                                            <span className="italic font-medium opacity-90">{insight.suggestion.replace(/^DIGA:\s*/i, '')}</span>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100 hover:bg-background/30 rounded-full transition-all"
                                                onClick={() => dismissCoachingInsight(insight.id)}
                                                aria-label="Dismiss insight"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>
            </CardContent>

            {/* Footer Status */}
            <div className="p-2 border-t border-border/40 bg-background/30 backdrop-blur-md text-[10px] text-center text-muted-foreground/60">
                Press <b>Alt + H</b> to hide alerts
            </div>
        </Card>
    );
}

