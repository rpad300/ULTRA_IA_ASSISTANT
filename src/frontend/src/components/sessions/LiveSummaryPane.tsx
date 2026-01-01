import { useLiveSummaryEngine } from "@/hooks/useLiveSummaryEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, ListTodo, Copy, ExternalLink, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatRelativeTime } from "@/utils/timeUtils";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function LiveSummaryPane() {
    const { liveSummary, scrollToBlock, copyToClipboard, isLive, isItemNew, handleValidateItem, handleEditItem, handleRejectItem } = useLiveSummaryEngine();

    if (!liveSummary) {
        return (
            <Card className="border-border h-auto min-h-[200px]">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Live Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <div className="animate-pulse bg-muted rounded-full h-12 w-12 mb-3" />
                    <p className="text-xs">Waiting for insights...</p>
                </CardContent>
            </Card>
        );
    }

    const { keyPoints, decisions, actionItems, lastUpdated } = liveSummary;

    return (
        <Card className="border-border w-full flex flex-col bg-gradient-to-br from-card to-background/50 h-auto overflow-visible">
            <CardHeader className="p-3 border-b border-border shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-10 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex h-3 w-3">
                        {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                        <span className={cn("relative inline-flex rounded-full h-3 w-3", isLive ? "bg-red-500" : "bg-gray-400")}></span>
                    </div>
                    <CardTitle className="text-sm font-semibold">Active Hub</CardTitle>
                </div>

                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
                        {lastUpdated > 0 ? formatRelativeTime(new Date(lastUpdated)) : 'Ready'}
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyToClipboard}>
                                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy Summary</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="flex flex-col gap-px bg-border/40">
                    {/* Gap-px logic for clean separations if needed, or stick to p-3 space-y-4 */}

                    <div className="p-4 space-y-6 bg-card/30">
                        {/* Key Points */}
                        <section aria-label="Key Points" className="group/section">
                            <header className="flex items-center gap-2 mb-3">
                                <div className="p-1 rounded-md bg-blue-500/10 text-blue-500">
                                    <FileText className="h-3.5 w-3.5" />
                                </div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover/section:text-blue-500 transition-colors">Key Points</h4>
                            </header>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <ul className="space-y-2">
                                    {keyPoints.map((point) => (
                                        <SummaryItem
                                            key={point.id}
                                            item={point}
                                            colorClass="bg-blue-500"
                                            onClick={() => point.lineage?.blockId && scrollToBlock(point.lineage.blockId)}
                                            isNew={isItemNew(point)}
                                        />
                                    ))}
                                    {keyPoints.length === 0 && <EmptyState label="Listening for key points..." />}
                                </ul>
                            </AnimatePresence>
                        </section>

                        {/* Decisions */}
                        <section aria-label="Decisions" className="group/section">
                            <header className="flex items-center gap-2 mb-3">
                                <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                </div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover/section:text-emerald-500 transition-colors">Decisions</h4>
                            </header>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <ul className="space-y-2">
                                    {decisions.map((decision) => (
                                        <SummaryItem
                                            key={decision.id}
                                            item={decision}
                                            colorClass="bg-emerald-500"
                                            onClick={() => decision.lineage?.blockId && scrollToBlock(decision.lineage.blockId)}
                                            isNew={isItemNew(decision)}
                                            onValidate={handleValidateItem}
                                            onEdit={handleEditItem}
                                            onReject={handleRejectItem}
                                        />
                                    ))}
                                    {decisions.length === 0 && <EmptyState label="No decisions detected yet." />}
                                </ul>
                            </AnimatePresence>
                        </section>

                        {/* Action Items */}
                        <section aria-label="Action Items" className="group/section">
                            <header className="flex items-center gap-2 mb-3">
                                <div className="p-1 rounded-md bg-violet-500/10 text-violet-500">
                                    <ListTodo className="h-3.5 w-3.5" />
                                </div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover/section:text-violet-500 transition-colors">Actions</h4>
                                <Badge variant="outline" className="ml-auto text-[10px] border-violet-500/20 text-violet-500 bg-violet-500/5">
                                    {actionItems.length} Pending
                                </Badge>
                            </header>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <ul className="space-y-2">
                                    {actionItems.map((item) => (
                                        <SummaryItem
                                            key={item.id}
                                            item={item}
                                            colorClass="bg-violet-500"
                                            onClick={() => item.lineage?.blockId && scrollToBlock(item.lineage.blockId)}
                                            isNew={isItemNew(item)}
                                            onValidate={handleValidateItem}
                                            onEdit={handleEditItem}
                                            onReject={handleRejectItem}
                                        />
                                    ))}
                                    {actionItems.length === 0 && <EmptyState label="Tracking action items..." />}
                                </ul>
                            </AnimatePresence>
                        </section>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// --- Subcomponents ---

function SummaryItem({ item, colorClass, onClick, isNew, onValidate, onEdit, onReject }: {
    item: import('@/store/slices/intelligenceSlice').LiveSummaryItem,
    colorClass: string,
    onClick?: () => void,
    isNew?: boolean,
    onValidate?: (id: string) => void,
    onEdit?: (id: string, newText: string) => void,
    onReject?: (id: string) => void
}) {
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEdit) {
            const newText = window.prompt("Edit item:", item.text);
            if (newText && newText !== item.text) {
                onEdit(item.id, newText);
            }
        }
    };

    const handleValidateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onValidate?.(item.id);
    };

    const handleRejectClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onReject?.(item.id);
    };
    return (
        <motion.li
            layout
            initial={{ opacity: 0, x: -10, height: 0 }}
            animate={{
                opacity: item.status === 'rejected' ? 0.5 : 1,
                x: 0,
                height: 'auto',
                textDecoration: item.status === 'rejected' ? 'line-through' : 'none',
                filter: item.status === 'rejected' ? 'grayscale(100%)' : 'none'
            }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            className={cn(
                "group relative pl-4 py-2 pr-2 rounded-lg border border-transparent transition-all",
                "hover:bg-muted/50 hover:border-border/50 hover:shadow-sm cursor-default",
                isNew && "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/20",
                item.status === 'confirmed' && "bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/20"
            )}
        >
            {/* Visual Indicator Line */}
            <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-colors", colorClass,
                isNew ? "opacity-100" : "opacity-40 group-hover:opacity-100",
                item.status === 'confirmed' && "bg-green-500 opacity-100"
            )} />

            {/* "New" Badge Glow */}
            {isNew && (
                <span className="absolute -right-1 -top-1 flex h-2 w-2">
                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", colorClass)}></span>
                    <span className={cn("relative inline-flex rounded-full h-2 w-2", colorClass)}></span>
                </span>
            )}

            <div className="flex items-start justify-between gap-2">
                <div onClick={onClick} className={cn("text-xs leading-relaxed text-foreground/80 group-hover:text-foreground transition-colors pr-6", onClick && "cursor-pointer")}>
                    {item.text}
                    {onClick && <ExternalLink className="inline-block md:hidden h-2.5 w-2.5 ml-1 opacity-50" />} {/* Hint for mobile */}
                </div>

                {/* Hover Actions */}
                {(onValidate || onEdit || onReject) && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 scale-90 absolute right-1 top-1 bg-card/80 backdrop-blur-sm rounded-md shadow-sm border border-border/50 p-0.5 z-10">
                        {onValidate && item.status !== 'confirmed' && item.status !== 'rejected' && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-green-500 hover:bg-green-500/10" onClick={handleValidateClick} title="Validate">
                                <Check className="h-3 w-3" />
                            </Button>
                        )}
                        {onEdit && item.status !== 'confirmed' && item.status !== 'rejected' && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-blue-500 hover:bg-blue-500/10" onClick={handleEditClick} title="Edit">
                                <Pencil className="h-3 w-3" />
                            </Button>
                        )}
                        {onReject && item.status !== 'rejected' && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-500 hover:bg-red-500/10" onClick={handleRejectClick} title="Reject">
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

        </motion.li>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <motion.li
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-muted-foreground/50 border border-dashed border-border rounded-md p-3 text-center"
        >
            {label}
        </motion.li>
    )
}
