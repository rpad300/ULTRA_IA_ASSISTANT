import { useEffect, useState, useCallback } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Play, FolderOpen, ExternalLink } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { workspaceApi, type Thread, type Company, type Project } from "@/api/client";
import { toast } from "@/components/ui/toast";
import { ThreadPrepChat } from "@/components/threads/ThreadPrepChat";
import { ThreadContextPanel } from "@/components/threads/ThreadContextPanel";
import { ScriptStudio } from "@/components/threads/ScriptStudio";
import { Loader2 } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, MessageSquare } from "lucide-react";
import { useOverlayStore } from "@/store/overlayStore";

export function ThreadWorkspaceView() {
    const navigate = useNavigate();
    const { threadId } = useParams();
    const {
        messages,
        fetchMessages,
        sendMessage,
        selectThread,
        isLoading
    } = useWorkspaceStore();

    const [thread, setThread] = useState<Thread | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [isLoadingThread, setIsLoadingThread] = useState(true);
    const [threadError, setThreadError] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [activeTab, setActiveTab] = useState<'preparation' | 'scripts'>('preparation');
    const { openOverlay } = useOverlayStore();

    const loadThreadData = useCallback(async () => {
        if (!threadId) return;
        setIsLoadingThread(true);
        setThreadError(null);

        try {
            // Try to load thread - only retry for network errors, not for 404
            let retries = 2; // Reduced retries for better UX
            let delay = 300;

            while (retries > 0) {
                try {
                    const threadData = await workspaceApi.getThread(threadId);
                    setThread(threadData);
                    setThreadError(null); // Clear any previous errors

                    // Load project and company (with error handling)
                    if (threadData.project_id) {
                        try {
                            const projectData = await workspaceApi.getProject(threadData.project_id);
                            setProject(projectData);

                            if (projectData?.company_id) {
                                try {
                                    const companyData = await workspaceApi.getCompany(projectData.company_id);
                                    setCompany(companyData);
                                } catch (companyError: any) {
                                    if (companyError.response?.status !== 404) {
                                        console.warn("Failed to load company:", companyError);
                                    }
                                }
                            }
                        } catch (projectError: any) {
                            console.warn("Failed to load project:", projectError);
                        }
                    }

                    // Success - break out of retry loop
                    break;
                } catch (error: any) {
                    const is404 = error?.response?.status === 404;
                    const isNetworkError = !error?.response;

                    // Don't retry for 404s - the resource is gone
                    if (is404) {
                        const errorMessage = "Thread not found. It may have been deleted or doesn't exist.";
                        setThreadError(errorMessage);
                        setThread(null);
                        // We handle 404 in the UI, so maybe don't toast to avoid double erroring?
                        // toast.error(errorMessage); 
                        console.error("Thread not found:", threadId);
                        break;
                    }

                    retries--;

                    if (retries === 0) {
                        const errorMessage = error?.response?.data?.detail || error?.message || "Failed to load thread. Please try again later.";
                        setThreadError(errorMessage);
                        setThread(null);
                        toast.error(errorMessage);
                        console.error("Failed to load thread after retries:", error);
                    } else {
                        if (isNetworkError) {
                            console.warn(`Retrying thread load (${retries} retries left). Network Error.`);
                        }
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2;
                    }
                }
            }
        } finally {
            setIsLoadingThread(false);
        }
    }, [threadId]);

    useEffect(() => {
        if (!threadId) return;

        console.log(`[ThreadWorkspaceView] useEffect triggered for threadId: ${threadId}`);
        selectThread(threadId);

        // Use a ref to prevent duplicate calls in React StrictMode
        let cancelled = false;

        const loadData = async () => {
            try {
                await loadThreadData();
                if (!cancelled) {
                    fetchMessages(threadId);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load thread data:", error);
                }
            }
        };

        loadData();

        return () => {
            cancelled = true;
        };
    }, [threadId, fetchMessages, selectThread, loadThreadData]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!threadId) return;
        setIsTyping(true);
        try {
            await sendMessage(threadId, content);
            // Simulate typing delay for AI response
            setTimeout(() => {
                setIsTyping(false);
            }, 1000);
        } catch (error) {
            setIsTyping(false);
            throw error;
        }
    }, [threadId, sendMessage]);

    const getStatusColor = useCallback((status: string) => {
        switch (status) {
            case "planned":
                return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "active":
                return "bg-green-500/10 text-green-500 border-green-500/20";
            case "completed":
                return "bg-muted text-muted-foreground border-border";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    }, []);

    // Keyboard shortcuts
    useKeyboardShortcuts([
        {
            key: 'Escape',
            handler: () => navigate(project ? `/projects/${project.id}/threads` : "/"),
        },
        {
            key: 'ArrowLeft',
            meta: true,
            handler: () => navigate(project ? `/projects/${project.id}/threads` : "/"),
        },
    ], [project]);

    if (isLoadingThread) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)] animate-in fade-in duration-500">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Loading thread...</p>
                </div>
            </div>
        );
    }

    if (!thread) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center animate-in fade-in duration-500 px-4">
                <div className="max-w-md space-y-4">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-semibold">Thread not found</h2>
                    <p className="text-muted-foreground">
                        {threadError || "The thread you're looking for doesn't exist or may have been deleted."}
                    </p>
                    <div className="flex gap-3 justify-center mt-6">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (project) {
                                    navigate(`/companies/${project.company_id}/projects/${project.id}`);
                                } else {
                                    navigate("/");
                                }
                            }}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {project ? "Back to Project" : "Go Home"}
                        </Button>
                        <Button onClick={() => loadThreadData()}>
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-500">
            {/* Header */}
            <div className="border-b border-border/50 pb-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-accent"
                        onClick={() => navigate(project ? `/projects/${project.id}/threads` : "/")}
                        title="Back to threads (⌘←)"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            {company && <span className="hover:text-foreground transition-colors cursor-pointer" onClick={() => navigate(`/companies/${company.id}/projects`)}>{company.name}</span>}
                            {company && project && <span>/</span>}
                            {project && <span className="hover:text-foreground transition-colors cursor-pointer" onClick={() => navigate(`/companies/${project.company_id}/projects/${project.id}`)}>{project.name}</span>}
                            {thread.profiles && (
                                <>
                                    <span>/</span>
                                    <span>{thread.profiles.name}</span>
                                </>
                            )}
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">{thread.title}</h1>
                        {thread.description && (
                            <p className="text-sm text-muted-foreground mt-1">{thread.description}</p>
                        )}
                    </div>
                    <Badge
                        variant="outline"
                        className={cn("text-xs transition-all", getStatusColor(thread.status))}
                    >
                        {thread.status}
                    </Badge>
                </div>

                {/* Action Buttons - Responsive */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Button
                        className="gap-2 hover:scale-105 transition-transform shadow-sm hover:shadow-md flex-1 sm:flex-none"
                        onClick={async () => {
                            // Create a new session and navigate to live view
                            try {
                                if (!thread) return;
                                const session = await workspaceApi.createSession(thread.id);
                                navigate(`/sessions/${session.id}/live`);
                            } catch (error) {
                                toast.error("Failed to create session. Please try again.");
                                console.error("Session creation error:", error);
                            }
                        }}
                    >
                        <Play className="h-4 w-4" />
                        <span className="hidden sm:inline">Start Meeting Now</span>
                        <span className="sm:hidden">Start</span>
                    </Button>
                    <Button variant="outline" className="gap-2 hover:bg-accent transition-colors flex-1 sm:flex-none">
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Schedule Meeting</span>
                        <span className="sm:hidden">Schedule</span>
                    </Button>
                    <Button variant="outline" className="gap-2 hover:bg-accent transition-colors hidden md:flex">
                        <FolderOpen className="h-4 w-4" />
                        Open Project Folder in Drive
                        <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="outline"
                        className="gap-2 hover:bg-accent transition-colors"
                        onClick={() => {
                            // Open overlay in hints mode (will show insights and transcript)
                            openOverlay('hints');
                        }}
                    >
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Open Live Hints</span>
                        <span className="sm:hidden">Hints</span>
                    </Button>
                </div>
            </div>

            {/* Main Content: Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preparation' | 'scripts')} className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-fit mb-4">
                    <TabsTrigger value="preparation" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Preparation
                    </TabsTrigger>
                    <TabsTrigger value="scripts" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Scripts
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="preparation" className="flex-1 flex flex-col min-h-0 mt-0">
                    {/* Main Content: 2-Column Layout */}
                    <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                        {/* Left: Chat de Preparação */}
                        <div className="col-span-7 flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <ThreadPrepChat
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isLoading={isLoading}
                                isTyping={isTyping}
                                threadId={thread?.id}
                                enableWebSocket={true}
                            />
                        </div>

                        {/* Right: Context Panel */}
                        <div className="col-span-5 flex flex-col">
                            <ThreadContextPanel threadId={thread.id} />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="scripts" className="flex-1 flex flex-col min-h-0 mt-0">
                    <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                        <ScriptStudio />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
