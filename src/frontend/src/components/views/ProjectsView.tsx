import { useEffect, useState, useMemo } from "react";
import { useSearchableList } from "@/hooks/useSearchableList";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";

import { workspaceApi, type Company, type Project } from "@/api/client";
import { Plus, Folder, Briefcase, Clock, MoreHorizontal, Settings, ArrowRight, AlertCircle, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function ProjectsView() {
    const navigate = useNavigate();
    const { companyId } = useParams();

    // SOTA: Strict Selectors
    const projects = useWorkspaceStore(state => state.projects);
    const selectCompany = useWorkspaceStore(state => state.selectCompany);
    const fetchProjects = useWorkspaceStore(state => state.fetchProjects);
    const fetchCompany = useWorkspaceStore(state => state.fetchCompany);
    const isLoading = useWorkspaceStore(state => state.isLoading);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!companyId) {
            navigate("/");
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const loadData = async () => {
            try {
                if (!signal.aborted) setError(null);

                // Select first to update context
                selectCompany(companyId);

                // Parallel fetch
                await Promise.all([
                    fetchProjects(companyId),
                    fetchCompany(companyId).then(data => {
                        if (!signal.aborted) setCurrentCompany(data);
                    })
                ]);

            } catch (e) {
                if (!signal.aborted) {
                    setError("Failed to load projects");
                    toast.error("Failed to load projects");
                }
            }
        };

        loadData();

        return () => {
            controller.abort();
        };
    }, [companyId, fetchProjects, navigate, selectCompany, fetchCompany]);

    const companyProjects = useMemo(() =>
        projects.filter(p => p.company_id === companyId),
        [projects, companyId]
    );

    const {
        searchQuery,
        setSearchQuery,
        filteredItems: filteredProjects,
        clearSearch,
        hasSearchQuery,
    } = useSearchableList(
        companyProjects,
        ['name', 'description'],
        300
    );


    const handleCreateProject = () => {
        setEditingProject(null);
        setIsFormOpen(true);
    };

    const handleProjectCreated = async () => {
        if (companyId) {
            await fetchProjects(companyId);
        }
    };

    const handleEditProject = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setEditingProject(project);
        setIsFormOpen(true);
    };

    const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setProjectToDelete(projectId);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete || !companyId) return;
        setIsDeleting(true);
        try {
            await workspaceApi.deleteProject(projectToDelete);
            await fetchProjects(companyId);
            toast.success("Project deleted successfully");
            setDeleteConfirmOpen(false);
            setProjectToDelete(null);
        } catch (e: any) {
            const errorMessage = e?.response?.data?.detail || e?.message || "Failed to delete project";
            toast.error(errorMessage);
        } finally {
            setIsDeleting(false);
        }
    };

    const formatRelativeTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'just now';
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        const diffInWeeks = Math.floor(diffInDays / 7);
        if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
        const diffInMonths = Math.floor(diffInDays / 30);
        if (diffInMonths < 12) return `${diffInMonths}mo ago`;
        const diffInYears = Math.floor(diffInDays / 365);
        return `${diffInYears}y ago`;
    };

    const handleSelectProject = (projectId: string) => {
        navigate(`/companies/${companyId}/projects/${projectId}`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header with Breadcrumb-like feel */}
            <div className="flex flex-col gap-6 border-b border-border/50 pb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Companies</button>
                    <span>/</span>
                    <span className="text-foreground font-medium">{currentCompany?.name || "..."}</span>
                </div>

                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                            {currentCompany?.name}
                            <span className="text-muted-foreground font-normal text-lg opacity-50">Projects</span>
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                            {currentCompany?.description || "Manage workspace projects and active streams."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/companies/${companyId}/settings`)}>
                            <Settings className="mr-2 h-4 w-4" /> Config
                        </Button>
                        <Button onClick={handleCreateProject} className="shadow-sm">
                            <Plus className="mr-2 h-4 w-4" /> New Project
                        </Button>
                    </div>
                </div>
                {projects.filter(p => p.company_id === companyId).length > 0 && (
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-card"
                            aria-label="Search projects"
                        />
                        {hasSearchQuery && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm flex-1">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => fetchProjects(companyId!)}>
                        Retry
                    </Button>
                </div>
            )}

            {/* Projects Grid */}
            {isLoading && projects.length === 0 && !error ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="bg-card border border-border rounded-xl p-6"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <Skeleton className="h-10 w-10 rounded-lg mb-4 skeleton-shimmer" />
                            <Skeleton className="h-5 w-3/4 rounded mb-2 skeleton-shimmer" />
                            <Skeleton className="h-4 w-full rounded mb-2 skeleton-shimmer" />
                            <Skeleton className="h-4 w-2/3 rounded skeleton-shimmer" />
                        </div>
                    ))}
                </div>
            ) : !isLoading && projects.filter(p => p.company_id === companyId).length === 0 && !error && !searchQuery ? (
                <div className="border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-card/50">
                    <div className="h-14 w-14 rounded-full bg-accent/50 flex items-center justify-center mb-4 text-muted-foreground">
                        <Folder className="h-7 w-7" />
                    </div>
                    <h3 className="font-medium text-lg text-foreground">No projects yet</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
                        Projects help you organize meetings and context. Create one to start working.
                    </p>
                    <Button onClick={handleCreateProject}>
                        Create First Project
                    </Button>
                </div>
            ) : (
                <>
                    {filteredProjects.length === 0 && hasSearchQuery ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-sm">No projects found matching "{searchQuery}"</p>
                            <Button variant="ghost" size="sm" onClick={clearSearch} className="mt-2">
                                Clear search
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredProjects.map((proj, index) => (
                                <div
                                    key={proj.id}
                                    className={cn(
                                        "group bg-card border border-border rounded-xl p-0 hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col overflow-hidden",
                                        "animate-fade-in-up"
                                    )}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                    onClick={() => handleSelectProject(proj.id)}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`Open ${proj.name}`}
                                >
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Briefcase className="h-5 w-5" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => handleEditProject(e, proj)}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={(e) => handleDeleteProject(e, proj.id)}
                                                        className="text-red-500 focus:text-red-500"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                            {proj.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {proj.description || "Active workspace."}
                                        </p>
                                    </div>

                                    {/* Footer Metrics */}
                                    {(proj.updated_at || proj.created_at) && (
                                        <div className="bg-muted/30 px-6 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex gap-4">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3" /> {formatRelativeTime(proj.updated_at || proj.created_at || new Date().toISOString())}
                                                </span>
                                            </div>
                                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-primary" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Project Form Dialog */}
            {companyId && (
                <ProjectForm
                    open={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    editingProject={editingProject}
                    companyId={companyId}
                    onProjectCreated={handleProjectCreated}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="Delete Project"
                description="Are you sure you want to delete this project? This will permanently delete the project and all related data (threads, sessions, tasks, etc.). This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                isLoading={isDeleting}
                variant="destructive"
            />
        </div>
    );
}
