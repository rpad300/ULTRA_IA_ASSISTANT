import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    TrendingUp, 
    CheckCircle2, 
    Users, 
    Building2,
    Calendar,
    Target,
    Lightbulb,
    ArrowUp,
    ArrowDown,
    Minus,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceApi } from "@/api/client";

export function InsightsView() {
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const { companies } = useWorkspaceStore();
    const [meetingsData, setMeetingsData] = useState<any>(null);
    const [taskData, setTaskData] = useState<any>(null);
    const [coachingData, setCoachingData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Calculate days based on timeRange
    const daysMap = {
        week: 7,
        month: 30,
        quarter: 90,
        year: 365
    };
    
    useEffect(() => {
        const loadInsights = async () => {
            setIsLoading(true);
            try {
                const days = daysMap[timeRange];
                const companyId = selectedCompany !== 'all' ? selectedCompany : undefined;
                
                // Load meetings insights
                const meetingsParams = new URLSearchParams();
                if (companyId) meetingsParams.append('company_id', companyId);
                meetingsParams.append('days', days.toString());
                const meetingsRes = await workspaceApi.get(`/analytics/insights/meetings?${meetingsParams}`);
                setMeetingsData(meetingsRes.data);
                
                // Load tasks insights
                const tasksParams = new URLSearchParams();
                if (companyId) tasksParams.append('company_id', companyId);
                tasksParams.append('days', days.toString());
                const tasksRes = await workspaceApi.get(`/analytics/insights/tasks?${tasksParams}`);
                setTaskData(tasksRes.data);
                
                // Load coaching insights
                const coachingParams = new URLSearchParams();
                if (companyId) coachingParams.append('company_id', companyId);
                const coachingRes = await workspaceApi.get(`/analytics/insights/coaching?${coachingParams}`);
                setCoachingData(coachingRes.data);
            } catch (error) {
                console.error("Failed to load insights:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadInsights();
    }, [timeRange, selectedCompany]);
    
    // Transform API data to match component expectations
    const filteredData = useMemo(() => {
        if (isLoading || !meetingsData || !taskData || !coachingData) {
            return {
                meetings: { byCompany: [], weeklyStats: { thisWeek: 0, lastWeek: 0, trend: 'neutral' as const }, decisionRate: 0, totalMeetings: 0 },
                talkTime: { myPercentage: 0, othersPercentage: 100, averagePerMeeting: 0, trend: 'neutral' as const },
                tasks: { completionRate: 0, averageTimeToClose: 0, totalTasks: 0, completedOnTime: 0, overdue: 0, pending: 0 },
                coaching: { currentProfile: "unknown", insights: { BA: { insights: [], suggestions: [] }, PO: { insights: [], suggestions: [] }, PM: { insights: [], suggestions: [] } } }
            };
        }
        
        return {
            meetings: meetingsData,
            talkTime: { myPercentage: 0, othersPercentage: 100, averagePerMeeting: 0, trend: 'neutral' as const }, // TODO: Implement talk time analytics
            tasks: taskData,
            coaching: coachingData
        };
    }, [meetingsData, taskData, coachingData, isLoading]);
    
    const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
        switch (trend) {
            case 'up':
                return <ArrowUp className="h-4 w-4 text-green-500" />;
            case 'down':
                return <ArrowDown className="h-4 w-4 text-red-500" />;
            default:
                return <Minus className="h-4 w-4 text-muted-foreground" />;
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Personal Insights</h1>
                    <p className="text-muted-foreground mt-1">
                        Analytics e coaching personalizado para melhorar o seu desempenho
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Last Week</SelectItem>
                            <SelectItem value="month">Last Month</SelectItem>
                            <SelectItem value="quarter">Last Quarter</SelectItem>
                            <SelectItem value="year">Last Year</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Companies</SelectItem>
                            {companies.map(company => (
                                <SelectItem key={company.id} value={company.id}>
                                    {company.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {/* Main Content */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="meetings">My Meetings</TabsTrigger>
                    <TabsTrigger value="talktime">Talk Time</TabsTrigger>
                    <TabsTrigger value="tasks">Task Discipline</TabsTrigger>
                    <TabsTrigger value="coaching">Coaching</TabsTrigger>
                </TabsList>
                
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{filteredData.meetings.totalMeetings}</div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    {getTrendIcon(filteredData.meetings.weeklyStats.trend)}
                                    {filteredData.meetings.weeklyStats.thisWeek} this week
                                </p>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Decision Rate</CardTitle>
                                <Target className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {Math.round(filteredData.meetings.decisionRate * 100)}%
                                </div>
                                <Progress 
                                    value={filteredData.meetings.decisionRate * 100} 
                                    className="mt-2"
                                />
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Talk Time</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {filteredData.talkTime.myPercentage}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {filteredData.talkTime.averagePerMeeting} min/meeting
                                </p>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {Math.round(filteredData.tasks.completionRate * 100)}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {filteredData.tasks.completedOnTime}/{filteredData.tasks.totalTasks} on time
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                
                {/* My Meetings Tab */}
                <TabsContent value="meetings" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Time in Meetings by Company</CardTitle>
                                <CardDescription>Hours spent in meetings per company</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {filteredData.meetings.byCompany.map((item: any, idx: number) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{item.company}</span>
                                                </div>
                                                <Badge variant="outline">{item.meetings} meetings</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Progress value={(item.hours / 20) * 100} className="flex-1" />
                                                <span className="text-sm text-muted-foreground min-w-[60px] text-right">
                                                    {item.hours}h
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Meeting Statistics</CardTitle>
                                <CardDescription>Key metrics for your meetings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Meetings this week</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">
                                                {filteredData.meetings.weeklyStats.thisWeek}
                                            </span>
                                            {getTrendIcon(filteredData.meetings.weeklyStats.trend)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Last week</span>
                                        <span className="font-semibold">
                                            {filteredData.meetings.weeklyStats.lastWeek}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Decision Rate</span>
                                        <span className="text-sm font-semibold">
                                            {Math.round(filteredData.meetings.decisionRate * 100)}%
                                        </span>
                                    </div>
                                    <Progress value={filteredData.meetings.decisionRate * 100} />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {Math.round(filteredData.meetings.decisionRate * filteredData.meetings.totalMeetings)} 
                                        {' '}meetings with decisions recorded
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                
                {/* Talk Time Tab */}
                <TabsContent value="talktime" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Speaking Time Distribution</CardTitle>
                                <CardDescription>Your talk time vs others</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-primary" />
                                                <span className="text-sm font-medium">You</span>
                                            </div>
                                            <span className="text-sm font-semibold">
                                                {filteredData.talkTime.myPercentage}%
                                            </span>
                                        </div>
                                        <Progress 
                                            value={filteredData.talkTime.myPercentage} 
                                            className="h-3"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium">Others</span>
                                            </div>
                                            <span className="text-sm font-semibold">
                                                {filteredData.talkTime.othersPercentage}%
                                            </span>
                                        </div>
                                        <Progress 
                                            value={filteredData.talkTime.othersPercentage} 
                                            className="h-3"
                                        />
                                    </div>
                                    
                                    <div className="pt-4 border-t border-border">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Average per meeting</span>
                                            <span className="text-sm font-semibold">
                                                {filteredData.talkTime.averagePerMeeting} minutes
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Talk Time Insights</CardTitle>
                                <CardDescription>Analysis of your speaking patterns</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm font-medium">Balanced Participation</p>
                                        <p className="text-xs text-muted-foreground">
                                            Your talk time is well-distributed across meetings
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Trend</span>
                                        <div className="flex items-center gap-1">
                                            {getTrendIcon(filteredData.talkTime.trend)}
                                            <span className="text-xs">
                                                {(filteredData.talkTime.trend as string) === 'up' ? 'Increasing' : (filteredData.talkTime.trend as string) === 'down' ? 'Decreasing' : 'Stable'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                
                {/* Task Discipline Tab */}
                <TabsContent value="tasks" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Task Completion Rate</CardTitle>
                                <CardDescription>On-time completion statistics</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className="text-4xl font-bold mb-2">
                                            {Math.round(filteredData.tasks.completionRate * 100)}%
                                        </div>
                                        <Progress 
                                            value={filteredData.tasks.completionRate * 100} 
                                            className="h-3"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-500">
                                                {filteredData.tasks.completedOnTime}
                                            </div>
                                            <div className="text-xs text-muted-foreground">On Time</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-yellow-500">
                                                {filteredData.tasks.pending}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Pending</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-red-500">
                                                {filteredData.tasks.overdue}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Overdue</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Time to Close</CardTitle>
                                <CardDescription>Average time to complete tasks</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className="text-4xl font-bold mb-2">
                                            {filteredData.tasks.averageTimeToClose}
                                        </div>
                                        <p className="text-sm text-muted-foreground">days average</p>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-border">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-muted-foreground">Total Tasks</span>
                                            <span className="text-sm font-semibold">
                                                {filteredData.tasks.totalTasks}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                
                {/* Coaching Tab */}
                <TabsContent value="coaching" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Coaching by Profile</CardTitle>
                            <CardDescription>
                                Insights e sugestões baseadas no seu perfil: {filteredData.coaching.currentProfile}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {Object.entries(filteredData.coaching.insights).map(([profile, data]) => {
                                const coachingData = data as { insights: string[], suggestions: string[] };
                                return (
                                <motion.div
                                    key={profile}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "p-4 rounded-lg border",
                                        profile === filteredData.coaching.currentProfile
                                            ? "border-primary bg-primary/5"
                                            : "border-border"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <Badge variant="outline" className="text-sm">
                                            As {profile}
                                        </Badge>
                                        {profile === filteredData.coaching.currentProfile && (
                                            <Badge variant="default" className="text-xs">
                                                Current
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <Lightbulb className="h-4 w-4 text-primary" />
                                                Insights
                                            </h4>
                                            <ul className="space-y-2">
                                                {coachingData.insights.map((insight: string, idx: number) => (
                                                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                                        <span className="text-primary mt-1">•</span>
                                                        <span>{insight}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        
                                        <div className="pt-4 border-t border-border">
                                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <Target className="h-4 w-4 text-primary" />
                                                Sugestões Práticas
                                            </h4>
                                            <ul className="space-y-2">
                                                {coachingData.suggestions.map((suggestion: string, idx: number) => (
                                                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                        <span>{suggestion}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                            })}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

