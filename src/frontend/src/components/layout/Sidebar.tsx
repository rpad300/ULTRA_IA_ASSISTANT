import { useEffect, useState } from "react"
import { useLocation, Link } from "react-router-dom"
import { LayoutDashboard, Folder, MessageSquare, Settings, Command, ChevronRight, Users, BookOpen, CheckSquare, TrendingUp, Building2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspaceStore } from "@/store/workspaceStore"
import { workspaceApi } from "@/api/client"

export function Sidebar() {
    const location = useLocation();
    const { selectedCompanyId, selectedProjectId } = useWorkspaceStore();

    const [taskCount, setTaskCount] = useState(0);
    const [upcomingMeetings, setUpcomingMeetings] = useState(0);
    
    useEffect(() => {
        const loadCounts = async () => {
            try {
                if (selectedCompanyId) {
                    const tasksRes = await workspaceApi.getTasks({ company_id: selectedCompanyId, status: "open" });
                    setTaskCount(tasksRes.length);
                    
                    const scheduleRes = await workspaceApi.get(`/analytics/dashboard/today-schedule?company_id=${selectedCompanyId}`);
                    setUpcomingMeetings(scheduleRes.data?.length || 0);
                }
            } catch (error) {
                console.error("Failed to load counts:", error);
            }
        };
        loadCounts();
    }, [selectedCompanyId]);

    const mainNav = [
        {
            icon: LayoutDashboard,
            label: "Overview",
            path: "/",
            enabled: true,
            exact: true
        },
        {
            icon: Users,
            label: "Contacts",
            path: "/contacts",
            enabled: true,
        },
        {
            icon: CheckSquare,
            label: "Tasks",
            path: "/tasks",
            enabled: true,
            badge: taskCount > 0 ? taskCount : undefined
        },
        {
            icon: TrendingUp,
            label: "Analytics",
            path: "/analytics",
            enabled: true,
        },
        {
            icon: BookOpen,
            label: "Insights",
            path: "/insights",
            enabled: true,
        },
        {
            icon: User,
            label: "Profiles",
            path: "/profiles",
            enabled: true,
        },
    ];

    const workspaceNav = [
        {
            icon: Building2,
            label: "Companies",
            path: "/companies",
            enabled: true,
        },
        {
            icon: Folder,
            label: "Projects",
            path: selectedCompanyId ? `/companies/${selectedCompanyId}/projects` : "/projects-disabled",
            enabled: !!selectedCompanyId
        },
        {
            icon: MessageSquare,
            label: "Threads",
            path: selectedProjectId ? `/projects/${selectedProjectId}/threads` : "/threads-disabled",
            enabled: !!selectedProjectId,
            badge: upcomingMeetings > 0 ? upcomingMeetings : undefined
        },
        {
            icon: BookOpen,
            label: "Knowledge",
            path: "/knowledge-disabled",
            enabled: false
        }
    ];

    return (
        <div className="w-[260px] flex flex-col h-full bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
            {/* Header */}
            <div className="h-14 flex items-center px-4 border-b border-sidebar-border/50">
                <div className="flex items-center gap-2 font-semibold text-sm tracking-tight">
                    <div className="h-6 w-6 bg-primary rounded-md flex items-center justify-center text-primary-foreground">
                        <Command className="h-3 w-3" />
                    </div>
                    <span>Ultra Assistant</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-4 px-2 space-y-6 overflow-y-auto">
                
                {/* Main Group */}
                <div className="space-y-1">
                    {mainNav.map((item) => {
                        const isActive = item.exact 
                            ? location.pathname === item.path
                            : location.pathname.startsWith(item.path);
                            
                        return (
                            <Link key={item.label} to={item.enabled ? item.path : "#"}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-9 px-2 gap-3 font-normal",
                                        isActive 
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                                            : "text-muted-foreground hover:text-foreground",
                                        !item.enabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                                    )}
                                    disabled={!item.enabled}
                                >
                                    <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.badge && (
                                        <Badge variant="secondary" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">
                                            {item.badge}
                                        </Badge>
                                    )}
                                </Button>
                            </Link>
                        )
                    })}
                </div>

                {/* Workspace Group */}
                <div className="space-y-1">
                     <div className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 px-2 mb-2 uppercase">
                        Active Workspace
                    </div>
                    {workspaceNav.map((item) => {
                        const isActive = location.pathname.startsWith(item.path) && item.path !== "/";
                            
                        return (
                            <Link key={item.label} to={item.enabled ? item.path : "#"}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-9 px-2 gap-3 font-normal",
                                        isActive 
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                                            : "text-muted-foreground hover:text-foreground",
                                        !item.enabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                                    )}
                                    disabled={!item.enabled}
                                >
                                    <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.badge && (
                                        <Badge variant="secondary" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">
                                            {item.badge}
                                        </Badge>
                                    )}
                                    {item.enabled && isActive && !item.badge && (
                                        <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                    )}
                                </Button>
                            </Link>
                        )
                    })}
                </div>

            </div>

            {/* User / Settings Footer */}
            <div className="p-2 border-t border-sidebar-border/50">
                <Link to="/settings">
                    <Button variant="ghost" className={cn(
                        "w-full justify-start h-9 px-2 gap-3 text-muted-foreground",
                        location.pathname === "/settings" && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}>
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                    </Button>
                </Link>
            </div>
        </div>
    );
}
