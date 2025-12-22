import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Plus, Search, Calendar, Users, Filter, Bookmark, X, Trash2, Archive, CheckSquare, Square } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { workspaceApi, type Project, type Thread } from "@/api/client";
import { toast } from "@/components/ui/toast";
import { ThreadForm } from "@/components/threads/ThreadForm";
import { useDebounce } from "@/hooks/useDebounce";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ContextMenu } from "@/components/ui/context-menu";
// Virtual scrolling can be added later with react-window if needed for very large lists

// Memoized Thread Card Component with selection
const ThreadCard = memo(({
    thread,
    index,
    onSelect,
    isSelected,
    onToggleSelect,
    getStatusColor,
    getSessionCount
}: {
    thread: Thread;
    index: number;
    onSelect: (id: string) => void;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    getStatusColor: (status: string) => string;
    getSessionCount: (id: string) => number;
}) => {
    return (
        <ContextMenu
            options={[
                {
                    label: "Open",
                    onClick: () => onSelect(thread.id),
                },
                {
                    label: "Archive",
                    icon: <Archive className="h-4 w-4" />,
                    onClick: () => {
                        // TODO: Implement archive
                        toast.info("Archive feature coming soon");
                    },
                },
                {
                    label: "Delete",
                    icon: <Trash2 className="h-4 w-4" />,
                    variant: "destructive",
                    onClick: () => {
                        if (confirm(`Delete thread "${thread.title}"?`)) {
                            // TODO: Implement delete
                            toast.info("Delete feature coming soon");
                        }
                    },
                },
            ]}
        >
            <div
                onClick={(e) => {
                    if (e.shiftKey || e.metaKey || e.ctrlKey) {
                        e.stopPropagation();
                        onToggleSelect(thread.id);
                    } else {
                        onSelect(thread.id);
                    }
                }}
                className={cn(
                    "p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer group relative",
                    "hover:scale-[1.02] hover:shadow-lg",
                    "animate-in fade-in slide-in-from-bottom-2",
                    isSelected && "ring-2 ring-primary bg-primary/5"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(thread.id);
                    }
                }}
                aria-label={`Open thread ${thread.title}`}
            >
                {/* Selection checkbox */}
                <div className="absolute top-3 left-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect(thread.id);
                        }}
                        className={cn(
                            "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                            isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        {isSelected && <CheckSquare className="h-3 w-3" />}
                    </button>
                </div>

                <div className="flex items-start justify-between mb-3 pl-7">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                                    {thread.title}
                                </h4>
                                <Badge
                                    variant="outline"
                                    className={cn("text-xs shrink-0 transition-all", getStatusColor(thread.status))}
                                >
                                    {thread.status}
                                </Badge>
                            </div>
                            {thread.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                    {thread.description}
                                </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {thread.profiles && (
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {thread.profiles.name}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(thread.updated_at).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {getSessionCount(thread.id)} sessions
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0 text-muted-foreground ml-2">
                        →
                    </div>
                </div>
            </div>
        </ContextMenu>
    );
});

ThreadCard.displayName = "ThreadCard";

export function ThreadsViewWithBulk() {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const {
        threads,
        selectProject,
        fetchThreads,
        fetchProject,
        isLoading
    } = useWorkspaceStore();

    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [profileFilter, setProfileFilter] = useState<string>("all");
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
    const [savedFilters, setSavedFilters] = useLocalStorage<Array<{ name: string; status: string; profile: string }>>("thread-filters", []);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        if (projectId) {
            selectProject(projectId);
            fetchThreads(projectId);
            fetchProject(projectId).then(p => setCurrentProject(p));
        }
    }, [projectId, fetchThreads, selectProject, fetchProject]);

    // Filter threads
    const filteredThreads = useMemo(() => {
        return threads.filter(thread => {
            // Status filter
            if (statusFilter !== "all" && thread.status !== statusFilter) {
                return false;
            }

            // Profile filter
            if (profileFilter !== "all" && thread.profiles?.name !== profileFilter) {
                return false;
            }

            // Search filter
            if (debouncedSearchQuery) {
                const query = debouncedSearchQuery.toLowerCase();
                return (
                    thread.title.toLowerCase().includes(query) ||
                    thread.description?.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [threads, statusFilter, profileFilter, debouncedSearchQuery]);

    const handleSelectThread = useCallback((threadId: string) => {
        useWorkspaceStore.getState().selectThread(threadId);
        navigate(`/threads/${threadId}`);
    }, [navigate]);

    const handleToggleSelect = useCallback((threadId: string) => {
        setSelectedThreads(prev => {
            const next = new Set(prev);
            if (next.has(threadId)) {
                next.delete(threadId);
            } else {
                next.add(threadId);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedThreads.size === filteredThreads.length) {
            setSelectedThreads(new Set());
        } else {
            setSelectedThreads(new Set(filteredThreads.map(t => t.id)));
        }
    }, [selectedThreads, filteredThreads]);

    const handleBulkDelete = useCallback(async () => {
        if (selectedThreads.size === 0) return;
        if (confirm(`Delete ${selectedThreads.size} thread(s)?`)) {
            // TODO: Implement bulk delete
            toast.info("Bulk delete coming soon");
            setSelectedThreads(new Set());
        }
    }, [selectedThreads]);

    const handleBulkArchive = useCallback(async () => {
        if (selectedThreads.size === 0) return;
        // TODO: Implement bulk archive
        toast.info("Bulk archive coming soon");
        setSelectedThreads(new Set());
    }, [selectedThreads]);

    const handleFormSuccess = useCallback(() => {
        if (projectId) {
            fetchThreads(projectId);
        }
    }, [projectId, fetchThreads]);

    // Get unique profiles from threads
    const availableProfiles = useMemo(() => {
        const profiles = new Set<string>();
        threads.forEach(thread => {
            if (thread.profiles?.name) {
                profiles.add(thread.profiles.name);
            }
        });
        return Array.from(profiles);
    }, [threads]);

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

    // Get real session count from API
    const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        const loadSessionCounts = async () => {
            const counts: Record<string, number> = {};
            for (const thread of threads) {
                try {
                    const res = await workspaceApi.get(`/threads/${thread.id}/sessions`);
                    counts[thread.id] = res.data?.length || 0;
                } catch (error) {
                    counts[thread.id] = 0;
                }
            }
            setSessionCounts(counts);
        };

        if (threads.length > 0) {
            loadSessionCounts();
        }
    }, [threads]);

    const getSessionCount = useCallback((threadId: string) => {
        return sessionCounts[threadId] || 0;
    }, [sessionCounts]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + A - Select all
            if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isFormOpen) {
                e.preventDefault();
                handleSelectAll();
            }

            // Delete - Delete selected
            if (e.key === 'Delete' && selectedThreads.size > 0) {
                e.preventDefault();
                handleBulkDelete();
            }

            // Cmd/Ctrl + N - New thread
            if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isFormOpen) {
                e.preventDefault();
                setIsFormOpen(true);
            }

            // Cmd/Ctrl + F - Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
                e.preventDefault();
                const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                searchInput?.focus();
            }

            // Arrow keys navigation
            if (filteredThreads.length > 0 && !isFormOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIndex(prev =>
                        prev === null ? 0 : Math.min(prev + 1, filteredThreads.length - 1)
                    );
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex(prev =>
                        prev === null ? filteredThreads.length - 1 : Math.max(prev - 1, 0)
                    );
                } else if (e.key === 'Enter' && focusedIndex !== null) {
                    e.preventDefault();
                    handleSelectThread(filteredThreads[focusedIndex].id);
                }
            }

            // ESC - Close form or clear selection
            if (e.key === 'Escape') {
                if (isFormOpen) {
                    setIsFormOpen(false);
                } else if (selectedThreads.size > 0) {
                    setSelectedThreads(new Set());
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFormOpen, filteredThreads, focusedIndex, handleSelectThread, selectedThreads, handleSelectAll, handleBulkDelete]);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-border/50 pb-6 mb-6">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => navigate(currentProject ? `/companies/${currentProject.company_id}/projects` : "/")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">{currentProject?.name || "Loading..."}</h1>
                        <p className="text-sm text-muted-foreground mt-1">Threads & Sessions</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {selectedThreads.size > 0 && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleBulkArchive}
                                className="gap-2"
                            >
                                <Archive className="h-4 w-4" />
                                Archive ({selectedThreads.size})
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBulkDelete}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete ({selectedThreads.size})
                            </Button>
                        </>
                    )}
                    <Button
                        onClick={() => setIsFormOpen(true)}
                        className="shadow-sm hover:shadow-md transition-shadow"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Thread
                        <kbd className="ml-2 hidden md:inline-flex h-5 px-1.5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                            <span className="text-xs">⌘</span>N
                        </kbd>
                    </Button>
                </div>
            </div>

            {/* Filters */}
            {threads.length > 0 && (
                <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search threads... (⌘F)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-card focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="planned">Planned</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                            {availableProfiles.length > 0 && (
                                <Select value={profileFilter} onValueChange={setProfileFilter}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="Profile" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Profiles</SelectItem>
                                        {availableProfiles.map(profile => (
                                            <SelectItem key={profile} value={profile}>{profile}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-[140px] sm:w-auto"
                                onClick={() => {
                                    const name = prompt("Save current filters as:");
                                    if (name) {
                                        setSavedFilters(prev => [...prev, { name, status: statusFilter, profile: profileFilter }]);
                                        toast.success("Filter saved");
                                    }
                                }}
                                title="Save current filters"
                            >
                                <Bookmark className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Save Filter</span>
                            </Button>
                            {(statusFilter !== "all" || profileFilter !== "all" || searchQuery) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setStatusFilter("all");
                                        setProfileFilter("all");
                                        setSearchQuery("");
                                    }}
                                    title="Clear filters"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Bulk selection controls */}
                    {filteredThreads.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSelectAll}
                                className="gap-2"
                            >
                                {selectedThreads.size === filteredThreads.length ? (
                                    <CheckSquare className="h-4 w-4" />
                                ) : (
                                    <Square className="h-4 w-4" />
                                )}
                                {selectedThreads.size === filteredThreads.length ? "Deselect All" : "Select All"}
                            </Button>
                            {selectedThreads.size > 0 && (
                                <span className="text-muted-foreground">
                                    {selectedThreads.size} selected
                                </span>
                            )}
                        </div>
                    )}

                    {/* Saved Filters */}
                    {savedFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-muted-foreground self-center">Saved:</span>
                            {savedFilters.map((filter, idx) => (
                                <Badge
                                    key={idx}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-accent transition-colors"
                                    onClick={() => {
                                        setStatusFilter(filter.status);
                                        setProfileFilter(filter.profile);
                                    }}
                                >
                                    {filter.name}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSavedFilters(prev => prev.filter((_, i) => i !== idx));
                                            toast.success("Filter removed");
                                        }}
                                        className="ml-2 hover:text-destructive"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && threads.length === 0 ? (
                    <div className="grid gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-5 rounded-xl border border-border bg-card">
                                <Skeleton className="h-6 w-3/4 rounded mb-3 skeleton-shimmer" />
                                <Skeleton className="h-4 w-full rounded mb-2 skeleton-shimmer" />
                                <Skeleton className="h-4 w-2/3 rounded skeleton-shimmer" />
                            </div>
                        ))}
                    </div>
                ) : filteredThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                        <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mb-4">
                            <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-lg text-foreground mb-2">
                            {searchQuery || statusFilter !== "all" || profileFilter !== "all"
                                ? "No threads match your filters"
                                : "No threads yet"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                            {searchQuery || statusFilter !== "all" || profileFilter !== "all"
                                ? "Try adjusting your filters or search query."
                                : "Create your first thread to start preparing for meetings."}
                        </p>
                        {!searchQuery && statusFilter === "all" && profileFilter === "all" && (
                            <Button onClick={() => setIsFormOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Create First Thread
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredThreads.map((thread, index) => (
                            <ThreadCard
                                key={thread.id}
                                thread={thread}
                                index={index}
                                onSelect={handleSelectThread}
                                isSelected={selectedThreads.has(thread.id)}
                                onToggleSelect={handleToggleSelect}
                                getStatusColor={getStatusColor}
                                getSessionCount={getSessionCount}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ThreadForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                projectId={projectId || ""}
                companyId={currentProject?.company_id || ""}
                onSuccess={handleFormSuccess}
            />
        </div>
    );
}

