import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, MessageSquare, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { workspaceApi } from "@/api/client";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function AnalyticsView() {
    const { selectedCompanyId, selectedProjectId } = useWorkspaceStore();
    const [meetingsData, setMeetingsData] = useState<any>(null);
    const [tasksData, setTasksData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const loadAnalytics = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedCompanyId) params.append('company_id', selectedCompanyId);
                if (selectedProjectId) params.append('project_id', selectedProjectId);
                params.append('days', '30');
                
                // Load meetings insights
                const meetingsRes = await workspaceApi.get(`/analytics/insights/meetings?${params}`);
                setMeetingsData(meetingsRes.data);
                
                // Load tasks insights
                const tasksRes = await workspaceApi.get(`/analytics/insights/tasks?${params}`);
                setTasksData(tasksRes.data);
            } catch (error) {
                console.error("Failed to load analytics:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadAnalytics();
    }, [selectedCompanyId, selectedProjectId]);
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    const stats = {
        totalMeetings: meetingsData?.total_meetings || 0,
        totalHours: meetingsData?.total_hours || 0,
        tasksCreated: tasksData?.total_tasks || 0,
        tasksCompleted: tasksData?.completed || 0,
        completionRate: tasksData ? Math.round(tasksData.completion_rate * 100) : 0,
    };
    
    const trends = [
        { 
            label: "Meetings this week", 
            value: meetingsData?.weekly_stats?.this_week || 0, 
            positive: meetingsData?.weekly_stats?.trend === 'up' 
        },
        { 
            label: "Task completion", 
            value: `${stats.completionRate}%`, 
            positive: stats.completionRate >= 80 
        },
        { 
            label: "Talk time ratio", 
            value: "N/A", 
            positive: null 
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Analytics</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Insights into your meeting patterns and productivity.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalMeetings}</div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hours in Meetings</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalHours}h</div>
                        <p className="text-xs text-muted-foreground mt-1">Average 1.5h/day</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.tasksCompleted}/{stats.tasksCreated}</div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.completionRate}% completion rate</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Decisions</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{meetingsData?.decision_rate ? Math.round((1 - meetingsData.decision_rate) * meetingsData.total_meetings) : 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Need follow-up</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Trends</CardTitle>
                        <CardDescription>Performance indicators over time</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {trends.map((trend, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{trend.label}</span>
                                <div className="flex items-center gap-2">
                                    {trend.positive !== null && (
                                        <TrendingUp className={trend.positive ? "h-4 w-4 text-green-500" : "h-4 w-4 text-red-500"} />
                                    )}
                                    <span className="text-sm font-medium">{typeof trend.value === 'number' ? trend.value : trend.value}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recommendations</CardTitle>
                        <CardDescription>AI-powered insights</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {tasksData && tasksData.overdue > 0 && (
                            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <p className="text-sm">
                                    <strong>Alert:</strong> {tasksData.overdue} task{tasksData.overdue > 1 ? 's' : ''} {tasksData.overdue > 1 ? 'are' : 'is'} overdue and need attention.
                                </p>
                            </div>
                        )}
                        {meetingsData && meetingsData.decision_rate < 0.7 && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                <p className="text-sm">
                                    <strong>Tip:</strong> Decision rate is {Math.round(meetingsData.decision_rate * 100)}%. Try to validate "who does what by when" at the end of meetings.
                                </p>
                            </div>
                        )}
                        {(!tasksData || tasksData.overdue === 0) && (!meetingsData || meetingsData.decision_rate >= 0.7) && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                <p className="text-sm text-muted-foreground">
                                    No specific recommendations at this time.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

