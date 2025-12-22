import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, ListTodo, RefreshCw } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import { formatRelativeTime } from "@/utils/timeUtils";

export function LiveSummaryPane() {
    const { liveSummary } = useMeetingStore();

    useEffect(() => {
        const store = useMeetingStore.getState();
        store.updateLiveSummary(); // Initial update

        const interval = setInterval(() => {
            useMeetingStore.getState().updateLiveSummary();
        }, 30000); // Optimized: Update every 30 seconds (was 15)

        return () => clearInterval(interval);
    }, []); // Only run once on mount

    if (!liveSummary) {
        return (
            <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Live Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Summary will appear as the meeting progresses
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border h-full flex flex-col overflow-hidden">
            <CardHeader className="p-3 border-b border-border shrink-0 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                        Live Summary
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                            Live
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(new Date(liveSummary.lastUpdated))}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3 flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--muted) var(--background)' }} aria-label="Live Summary Content">
                {/* Key Points */}
                <section aria-label="Key Points">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-3 w-3 text-blue-500" aria-hidden="true" />
                        <h4 className="text-xs font-semibold">Key Points</h4>
                    </div>
                    <AnimatePresence mode="popLayout">
                        <ul className="space-y-1">
                            {liveSummary.keyPoints.map((point, index) => (
                                <motion.li
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="text-xs text-muted-foreground pl-4 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-primary"
                                >
                                    {point}
                                </motion.li>
                            ))}
                        </ul>
                    </AnimatePresence>
                </section>

                {/* Decisions */}
                {liveSummary.decisions.length > 0 && (
                    <section aria-label="Decisions">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500" aria-hidden="true" />
                            <h4 className="text-xs font-semibold">Decisions</h4>
                        </div>
                        <AnimatePresence mode="popLayout">
                            <ul className="space-y-1">
                                {liveSummary.decisions.map((decision, index) => (
                                    <motion.li
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="text-xs text-muted-foreground pl-4 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-green-500"
                                    >
                                        {decision}
                                    </motion.li>
                                ))}
                            </ul>
                        </AnimatePresence>
                    </section>
                )}

                {/* Action Items */}
                {liveSummary.actionItems.length > 0 && (
                    <section aria-label="Action Items">
                        <div className="flex items-center gap-2 mb-2">
                            <ListTodo className="h-3 w-3 text-purple-500" aria-hidden="true" />
                            <h4 className="text-xs font-semibold">Action Items</h4>
                            <Badge variant="secondary" className="text-xs" aria-label={`${liveSummary.actionItems.length} action items`}>
                                {liveSummary.actionItems.length}
                            </Badge>
                        </div>
                        <AnimatePresence mode="popLayout">
                            <ul className="space-y-1">
                                {liveSummary.actionItems.map((item, index) => (
                                    <motion.li
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="text-xs text-muted-foreground pl-4 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-purple-500"
                                    >
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </AnimatePresence>
                    </section>
                )}
            </CardContent>
        </Card>
    );
}

