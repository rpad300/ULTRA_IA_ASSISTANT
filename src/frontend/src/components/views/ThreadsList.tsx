import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { MessageSquare, Plus, Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import { workspaceApi } from "@/api/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useState, useEffect } from "react";
import { ThreadForm } from "@/components/threads/ThreadForm";

interface ThreadsListProps {
    projectId?: string;
    companyId?: string;
}

export function ThreadsList({ projectId, companyId }: ThreadsListProps) {
    const navigate = useNavigate();
    const { threads, fetchThreads, isLoading } = useWorkspaceStore();
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isThreadFormOpen, setIsThreadFormOpen] = useState(false);

    // Load threads when projectId changes
    useEffect(() => {
        if (projectId) {
            console.log("ThreadsList: Loading threads for project", projectId);
            fetchThreads(projectId).catch((error) => {
                console.error("Failed to fetch threads:", error);
            });
        }
    }, [projectId, fetchThreads]);

    const handleCreateThread = () => {
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

    const handleSelectThread = (threadId: string) => {
        navigate(`/threads/${threadId}`);
    };

    const handleDeleteThread = (e: React.MouseEvent, threadId: string) => {
        e.stopPropagation();
        setThreadToDelete(threadId);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!threadToDelete || !projectId) return;
        setIsDeleting(true);
        try {
            await workspaceApi.deleteThread(threadToDelete);
            await fetchThreads(projectId);
            toast.success("Thread deleted successfully");
            setDeleteConfirmOpen(false);
            setThreadToDelete(null);
        } catch (e: any) {
            const errorMessage = e?.response?.data?.detail || e?.message || "Failed to delete thread";
            toast.error(errorMessage);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Threads</h3>
                <Button onClick={handleCreateThread} size="sm">
                    <Plus className="mr-2 h-4 w-4" /> New Thread
                </Button>
            </div>

            {isLoading && !threads.length ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : threads.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h4 className="font-medium mb-2">No threads yet</h4>
                        <p className="text-sm text-muted-foreground mb-4">Create your first thread to start collaborating</p>
                        <Button onClick={handleCreateThread}>
                            <Plus className="mr-2 h-4 w-4" /> Create Thread
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {threads.map(thread => (
                        <Card
                            key={thread.id}
                            className="hover:border-primary/40 transition-colors cursor-pointer"
                            onClick={() => handleSelectThread(thread.id)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <MessageSquare className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-sm">{thread.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Updated {new Date(thread.updated_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={(e) => handleDeleteThread(e, thread.id)}
                                                    className="text-red-500 focus:text-red-500"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            →
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="Delete Thread"
                description="Are you sure you want to delete this thread? This will permanently delete the thread and all related data (sessions, messages, etc.). This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                isLoading={isDeleting}
                variant="destructive"
            />

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

