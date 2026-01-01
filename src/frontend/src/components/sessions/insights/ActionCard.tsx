import { useState, useCallback, memo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, User, Calendar, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type DetectedAction } from "@/store/meetingStore";
import { formatTime } from "@/utils/timeUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ActionCardProps {
    action: DetectedAction;
    onConfirm: (id: string, details?: { assigneeId?: string; dueDate?: string; notes?: string }) => void;
    index: number;
}

// Heuristic for due date suggestion
const suggestDueDate = (text: string): string => {
    const lower = text.toLowerCase();
    const today = new Date();

    if (lower.includes("tomorrow")) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }
    if (lower.includes("next week")) {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString().split('T')[0];
    }
    if (lower.includes("friday")) {
        const friday = new Date(today);
        const day = today.getDay();
        const diff = 5 - day; // 5 is Friday
        friday.setDate(today.getDate() + (diff > 0 ? diff : diff + 7));
        return friday.toISOString().split('T')[0];
    }
    return "";
};

export const ActionCard = memo(({
    action,
    onConfirm,
    index
}: ActionCardProps) => {
    const { participants } = useMeetingStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [taskTitle, setTaskTitle] = useState(action.text);
    const [taskDescription, setTaskDescription] = useState("");
    const [assigneeId, setAssigneeId] = useState<string>("");
    const [dueDate, setDueDate] = useState<string>("");

    // Auto-suggest due date when dialog opens
    useEffect(() => {
        if (isDialogOpen && !dueDate) {
            setDueDate(suggestDueDate(action.text));
        }
    }, [isDialogOpen, action.text, dueDate]);

    const handleConfirm = useCallback(() => {
        onConfirm(action.id, {
            assigneeId,
            dueDate,
            notes: taskDescription
        });
        setIsDialogOpen(false);
    }, [action.id, onConfirm, assigneeId, dueDate, taskDescription]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                <Card className={cn(
                    "border-border/50 bg-background/40 backdrop-blur-sm hover:bg-background/60 transition-all group cursor-pointer shadow-sm hover:shadow-md",
                    action.confirmed && "bg-green-500/5 border-green-500/20"
                )}>
                    <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium text-foreground/90 flex-1 leading-snug">
                                {action.text}
                            </p>
                            {action.confirmed && (
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(action.timestamp)}
                                </span>
                                {action.taskId && (
                                    <span className="flex items-center gap-1 text-primary">
                                        Tasks created
                                    </span>
                                )}
                            </div>

                            {!action.confirmed && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2 hover:bg-primary/10 hover:text-primary transition-colors"
                                    onClick={() => setIsDialogOpen(true)}
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Create Task
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px] backdrop-blur-xl bg-background/95 border-primary/20">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Create Task
                        </DialogTitle>
                        <DialogDescription>
                            Turn this insight into an actionable task.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-title">Task Title</Label>
                            <Input
                                id="task-title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                className="bg-background/50"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" /> Assign To
                                </Label>
                                <Select value={assigneeId} onValueChange={setAssigneeId}>
                                    <SelectTrigger className="bg-background/50">
                                        <SelectValue placeholder="Select assignee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {participants.length === 0 ? (
                                            <div className="p-2 text-xs text-muted-foreground">No participants found</div>
                                        ) : (
                                            participants.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarFallback className="text-[10px]">{p.name?.[0] || "?"}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{p.name || "Unknown"}</span>
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> Due Date
                                </Label>
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-background/50"
                                />
                                {dueDate && suggestDueDate(action.text) === dueDate && (
                                    <p className="text-[10px] text-green-500 flex items-center gap-1">
                                        <LightbulbIcon className="h-3 w-3" /> AI Suggested
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="task-description">Notes</Label>
                            <Textarea
                                id="task-description"
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                                placeholder="Additional context..."
                                rows={3}
                                className="bg-background/50"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirm} disabled={!taskTitle.trim()}>
                            Create Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
});

// Helper for icon
const LightbulbIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
    </svg>
);

ActionCard.displayName = "ActionCard";
