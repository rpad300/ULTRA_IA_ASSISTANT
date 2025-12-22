import { useState, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Lightbulb, AlertTriangle, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type DetectedAction, type Clarification, type Risk } from "@/store/meetingStore";
import { formatTime } from "@/utils/timeUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";

// Memoized Action Card with animations
const ActionCard = memo(({
    action,
    onConfirm,
    index
}: {
    action: DetectedAction;
    onConfirm: (id: string) => void;
    index: number;
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [taskTitle, setTaskTitle] = useState(action.text);
    const [taskDescription, setTaskDescription] = useState("");

    const handleConfirm = useCallback(() => {
        onConfirm(action.id);
        setIsDialogOpen(false);
        // TODO: Create task in backend
    }, [action.id, onConfirm]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Card className={cn(
                    "border-border hover:border-primary/40 transition-all group cursor-pointer",
                    action.confirmed && "bg-green-500/5 border-green-500/20"
                )}>
                    <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm flex-1">{action.text}</p>
                            {action.confirmed && (
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                {formatTime(action.timestamp)}
                            </span>
                            {!action.confirmed && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setIsDialogOpen(true)}
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Confirm as task
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create Task from Action</DialogTitle>
                        <DialogDescription>
                            Create a task based on the detected action.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-title">Task Title *</Label>
                            <Input
                                id="task-title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder="Task title"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-description">Description</Label>
                            <Textarea
                                id="task-description"
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                                placeholder="Additional details..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
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

ActionCard.displayName = "ActionCard";

// Memoized Clarification Card with animations
const ClarificationCard = memo(({ clarification, index }: { clarification: Clarification; index: number }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02 }}
    >
        <Card className="border-border hover:border-primary/40 transition-all">
            <CardContent className="p-3">
                <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm">{clarification.suggestion}</p>
                        {clarification.context && (
                            <p className="text-xs text-muted-foreground mt-1">{clarification.context}</p>
                        )}
                        <span className="text-xs text-muted-foreground mt-1 block">
                            {formatTime(clarification.timestamp)}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    </motion.div>
));

ClarificationCard.displayName = "ClarificationCard";

// Memoized Risk Card with animations
const RiskCard = memo(({ risk, index }: { risk: Risk; index: number }) => {
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'high': return "bg-red-500/10 text-red-500 border-red-500/20";
            case 'medium': return "bg-orange-500/10 text-orange-500 border-orange-500/20";
            case 'low': return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            default: return "bg-muted text-muted-foreground border-border";
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
        >
            <Card className={cn(
                "border-border hover:border-primary/40 transition-all",
                risk.severity === 'high' && "border-red-500/40 bg-red-500/5"
            )}>
                <CardContent className="p-3">
                    <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            risk.severity === 'high' && "text-red-500",
                            risk.severity === 'medium' && "text-orange-500",
                            risk.severity === 'low' && "text-yellow-500"
                        )} />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cn("text-xs", getSeverityColor(risk.severity))}>
                                    {risk.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {formatTime(risk.timestamp)}
                                </span>
                            </div>
                            <p className="text-sm">{risk.summary}</p>
                            {risk.contextId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-6 mt-2"
                                    onClick={() => {
                                        // TODO: Open context panel
                                        console.log("View context:", risk.contextId);
                                    }}
                                >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View context
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

RiskCard.displayName = "RiskCard";

export function LiveInsightsPane() {
    const { detectedActions, clarifications, risks, confirmActionAsTask } = useMeetingStore();

    return (
        <div className="flex flex-col p-3 space-y-4">
            {/* Detected Actions */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                    <h3 className="font-semibold text-xs">Detected Actions</h3>
                    {detectedActions.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                            {detectedActions.length}
                        </Badge>
                    )}
                </div>
                <AnimatePresence mode="popLayout">
                    <div className="space-y-2">
                        {detectedActions.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                No actions detected yet
                            </p>
                        ) : (
                            detectedActions.map((action, index) => (
                                <ActionCard
                                    key={action.id}
                                    action={action}
                                    onConfirm={confirmActionAsTask}
                                    index={index}
                                />
                            ))
                        )}
                    </div>
                </AnimatePresence>
            </div>

            {/* Clarifications */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                    <h3 className="font-semibold text-xs">Clarifications</h3>
                    {clarifications.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                            {clarifications.length}
                        </Badge>
                    )}
                </div>
                <AnimatePresence mode="popLayout">
                    <div className="space-y-2">
                        {clarifications.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                No clarifications needed yet
                            </p>
                        ) : (
                            clarifications.map((clarification, index) => (
                                <ClarificationCard
                                    key={clarification.id}
                                    clarification={clarification}
                                    index={index}
                                />
                            ))
                        )}
                    </div>
                </AnimatePresence>
            </div>

            {/* Risks & Inconsistencies */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    <h3 className="font-semibold text-xs">Risks & Inconsistencies</h3>
                    {risks.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                            {risks.length}
                        </Badge>
                    )}
                </div>
                <AnimatePresence mode="popLayout">
                    <div className="space-y-2">
                        {risks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                No risks detected yet
                            </p>
                        ) : (
                            risks.map((risk, index) => (
                                <RiskCard key={risk.id} risk={risk} index={index} />
                            ))
                        )}
                    </div>
                </AnimatePresence>
            </div>
        </div>
    );
}
