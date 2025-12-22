import { memo, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ListTodo, Mail, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { workspaceApi } from "@/api/client";

interface Decision {
    id: string;
    text: string;
    date: Date;
}

// Memoized Decision Card with animations
const DecisionCard = memo(({ decision, index }: { decision: Decision; index: number }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02 }}
    >
        <Card className="border-border hover:border-primary/40 transition-all">
            <CardContent className="p-3">
                <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm">{decision.text}</p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                            {decision.date.toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    </motion.div>
));

DecisionCard.displayName = "DecisionCard";

// Memoized Task Card with animations
const TaskCard = memo(({ task, index }: { task: { id: string; title: string; dueDate?: Date; priority: string }; index: number }) => {
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return "bg-red-500/10 text-red-500 border-red-500/20";
            case 'medium': return "bg-orange-500/10 text-orange-500 border-orange-500/20";
            case 'low': return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            default: return "bg-muted text-muted-foreground border-border";
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
        >
            <Card className="border-border hover:border-primary/40 transition-all">
                <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm flex-1">{task.title}</p>
                        <Badge variant="outline" className={cn("text-xs", getPriorityColor(task.priority))}>
                            {task.priority}
                        </Badge>
                    </div>
                    {task.dueDate && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Due: {task.dueDate.toLocaleDateString()}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
});

TaskCard.displayName = "TaskCard";

interface Email {
    id: string;
    subject: string;
    from: string;
    date: Date;
}

// Memoized Email Card with animations
const EmailCard = memo(({ email, index }: { email: Email; index: number }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02 }}
    >
        <Card className="border-border hover:border-primary/40 transition-all">
            <CardContent className="p-3">
                <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{email.from}</p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                            {email.date.toLocaleDateString()}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Open email"
                    >
                        <ExternalLink className="h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    </motion.div>
));

EmailCard.displayName = "EmailCard";

interface ContextPaneProps {
    threadId?: string;
    companyId?: string;
    projectId?: string;
}

export function ContextPane({ threadId, companyId, projectId }: ContextPaneProps) {
    const [openTasks, setOpenTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTasks = async () => {
            setIsLoading(true);
            try {
                const filters: any = { status: "open" };
                if (threadId) filters.thread_id = threadId;
                if (companyId) filters.company_id = companyId;
                if (projectId) filters.project_id = projectId;

                const tasks = await workspaceApi.getTasks(filters);
                setOpenTasks(tasks.slice(0, 5)); // Limit to 5
            } catch (error) {
                console.error("Failed to load tasks:", error);
                setOpenTasks([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadTasks();
    }, [threadId, companyId, projectId]);

    return (
        <div className="space-y-6">
            {/* Last Decisions - TODO: Implement decisions tracking */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <h3 className="font-semibold text-sm">Last Decisions</h3>
                </div>
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        No decisions recorded yet. Decisions will appear here once tracked.
                    </p>
                </div>
            </div>

            {/* Open Tasks */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <ListTodo className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold text-sm">Open Tasks</h3>
                    {!isLoading && (
                        <Badge variant="secondary" className="text-xs">
                            {openTasks.length}
                        </Badge>
                    )}
                </div>
                {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {openTasks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                No open tasks
                            </p>
                        ) : (
                            openTasks.map((task, index) => (
                                <TaskCard
                                    key={task.id}
                                    task={{
                                        id: task.id,
                                        title: task.description || "Untitled task",
                                        dueDate: task.due_date ? new Date(task.due_date) : undefined,
                                        priority: task.priority || "medium"
                                    }}
                                    index={index}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Recent Emails - TODO: Implement email integration */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-4 w-4 text-purple-500" />
                    <h3 className="font-semibold text-sm">Recent Emails</h3>
                </div>
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Email integration coming soon
                    </p>
                </div>
            </div>
        </div>
    );
}
