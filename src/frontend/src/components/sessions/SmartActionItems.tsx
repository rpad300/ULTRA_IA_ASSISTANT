import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CheckCircle2,
    Clock,
    Zap,
    ArrowRight,
    MoreHorizontal,
    Quote,
    Check
} from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTaskEngine } from "@/hooks/useTaskEngine";
import type { DetectedAction, ParticipantId } from "@/store/slices/intelligenceSlice";
import { toBrand } from "@/types/slices/intelligence";
import { cn } from "@/lib/utils";

// --- Components ---

const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
    const percentage = Math.round(confidence * 100);
    let colorClass = "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
    if (percentage > 85) colorClass = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    else if (percentage > 60) colorClass = "text-amber-400 border-amber-500/30 bg-amber-500/10";

    return (
        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 gap-1", colorClass)}>
            <Zap className="w-3 h-3" />
            {percentage}% AI Confidence
        </Badge>
    );
};

// --- Main Component ---

export function SmartActionItems() {
    const {
        participants
    } = useMeetingStore();

    // Use the new hook
    const {
        processedActions,
        confirmAction,
        bulkConfirm,
        navigateToContext
    } = useTaskEngine();

    const [selectedAction, setSelectedAction] = useState<DetectedAction | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form States
    const [taskTitle, setTaskTitle] = useState("");
    const [assignedTo, setAssignedTo] = useState<string>("");
    const [dueDate, setDueDate] = useState("");

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isDialogOpen && e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleCreateTask();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDialogOpen, taskTitle, assignedTo, dueDate]); // Deps needed for closure

    // A11y: Live Region
    const prevCountRef = useRef(processedActions.length);
    const [announcement, setAnnouncement] = useState("");

    useEffect(() => {
        if (processedActions.length > prevCountRef.current) {
            setAnnouncement(`New action item detected: ${processedActions[0].text}`);
        }
        prevCountRef.current = processedActions.length;
    }, [processedActions]);

    const handleOpenConfirmDialog = (action: DetectedAction) => {
        setSelectedAction(action);
        setTaskTitle(action.text);
        setAssignedTo(action.suggestedAssigneeId || "none");
        setDueDate(action.suggestedDueDate || "");
        setIsDialogOpen(true);
    };

    const handleCreateTask = () => {
        if (selectedAction && taskTitle.trim()) {
            // Confirm with modified values
            confirmAction(selectedAction.id, {
                text: taskTitle,
                suggestedAssigneeId: assignedTo !== "none" ? toBrand<ParticipantId>(assignedTo) : undefined,
                suggestedDueDate: dueDate || undefined
            });
            setIsDialogOpen(false);
            setSelectedAction(null);
            resetForm();
        }
    };

    const resetForm = () => {
        setTaskTitle("");
        setAssignedTo("");
        setDueDate("");
    };

    // --- Render Helpers ---

    const getPriorityStyles = (priority: string = 'medium') => {
        switch (priority) {
            case 'high':
                return {
                    border: 'border-rose-500/40',
                    bg: 'bg-rose-950/20',
                    indicator: 'bg-rose-500',
                    text: 'text-rose-200'
                };
            case 'low':
                return {
                    border: 'border-indigo-500/30',
                    bg: 'bg-indigo-950/20',
                    indicator: 'bg-indigo-500',
                    text: 'text-indigo-200'
                };
            default: // medium
                return {
                    border: 'border-amber-500/30',
                    bg: 'bg-amber-950/20',
                    indicator: 'bg-amber-500',
                    text: 'text-amber-200'
                };
        }
    };

    const getToolBadge = (tool: string) => {
        switch (tool) {
            case 'jira': return <Badge variant="secondary" className="bg-[#0052CC]/20 text-[#0052CC] hover:bg-[#0052CC]/30 border-[#0052CC]/40 text-[10px]">Jira</Badge>;
            case 'notion': return <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-white/20 text-[10px]">Notion</Badge>;
            case 'linear': return <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/40 text-[10px]">Linear</Badge>;
            default: return <Badge variant="secondary" className="bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 border-slate-500/40 text-[10px]">Tasks</Badge>;
        }
    };

    if (processedActions.length === 0) {
        return (
            <Card className="border-border bg-card/40 backdrop-blur-xl shadow-sm h-full flex flex-col justify-center items-center p-6 text-center space-y-3">
                <div className="p-3 bg-primary/10 rounded-full">
                    <CheckCircle2 className="h-6 w-6 text-primary/60" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold">All caught up</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Meeting output is clean. New commitments will appear here automatically.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <>
            {/* Accessible Live Region */}
            <div className="sr-only" aria-live="polite">{announcement}</div>

            <Card className="border-border bg-card/40 backdrop-blur-xl shadow-lg flex flex-col overflow-visible h-auto">
                <CardHeader className="p-4 border-b border-border/50 shrink-0 flex flex-row items-center justify-between pb-3">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Smart Action Items
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {processedActions.length} pending commitments
                        </CardDescription>
                    </div>
                    {processedActions.length > 1 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-primary hover:text-primary/80 hover:bg-primary/10"
                            onClick={() => bulkConfirm(processedActions.map(a => a.id))}
                        >
                            <Check className="w-3 h-3 mr-1" />
                            Confirm All
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="space-y-3 h-auto overflow-visible p-4 flex-none">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {processedActions.map((action) => {
                            const styles = getPriorityStyles(action.priority);
                            const assignedParticipant = participants.find(p => p.id === action.suggestedAssigneeId);

                            return (
                                <motion.div
                                    key={action.id}
                                    layout
                                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    className={cn(
                                        "group relative rounded-xl border p-3.5 transition-all hover:shadow-md",
                                        "bg-gradient-to-br from-card/80 to-card/40",
                                        styles.border,
                                        // Priority tint on background
                                        action.priority === 'high' && "bg-gradient-to-br from-rose-950/10 to-card/40"
                                    )}
                                >
                                    {/* Priority Indicator Line */}
                                    <div className={cn("absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full", styles.indicator)} />

                                    <div className="pl-2 space-y-3">
                                        {/* Header: Title & Badges */}
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="space-y-1.5 flex-1">
                                                <p className={cn("text-sm font-medium leading-snug", styles.text)}>
                                                    {action.text}
                                                </p>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {action.confidence && (
                                                        <ConfidenceBadge confidence={action.confidence} />
                                                    )}
                                                    {action.relatedTool && getToolBadge(action.relatedTool)}
                                                </div>
                                            </div>

                                            {/* Fast Action Buttons */}
                                            <div className="flex flex-col gap-1 items-end shrink-0">
                                                {(action.confidence || 0) > 0.9 ? (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 rounded-full hover:bg-emerald-500/20 text-emerald-400"
                                                        onClick={() => confirmAction(action.id)}
                                                        title="One-Tap Confirm"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleOpenConfirmDialog(action)}
                                                    >
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata Row */}
                                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                                            <div className="flex items-center gap-3">
                                                {/* Assignee */}
                                                <div className="flex items-center gap-1.5">
                                                    {assignedParticipant ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50 border border-secondary">
                                                            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-[8px] text-white font-bold ring-2 ring-background">
                                                                {assignedParticipant.name?.charAt(0) || '?'}
                                                            </div>
                                                            <span className="text-secondary-foreground">{assignedParticipant.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/60 italic">Unassigned</span>
                                                    )}
                                                </div>

                                                {/* Due Date */}
                                                {action.suggestedDueDate && (
                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/30">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{new Date(action.suggestedDueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Context Link */}
                                            {action.lineage?.blockId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 px-2 text-[10px] gap-1 hover:text-primary"
                                                    onClick={() => action.lineage?.blockId && navigateToContext(action.lineage.blockId)}
                                                >
                                                    <Quote className="w-2.5 h-2.5" />
                                                    Context
                                                </Button>
                                            )}
                                        </div>


                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </CardContent>
            </Card>

            {/* Smart Confirmation Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[450px] backdrop-blur-3xl bg-card/95 border-border/60 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-400" />
                            Review Task Details
                        </DialogTitle>
                        <DialogDescription>
                            AI detected this commitment. Verify details before syncing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                        {/* Title Input */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
                            <Input
                                id="title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                className="bg-secondary/50 border-transparent focus:border-primary font-medium"
                                placeholder="Task description..."
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Assignee Select */}
                            <div className="space-y-2">
                                <Label htmlFor="assigned" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignee</Label>
                                <Select value={assignedTo} onValueChange={setAssignedTo}>
                                    <SelectTrigger id="assigned" className="bg-secondary/50 border-transparent">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Unassigned</SelectItem>
                                        {participants.map((p) => (
                                            <SelectItem key={p.id} value={p.speakerId || p.id}>
                                                {p.name || `User ${p.speakerId}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Due Date Input */}
                            <div className="space-y-2">
                                <Label htmlFor="dueDate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</Label>
                                <Input
                                    id="dueDate"
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-secondary/50 border-transparent"
                                />
                            </div>
                        </div>

                        {/* AI Insight Box */}
                        {/* Snippet box removed */}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateTask}
                            disabled={!taskTitle.trim()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        >
                            Confirm & Sync <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground self-center hidden sm:inline-block ml-4">
                            Ctrl + Enter to confirm
                        </span>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Default export if needed, though originally named export
export default SmartActionItems;
