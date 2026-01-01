import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ListChecks, Filter, ChevronDown, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import { ActionCard } from "./insights/ActionCard";
import { ClarificationCard } from "./insights/ClarificationCard";
import { RiskCard } from "./insights/RiskCard";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LiveInsightsPane() {
    const {
        detectedActions,
        clarifications,
        risks,
        confirmActionAsTask
    } = useMeetingStore();

    const [showResolved, setShowResolved] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'actions' | 'risks' | 'clarifications'>('all');

    // Filter Logic
    const activeActions = useMemo(() => detectedActions.filter(a => !a.confirmed), [detectedActions]);
    const resolvedActions = useMemo(() => detectedActions.filter(a => a.confirmed), [detectedActions]);

    // Smart Grouping for Clarifications (Time-based clustering for "Conversational Bursts")
    const groupedClarifications = useMemo(() => {
        const groups: { [key: string]: typeof clarifications } = {};

        clarifications.forEach((c) => {
            // Group by minute buckets as a proxy for "Context/Topic" since we lack NLP topics here
            const timeKey = Math.floor(c.timestamp / (60 * 1000));
            if (!groups[timeKey]) groups[timeKey] = [];
            groups[timeKey].push(c);
        });

        // Convert back to array sorted by time
        return Object.entries(groups)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([_, items]) => items);
    }, [clarifications]);

    const handleBulkConfirm = useCallback(() => {
        // Confirm all currently visible active actions
        activeActions.forEach(a => confirmActionAsTask(a.id));
    }, [activeActions, confirmActionAsTask]);

    const handleActionConfirm = useCallback((id: string, details?: { assigneeId?: string; dueDate?: string; notes?: string }) => {
        confirmActionAsTask(id);
        // Here we would typically dispatch an action to create the actual Task entity with details
        console.log("Task details captured:", details);
    }, [confirmActionAsTask]);

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-background to-background/50">
            {/* Header / Stats Bar */}
            <div className="shrink-0 p-4 border-b border-border/40 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            Active Resolution Hub
                        </h2>
                        <p className="text-[10px] text-muted-foreground">
                            Real-time risk mitigation & action tracking
                        </p>
                    </div>
                    {activeActions.length > 0 && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs bg-primary/90 hover:bg-primary shadow-sm hover:shadow-md transition-all active:scale-95"
                            onClick={handleBulkConfirm}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Resolve All ({activeActions.length})
                        </Button>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                    {['all', 'actions', 'risks', 'clarifications'].map((tab) => {
                        const count = tab === 'all'
                            ? activeActions.length + risks.length + clarifications.length
                            : tab === 'actions' ? activeActions.length
                                : tab === 'risks' ? risks.length
                                    : clarifications.length;

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium rounded-md transition-all",
                                    activeTab === tab
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                )}
                            >
                                <span className="capitalize">{tab}</span>
                                {count > 0 && (
                                    <Badge variant="secondary" className="h-4 min-w-[16px] px-0.5 text-[9px] flex items-center justify-center">
                                        {count}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <ScrollArea className="flex-1 p-3">
                <div className="space-y-6">

                    {/* RISKS Section */}
                    {(activeTab === 'all' || activeTab === 'risks') && risks.length > 0 && (
                        <section className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Attention Needed
                                </h3>
                                <div className="h-px flex-1 bg-border/50" />
                            </div>
                            <AnimatePresence mode="popLayout">
                                {risks.map((risk, idx) => (
                                    <RiskCard key={risk.id} risk={risk} index={idx} />
                                ))}
                            </AnimatePresence>
                        </section>
                    )}

                    {/* ACTIONS Section */}
                    {(activeTab === 'all' || activeTab === 'actions') && (
                        <section className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Detected Actions
                                </h3>
                                <div className="h-px flex-1 bg-border/50" />
                            </div>
                            <AnimatePresence mode="popLayout">
                                {activeActions.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="text-center py-6 text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg"
                                    >
                                        <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">All clear! No pending actions.</p>
                                    </motion.div>
                                )}
                                {activeActions.map((action, idx) => (
                                    <ActionCard
                                        key={action.id}
                                        action={action}
                                        onConfirm={handleActionConfirm}
                                        index={idx}
                                    />
                                ))}
                            </AnimatePresence>
                        </section>
                    )}

                    {/* CLARIFICATIONS Section (Grouped) */}
                    {(activeTab === 'all' || activeTab === 'clarifications') && groupedClarifications.length > 0 && (
                        <section className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Clarification Opportunities
                                </h3>
                                <div className="h-px flex-1 bg-border/50" />
                            </div>
                            <div className="space-y-3">
                                {groupedClarifications.map((group, groupIdx) => (
                                    <motion.div
                                        key={groupIdx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: groupIdx * 0.1 }}
                                        className={cn(
                                            "space-y-2 rounded-xl",
                                            group.length > 1 && "bg-muted/30 p-2 border border-border/30"
                                        )}
                                    >
                                        {group.length > 1 && (
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground px-1 mb-1 flex items-center gap-2">
                                                <Filter className="h-3 w-3" />
                                                Related Topic Cluster
                                            </p>
                                        )}
                                        {group.map((clarification, idx) => (
                                            <ClarificationCard
                                                key={clarification.id}
                                                clarification={clarification}
                                                index={idx}
                                                isGrouped={group.length > 1}
                                            />
                                        ))}
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* RESOLVED Section Toggle */}
                    {(activeTab === 'all' || activeTab === 'actions') && resolvedActions.length > 0 && (
                        <div className="pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowResolved(!showResolved)}
                                className="w-full justify-between text-xs h-8 text-muted-foreground hover:text-foreground mb-2"
                            >
                                <span className="flex items-center gap-2">
                                    {showResolved ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    Resolved Items ({resolvedActions.length})
                                </span>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>

                            <AnimatePresence>
                                {showResolved && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="space-y-2 overflow-hidden pl-2 border-l-2 border-muted"
                                    >
                                        {resolvedActions.map((action, idx) => (
                                            <div key={action.id} className="opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                                                <ActionCard
                                                    action={action}
                                                    onConfirm={() => { }}
                                                    index={idx}
                                                />
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

