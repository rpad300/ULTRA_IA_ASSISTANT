import { useWorkspaceStore } from "@/store/workspaceStore";
import { useMeetingStore } from "@/store/meetingStore";
import { workspaceApi } from "@/api/client";
import { useSystemStore } from "@/store/systemStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Building2, Briefcase, User, Wifi, Cloud, CloudOff, Sparkles, ChevronDown, Sun, Moon, Database, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { TooltipWrapper } from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";

type AssistantMode = "passive" | "semi-active" | "active";

export function TopBar() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const {
        selectedCompanyId,
        selectedProjectId,
        companies,
        projects,
        profiles,
        selectedProfileId,
        fetchCompanies,
        fetchProjects,
        fetchProfiles
    } = useWorkspaceStore();

    // System Health Store
    const { services, checkHealth, isLoading: isHealthLoading, status: systemStatus } = useSystemStore();

    const [assistantMode, setAssistantMode] = useState<AssistantMode>("passive");
    const [isLensSwapping, setIsLensSwapping] = useState(false);

    const handleProfileSelect = (profileId: string) => {
        setIsLensSwapping(true);
        useWorkspaceStore.getState().selectProfile(profileId);
        // Visual feedback duration
        setTimeout(() => setIsLensSwapping(false), 800);
    };

    // Initial Load & Polling
    useEffect(() => {
        // Load companies
        if (companies.length === 0) fetchCompanies();

        // Load health immediately
        checkHealth();

        // Poll health every 30s
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, [companies.length, fetchCompanies, checkHealth]);

    // Load projects if needed
    // Load projects and profiles if needed
    // Lazy Load Handlers
    const handleCompaniesOpen = (open: boolean) => {
        if (open && companies.length === 0) fetchCompanies();
    };

    const handleProjectsOpen = (open: boolean) => {
        if (open && selectedCompanyId) {
            // SOTA: Refetch if empty to ensure we have list, but only on interaction
            if (projects.filter(p => p.company_id === selectedCompanyId).length === 0) {
                fetchProjects(selectedCompanyId);
            }
        }
    };

    const handleProfilesOpen = (open: boolean) => {
        if (open && selectedCompanyId) {
            if (profiles.filter(p => p.company_id === selectedCompanyId).length === 0) {
                fetchProfiles(selectedCompanyId);
            }
        }
    };

    const currentCompany = companies.find(c => c.id === selectedCompanyId);
    const currentProject = projects.find(p => p.id === selectedProjectId);

    const modeColors = {
        passive: "bg-muted text-muted-foreground",
        "semi-active": "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
        active: "bg-green-500/20 text-green-500 border-green-500/30"
    };

    const handleCompanySelect = (companyId: string) => {
        useWorkspaceStore.getState().selectCompany(companyId);
        navigate(`/companies/${companyId}/projects`);
    };

    const handleProjectSelect = (projectId: string) => {
        useWorkspaceStore.getState().selectProject(projectId);
        navigate(`/companies/${selectedCompanyId}/projects/${projectId}`);
    };

    // Helper for Status Icon Color
    const getStatusColor = (isConnected: boolean, status: string) => {
        if (!isConnected) return "text-muted-foreground opacity-50";
        if (status === 'healthy') return "text-green-500";
        if (status === 'degraded') return "text-yellow-500";
        return "text-red-500";
    };

    return (
        <div className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
            {/* Left: Context Selectors */}
            <div className="flex items-center gap-4">
                {/* Company Selector */}
                <DropdownMenu onOpenChange={handleCompaniesOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="gap-2 h-9">
                            <Building2 className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                {currentCompany?.name || "Select company"}
                            </span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        {companies.length === 0 ? (
                            <DropdownMenuItem className="opacity-50 pointer-events-none">No companies</DropdownMenuItem>
                        ) : (
                            companies.map(company => (
                                <DropdownMenuItem
                                    key={company.id}
                                    onClick={() => handleCompanySelect(company.id)}
                                    className={cn(
                                        selectedCompanyId === company.id && "bg-accent"
                                    )}
                                >
                                    {company.name}
                                </DropdownMenuItem>
                            ))
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/companies")}>
                            Manage companies...
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Project Selector */}
                {selectedCompanyId && (
                    <DropdownMenu onOpenChange={handleProjectsOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 h-9" disabled={!selectedCompanyId}>
                                <Briefcase className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                    {currentProject?.name || "No project selected"}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            {projects.filter(p => p.company_id === selectedCompanyId).length === 0 ? (
                                <DropdownMenuItem className="opacity-50 pointer-events-none">No projects</DropdownMenuItem>
                            ) : (
                                projects
                                    .filter(p => p.company_id === selectedCompanyId)
                                    .map(project => (
                                        <DropdownMenuItem
                                            key={project.id}
                                            onClick={() => handleProjectSelect(project.id)}
                                            className={cn(
                                                selectedProjectId === project.id && "bg-accent"
                                            )}
                                        >
                                            {project.name}
                                        </DropdownMenuItem>
                                    ))
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/companies/${selectedCompanyId}/projects`)}>
                                Manage projects...
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}


                {/* Profile Selector */}
                {selectedCompanyId && (
                    <DropdownMenu onOpenChange={handleProfilesOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 h-9" disabled={!selectedCompanyId}>
                                <User className="h-4 w-4" />
                                {selectedProfileId && profiles.find(p => p.id === selectedProfileId) ? (
                                    <Badge variant="outline" className="text-xs font-medium">
                                        {profiles.find(p => p.id === selectedProfileId)?.name}
                                    </Badge>
                                ) : (
                                    <span className="text-sm font-medium">Select profile</span>
                                )}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            {profiles.length === 0 ? (
                                <DropdownMenuItem className="opacity-50 pointer-events-none">No profiles</DropdownMenuItem>
                            ) : (
                                profiles.map(profile => (
                                    <DropdownMenuItem
                                        key={profile.id}
                                        onClick={() => handleProfileSelect(profile.id)}
                                        className={cn(
                                            selectedProfileId === profile.id && "bg-accent"
                                        )}
                                    >
                                        {profile.name}
                                    </DropdownMenuItem>
                                ))
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate("/profiles")}>
                                Manage profiles...
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Right: Status & Mode */}
            <div className="flex items-center gap-3">
                {/* Theme Toggle */}
                <TooltipWrapper content={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <Sun className="h-4 w-4" />
                        ) : (
                            <Moon className="h-4 w-4" />
                        )}
                    </Button>
                </TooltipWrapper>

                {/* Assistant Mode Toggle */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn("gap-2 h-8", modeColors[assistantMode])}
                        >
                            {assistantMode === "active" ? (
                                <Sparkles className="h-3.5 w-3.5" />
                            ) : assistantMode === "semi-active" ? (
                                <Sparkles className="h-3.5 w-3.5 opacity-50" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5 opacity-30" />
                            )}
                            <span className="text-xs font-medium capitalize">{assistantMode}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setAssistantMode("passive")}>
                            Passive
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAssistantMode("semi-active")}>
                            Semi-active
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAssistantMode("active")}>
                            Active
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Status Indicators */}
                <div className="flex items-center gap-3 px-2 border-l pl-4">

                    {/* Backend/System Status */}
                    <TooltipWrapper content={isHealthLoading ? "Checking system..." : systemStatus === 'healthy' ? "System Operational" : "System Degraded"}>
                        <div className={cn("flex items-center transition-colors",
                            isHealthLoading ? "animate-pulse text-muted-foreground" :
                                systemStatus === 'healthy' ? "text-green-500" : "text-red-500"
                        )}>
                            <Wifi className="h-4 w-4" />
                        </div>
                    </TooltipWrapper>

                    {/* Supabase */}
                    <TooltipWrapper content={`Supabase: ${services.supabase.connected ? 'Connected' : 'Disconnected'} (${services.supabase.latency_ms || 0}ms)`}>
                        <div className={cn("flex items-center transition-colors cursor-help", getStatusColor(services.supabase.connected, services.supabase.status))}>
                            <Database className="h-4 w-4" />
                        </div>
                    </TooltipWrapper>

                    {/* Qdrant */}
                    <TooltipWrapper content={`Vector DB (Qdrant): ${services.qdrant.connected ? 'Active' : 'Disconnected'} (${services.qdrant.details?.vectors || 0} vectors)`}>
                        <div className={cn("flex items-center transition-colors cursor-help", getStatusColor(services.qdrant.connected, services.qdrant.status))}>
                            <Layers className="h-4 w-4" />
                        </div>
                    </TooltipWrapper>

                    {/* Gemini */}
                    <TooltipWrapper content={`Gemini AI: ${services.gemini.connected ? 'Ready' : 'Unavailable'} (${services.gemini.details?.model || 'No model'})`}>
                        <div className={cn("flex items-center transition-colors cursor-help", getStatusColor(services.gemini.connected, services.gemini.status))}>
                            <Sparkles className="h-4 w-4" />
                        </div>
                    </TooltipWrapper>

                    {/* PicoVoice (Speaker ID) */}
                    <SpeakerIDStatus />

                    {/* Google Drive */}
                    <TooltipWrapper content={`Google Drive: ${services.drive.connected ? 'Synced' : 'Click to Connect'} ${services.drive.details?.user ? `(${services.drive.details.user})` : ''}`}>
                        <div
                            className={cn("flex items-center transition-colors cursor-pointer hover:bg-muted/50 p-1 rounded", getStatusColor(services.drive.connected, services.drive.status))}
                            onClick={async () => {
                                if (!services.drive.connected) {
                                    try {
                                        await workspaceApi.connectDrive();
                                    } catch (e) {
                                        console.error("Failed to connect drive", e);
                                    }
                                }
                            }}
                        >
                            {services.drive.connected ? (
                                <Cloud className="h-4 w-4" />
                            ) : (
                                <CloudOff className="h-4 w-4" />
                            )}
                        </div>
                    </TooltipWrapper>

                </div>
            </div>

            {/* Lens Swap Overlay */}
            {isLensSwapping && (
                <div className="fixed inset-0 z-[100] bg-background/30 backdrop-blur-[4px] animate-in fade-in duration-300 pointer-events-none flex items-center justify-center">
                    <div className="bg-card/90 p-4 rounded-xl shadow-2xl border border-primary/20 animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 flex items-center gap-4">
                        <div className="relative">
                            <Sparkles className="h-6 w-6 text-primary animate-spin-slow" />
                            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
                        </div>
                        <div className="space-y-0.5">
                            <h4 className="text-sm font-semibold">Switching Neural Lens</h4>
                            <p className="text-xs text-muted-foreground">Realigning attention mechanisms...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SpeakerIDStatus() {
    const { picoVoiceStatus } = useMeetingStore();
    const { services } = useSystemStore();

    // Determine effective status: prefer real-time (meetingStore) over polled (systemStore)
    // But meetingStore defaults to 'unknown', so use systemStore if meetingStore is unknown
    const systemPicoStatus = services.picovoice?.details?.status || 'unknown';
    const effectiveStatus = picoVoiceStatus !== 'unknown' ? picoVoiceStatus : systemPicoStatus;

    // Derived status for color
    const getPicoColor = () => {
        if (effectiveStatus === 'ready') return "text-green-500";
        if (effectiveStatus === 'failed' || effectiveStatus === 'unhealthy') return "text-red-500";
        if (effectiveStatus === 'initializing') return "text-yellow-500";
        return "text-muted-foreground opacity-30"; // Unknown/Hidden
    };

    return (
        <TooltipWrapper content={`Speaker ID: ${effectiveStatus === 'ready' ? 'Active' : effectiveStatus}`}>
            <div className={cn("flex items-center transition-colors cursor-help", getPicoColor())}>
                <User className="h-4 w-4" />
            </div>
        </TooltipWrapper>
    );
}

