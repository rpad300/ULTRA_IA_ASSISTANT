import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, AlertCircle, Users, MessageSquare, ArrowRight, Plus, Mic, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/api/client";
import { ThreadForm } from "@/components/threads/ThreadForm";

export function DashboardView() {
    const navigate = useNavigate();
    const { companies, selectedCompanyId, selectedProjectId } = useWorkspaceStore();
    const [timeOfDay, setTimeOfDay] = useState("");
    const [stats, setStats] = useState<any>(null);
    const [todayMeetings, setTodayMeetings] = useState<any[]>([]);
    const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isThreadFormOpen, setIsThreadFormOpen] = useState(false);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setTimeOfDay("Good morning");
        else if (hour < 18) setTimeOfDay("Good afternoon");
        else setTimeOfDay("Good evening");
    }, []);

    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedCompanyId) params.append('company_id', selectedCompanyId);
                if (selectedProjectId) params.append('project_id', selectedProjectId);

                // Load stats
                const statsRes = await workspaceApi.get(`/analytics/dashboard/stats?${params}`);
                setStats(statsRes.data);

                // Load today's schedule
                const scheduleRes = await workspaceApi.get(`/analytics/dashboard/today-schedule?${params}`);
                setTodayMeetings(scheduleRes.data);

                // Load urgent tasks
                const tasksRes = await workspaceApi.get(`/analytics/dashboard/urgent-tasks?${params}`);
                setUrgentTasks(tasksRes.data);

                // Load recent activity
                const activityRes = await workspaceApi.get(`/analytics/dashboard/recent-activity?${params}`);
                setRecentActivity(activityRes.data);
            } catch (error) {
                console.error("Failed to load dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboardData();
    }, [selectedCompanyId, selectedProjectId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full animate-in fade-in duration-500">
            {/* Welcome Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                        {timeOfDay}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {selectedCompanyId ? `Working with ${companies.find(c => c.id === selectedCompanyId)?.name || "selected company"}` : "Select a company to get started"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate("/companies")}>
                        <Users className="mr-2 h-4 w-4" /> Companies
                    </Button>
                    <Button onClick={() => {
                        if (selectedProjectId) {
                            setIsThreadFormOpen(true);
                        } else if (selectedCompanyId) {
                            navigate(`/companies/${selectedCompanyId}/projects`);
                        } else {
                            navigate("/companies");
                        }
                    }}>
                        <Mic className="mr-2 h-4 w-4" /> Start Meeting
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => navigate("/")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Meetings This Week</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.meetings_this_week || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">This week</p>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => navigate("/tasks")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.tasks_completed || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">This week</p>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/threads`)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Threads</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.active_threads || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">In progress</p>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Decisions</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.pending_decisions || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Need follow-up</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Today's Schedule */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Today's Schedule</CardTitle>
                                    <CardDescription>Upcoming meetings and deadlines</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>
                                    View All <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {todayMeetings.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No meetings scheduled for today
                                </div>
                            ) : (
                                todayMeetings.map(meeting => (
                                    <div key={meeting.id} className="flex items-start gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                                        <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs font-medium">{meeting.time}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-sm">{meeting.title}</h4>
                                                <Badge variant="secondary" className="text-[10px]">{meeting.type}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{meeting.project}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Urgent Tasks */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Urgent Tasks</CardTitle>
                                    <CardDescription>High priority items requiring attention</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
                                    View All <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {urgentTasks.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No urgent tasks
                                </div>
                            ) : (
                                urgentTasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                                        <div className={cn(
                                            "h-2 w-2 rounded-full",
                                            task.priority === "high" ? "bg-red-500" : "bg-yellow-500"
                                        )} />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{task.text}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-muted-foreground">{task.project}</span>
                                                <span className="text-xs text-muted-foreground">•</span>
                                                <span className="text-xs text-muted-foreground">Due {task.due}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Activity & Quick Actions */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {recentActivity.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No recent activity
                                </div>
                            ) : (
                                recentActivity.map((activity, idx) => (
                                    <div key={idx} className="flex items-start gap-3 text-sm">
                                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-foreground truncate">{activity.text}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-muted-foreground">{activity.project}</span>
                                                <span className="text-xs text-muted-foreground">•</span>
                                                <span className="text-xs text-muted-foreground">{activity.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/companies")}>
                                <Plus className="mr-2 h-4 w-4" /> New Company
                            </Button>
                            <Button variant="outline" className="w-full justify-start" onClick={() => selectedCompanyId && navigate(`/companies/${selectedCompanyId}/projects`)}>
                                <Plus className="mr-2 h-4 w-4" /> New Project
                            </Button>
                            <Button variant="outline" className="w-full justify-start" onClick={() => {
                                if (selectedProjectId) {
                                    setIsThreadFormOpen(true);
                                }
                            }}>
                                <Plus className="mr-2 h-4 w-4" /> New Thread
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Thread Form Dialog */}
            {selectedProjectId && selectedCompanyId && (
                <ThreadForm
                    open={isThreadFormOpen}
                    onOpenChange={setIsThreadFormOpen}
                    projectId={selectedProjectId}
                    companyId={selectedCompanyId}
                    onSuccess={(threadId) => {
                        if (threadId) {
                            navigate(`/threads/${threadId}`);
                        }
                    }}
                />
            )}
        </div>
    );
}

