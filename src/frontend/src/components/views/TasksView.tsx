import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, CheckCircle2, Circle, AlertCircle, MoreHorizontal, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";

type TaskStatus = "open" | "done" | "dropped";
type ViewMode = "list" | "kanban";

interface Task {
    id: string;
    description: string;
    status: TaskStatus;
    priority: string;
    due_date?: string;
    project_id?: string;
    owner_contact_id?: string;
}

export function TasksView() {
    const { selectedCompanyId, selectedProjectId, projects } = useWorkspaceStore();
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const loadTasks = async () => {
            setIsLoading(true);
            try {
                const filters: any = {};
                if (selectedCompanyId) filters.company_id = selectedCompanyId;
                if (selectedProjectId) filters.project_id = selectedProjectId;
                if (filterStatus !== "all") filters.status = filterStatus;
                
                const tasksData = await workspaceApi.getTasks(filters);
                setTasks(tasksData);
            } catch (error) {
                console.error("Failed to load tasks:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadTasks();
    }, [selectedCompanyId, selectedProjectId, filterStatus]);

    const filteredTasks = tasks.filter(task => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return task.description.toLowerCase().includes(query);
        }
        return true;
    });

    const kanbanColumns = [
        { id: "open", title: "Open", tasks: filteredTasks.filter(t => t.status === "open") },
        { id: "done", title: "Done", tasks: filteredTasks.filter(t => t.status === "done") },
        { id: "dropped", title: "Dropped", tasks: filteredTasks.filter(t => t.status === "dropped") },
    ];

    const getStatusIcon = (status: TaskStatus) => {
        switch (status) {
            case "done": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case "open": return <Circle className="h-4 w-4 text-blue-500" />;
            case "dropped": return <AlertCircle className="h-4 w-4 text-gray-500" />;
            default: return <Circle className="h-4 w-4 text-muted-foreground" />;
        }
    };
    
    const getProjectName = (projectId?: string) => {
        if (!projectId) return "—";
        const project = projects.find(p => p.id === projectId);
        return project?.name || "—";
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high": return "bg-red-500/10 text-red-500 border-red-500/20";
            case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/50 pb-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tasks</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Manage commitments and track progress across all projects.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search tasks..." 
                            className="pl-9 bg-card"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[140px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="dropped">Dropped</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex border border-border rounded-md">
                        <Button
                            variant={viewMode === "list" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-r-none"
                            onClick={() => setViewMode("list")}
                        >
                            List
                        </Button>
                        <Button
                            variant={viewMode === "kanban" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-l-none"
                            onClick={() => setViewMode("kanban")}
                        >
                            Kanban
                        </Button>
                    </div>
                    <Button className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" /> New Task
                    </Button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No tasks found</p>
                </div>
            ) : viewMode === "list" ? (
                <div className="space-y-3">
                    {filteredTasks.map(task => (
                        <Card key={task.id} className="hover:border-primary/40 transition-colors cursor-pointer">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">{getStatusIcon(task.status)}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-medium text-sm">{task.description}</h4>
                                            <Badge variant="outline" className={cn("text-[10px] border", getPriorityColor(task.priority))}>
                                                {task.priority}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span>{getProjectName(task.project_id)}</span>
                                            {task.due_date && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {kanbanColumns.map(column => (
                        <div key={column.id} className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
                                <Badge variant="secondary" className="text-xs">{column.tasks.length}</Badge>
                            </div>
                            <div className="space-y-2 min-h-[200px]">
                                {column.tasks.map(task => (
                                    <Card key={task.id} className="hover:border-primary/40 transition-colors cursor-pointer">
                                        <CardContent className="p-3">
                                            <div className="flex items-start gap-2 mb-2">
                                                {getStatusIcon(task.status)}
                                                <p className="text-sm font-medium flex-1">{task.description}</p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className={cn("text-[10px] border", getPriorityColor(task.priority))}>
                                                    {task.priority}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">{getProjectName(task.project_id)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {column.tasks.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                                        No tasks
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

