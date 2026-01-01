import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Calendar, AlertCircle, Loader2, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useEffect, useState } from "react";
import { ThreadsList } from "./ThreadsList";
import { workspaceApi } from "@/api/client";
import { ThreadForm } from "@/components/threads/ThreadForm";

export function ProjectCockpitView() {
    const { companyId, projectId } = useParams();
    const navigate = useNavigate();
    const { fetchProject, fetchThreads, selectCompany, selectProject } = useWorkspaceStore();
    const [project, setProject] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [isThreadFormOpen, setIsThreadFormOpen] = useState(false);

    useEffect(() => {
        if (companyId) selectCompany(companyId);
        if (projectId) {
            selectProject(projectId);
            fetchProject(projectId).then(p => setProject(p));
            fetchThreads(projectId);
        }
    }, [companyId, projectId, fetchProject, fetchThreads, selectCompany, selectProject]);

    const [timeline, setTimeline] = useState<any[]>([]);
    const [openLoops, setOpenLoops] = useState<any[]>([]);
    const [keyPeople, setKeyPeople] = useState<any[]>([]);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!projectId) return;
            try {
                // Load sessions for timeline
                const sessionsRes = await workspaceApi.get(`/sessions?thread_id=${projectId}`);
                const sessions = sessionsRes.data || [];
                const timelineData = sessions.slice(0, 5).map((s: any) => ({
                    type: "meeting",
                    title: s.type || "Meeting",
                    date: s.started_at || s.created_at,
                    status: s.ended_at ? "completed" : "upcoming"
                }));
                setTimeline(timelineData);

                // Load urgent tasks as open loops
                const tasksRes = await workspaceApi.getTasks({ project_id: projectId, status: "open" });
                const urgentTasks = tasksRes.filter((t: any) => t.priority === "high").slice(0, 5);
                setOpenLoops(urgentTasks.map((t: any) => ({
                    text: t.description,
                    priority: t.priority,
                    assignee: "—"
                })));

                // Load contacts as key people (simplified)
                try {
                    const contactsRes = await workspaceApi.getContacts();
                    // getContacts already returns an array (extracts items from PaginatedResponse)
                    setKeyPeople(contactsRes.slice(0, 5).map((c: any) => ({
                        name: c.name,
                        role: c.role || "—",
                        meetings: 0 // TODO: Calculate from sessions
                    })));
                } catch (contactsError) {
                    // If contacts fail to load, just set empty array
                    console.warn("Failed to load contacts:", contactsError);
                    setKeyPeople([]);
                }
            } catch (error) {
                console.error("Failed to load project data:", error);
            }
        };

        loadProjectData();
    }, [projectId]);

    const handleNewThread = () => {
        setIsThreadFormOpen(true);
    };

    const handleThreadCreated = async (newThreadId?: string) => {
        if (projectId) {
            await fetchThreads(projectId);
            // Navigate to the new thread if ID is provided
            if (newThreadId) {
                navigate(`/threads/${newThreadId}`);
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/companies/${companyId}/projects`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">{project?.name || "Project"}</h1>
                        <p className="text-muted-foreground mt-2 text-sm">{project?.description || "Project overview"}</p>
                    </div>
                </div>
                <Button onClick={handleNewThread}>
                    <Plus className="mr-2 h-4 w-4" /> New Thread
                </Button>
            </div>

            {/* Simple Tab Navigation without Radix Tabs to avoid hook issues */}
            <div className="border-b border-border">
                <div className="flex gap-1">
                    {[
                        { id: "overview", label: "Overview" },
                        { id: "threads", label: "Threads" },
                        { id: "tasks", label: "Tasks" },
                        { id: "docs", label: "Docs" },
                        { id: "insights", label: "Insights" },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                                ${activeTab === tab.id
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-6">
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* Timeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Timeline</CardTitle>
                                <CardDescription>Key milestones and meetings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {timeline.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        No timeline events
                                    </div>
                                ) : (
                                    timeline.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-3 rounded-lg border border-border">
                                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs">{new Date(item.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-sm">{item.title}</h4>
                                                    <Badge variant={item.status === "completed" ? "secondary" : "outline"}>
                                                        {item.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">{item.type}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Open Loops */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Open Loops</CardTitle>
                                    <CardDescription>Critical items requiring attention</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {openLoops.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            No open loops
                                        </div>
                                    ) : (
                                        openLoops.map((loop, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{loop.text}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {loop.priority}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">{loop.assignee}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            {/* Key People */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Key People</CardTitle>
                                    <CardDescription>Most active stakeholders</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {keyPeople.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            No contacts found
                                        </div>
                                    ) : (
                                        keyPeople.map((person, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                                    {person.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{person.name}</p>
                                                    <p className="text-xs text-muted-foreground">{person.role}</p>
                                                </div>
                                                <Badge variant="secondary" className="text-xs">
                                                    {person.meetings} meetings
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === "threads" && (
                    <ThreadsList projectId={projectId} companyId={companyId} />
                )}

                {activeTab === "tasks" && (
                    <div className="text-center py-12 text-muted-foreground">
                        Tasks list will be shown here
                    </div>
                )}

                {activeTab === "docs" && (
                    <div className="text-center py-12 text-muted-foreground">
                        Documents will be shown here
                    </div>
                )}

                {activeTab === "insights" && (
                    <ProjectInsightsTab projectId={projectId} />
                )}
            </div>

            {/* Thread Form Dialog */}
            {projectId && companyId && (
                <ThreadForm
                    open={isThreadFormOpen}
                    onOpenChange={setIsThreadFormOpen}
                    projectId={projectId}
                    companyId={companyId}
                    onSuccess={handleThreadCreated}
                />
            )}
        </div>
    );
}

// Project Insights Tab Component
function ProjectInsightsTab({ projectId }: { projectId?: string }) {
    const [insights, setInsights] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadInsights = async () => {
            if (!projectId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const res = await workspaceApi.get(`/analytics/projects/${projectId}/insights`);
                setInsights(res.data.insights || []);
            } catch (error) {
                console.error("Failed to load project insights:", error);
                setInsights([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadInsights();
    }, [projectId]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Project Insights</CardTitle>
                    <CardDescription>AI-generated analysis</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getIcon = (type: string) => {
        switch (type) {
            case "trend":
                return <TrendingUp className="h-4 w-4" />;
            case "risk":
                return <AlertTriangle className="h-4 w-4" />;
            default:
                return <Info className="h-4 w-4" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case "trend":
                return "bg-blue-500/10 border-blue-500/20";
            case "risk":
                return "bg-yellow-500/10 border-yellow-500/20";
            default:
                return "bg-muted/50 border-border";
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Project Insights</CardTitle>
                <CardDescription>AI-generated analysis based on real data</CardDescription>
            </CardHeader>
            <CardContent>
                {insights.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No insights available yet. Insights will be generated as project data accumulates.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {insights.map((insight, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg border ${getBgColor(insight.type)}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {getIcon(insight.type)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium mb-1">{insight.title}</p>
                                        <p className="text-sm">{insight.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
