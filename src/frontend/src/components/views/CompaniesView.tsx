import { useEffect, useState, useCallback } from "react";
import { useSearchableList } from "@/hooks/useSearchableList";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Company } from "@/api/client";
import { CompanyForm } from "@/components/companies/CompanyForm";
import { Plus, Building2, MoreHorizontal, Edit, Trash2, Globe, ArrowUpRight, AlertCircle, Search, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWrapper } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CompaniesView() {
    const navigate = useNavigate();
    const {
        companies,
        projects,
        fetchCompanies,
        selectCompany,
        deleteCompany,
        isLoading,
    } = useWorkspaceStore();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

    const {
        searchQuery,
        setSearchQuery,
        filteredItems: filteredCompanies,
        clearSearch,
        hasSearchQuery,
    } = useSearchableList(
        companies,
        ['name', 'industry', 'description'],
        300
    );

    useEffect(() => {
        const loadCompanies = async () => {
            try {
                setError(null);
                await fetchCompanies();
            } catch (e) {
                setError("Failed to load companies");
                toast.error("Failed to load companies. Please try again.");
            }
        };
        loadCompanies();
    }, [fetchCompanies]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isFormOpen) {
                e.preventDefault();
                handleCreate();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFormOpen]);

    const handleSelect = (id: string) => {
        selectCompany(id);
        navigate(`/companies/${id}/projects`);
    };

    const handleCreate = useCallback(() => {
        setEditingCompany(null);
        setIsFormOpen(true);
    }, []);

    const handleEdit = useCallback((e: React.MouseEvent, company: Company) => {
        e.stopPropagation();
        setEditingCompany(company);
        setIsFormOpen(true);
    }, []);

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setCompanyToDelete(id);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!companyToDelete) return;
        try {
            // Optimistic update
            const company = companies.find(c => c.id === companyToDelete);
            if (company) {
                useWorkspaceStore.getState().setCompanies(
                    companies.filter(c => c.id !== companyToDelete)
                );
            }

            await deleteCompany(companyToDelete);
            toast.success("Company deactivated successfully");
            setCompanyToDelete(null);
        } catch (e) {
            // Rollback on error
            await fetchCompanies();
            toast.error("Failed to deactivate company");
        }
    };


    // Keyboard navigation
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (focusedIndex === null || filteredCompanies.length === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex(prev =>
                    prev === null ? 0 : Math.min(prev + 1, filteredCompanies.length - 1)
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex(prev =>
                    prev === null ? filteredCompanies.length - 1 : Math.max(prev - 1, 0)
                );
            } else if (e.key === "Enter" && focusedIndex !== null) {
                e.preventDefault();
                handleSelect(filteredCompanies[focusedIndex].id);
            } else if (e.key === "Escape") {
                setFocusedIndex(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [focusedIndex, filteredCompanies]);

    return (
        <div className="space-y-8 w-full">
            {/* Page Header */}
            <div className="flex flex-col gap-4 border-b border-border/50 pb-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Companies</h1>
                        <p className="text-muted-foreground mt-2 text-sm max-w-lg">
                            Manage your client portfolio, track projects, and access intelligence archives.
                        </p>
                    </div>
                    <Button onClick={handleCreate} className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Company
                        <kbd className="ml-2 hidden md:inline-flex h-5 px-1.5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                            <span className="text-xs">⌘</span>N
                        </kbd>
                    </Button>
                </div>
                {companies.length > 0 && (
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search companies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-card"
                            aria-label="Search companies"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
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
                    <p className="text-sm">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => fetchCompanies()}>
                        Retry
                    </Button>
                </div>
            )}

            {/* Loading State with Shimmer */}
            {isLoading && companies.length === 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div
                            key={i}
                            className="bg-card border border-border rounded-xl p-5"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <Skeleton className="h-10 w-10 rounded-lg mb-4 skeleton-shimmer" />
                            <Skeleton className="h-5 w-3/4 rounded mb-2 skeleton-shimmer" />
                            <Skeleton className="h-4 w-full rounded mb-2 skeleton-shimmer" />
                            <Skeleton className="h-4 w-2/3 rounded skeleton-shimmer" />
                        </div>
                    ))}
                </div>
            )}

            {/* Grid */}
            {!isLoading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredCompanies.length === 0 && hasSearchQuery ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            <p className="text-sm">No companies found matching "{searchQuery}"</p>
                            <Button variant="ghost" size="sm" onClick={clearSearch} className="mt-2">
                                Clear search
                            </Button>
                        </div>
                    ) : (
                        filteredCompanies.map((company, index) => (
                            <div
                                key={company.id}
                                className={cn(
                                    "group relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md",
                                    "animate-fade-in-up",
                                    focusedIndex === index && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                )}
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => handleSelect(company.id)}
                                onFocus={() => setFocusedIndex(index)}
                                onMouseEnter={() => setFocusedIndex(index)}
                                onMouseLeave={() => setFocusedIndex(null)}
                                tabIndex={0}
                                role="button"
                                aria-label={`Open ${company.name}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => handleEdit(e, company)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => handleDelete(e, company.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Deactivate
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                                    {company.name}
                                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </h3>

                                <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
                                    {company.description || "No description provided."}
                                </p>

                                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                                    <div className="flex items-center gap-1.5 group-hover:text-foreground transition-colors">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        <span className="font-medium">
                                            {projects.filter(p => p.company_id === company.id).length} project{projects.filter(p => p.company_id === company.id).length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowUpRight className="h-3 w-3" />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                                    {company.industry && (
                                        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                            {company.industry}
                                        </span>
                                    )}
                                    {company.website && (
                                        <TooltipWrapper content="Open website in new tab">
                                            <span
                                                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                                onClick={e => { e.stopPropagation(); window.open(company.website, '_blank'); }}
                                            >
                                                <Globe className="h-3 w-3" /> Website
                                            </span>
                                        </TooltipWrapper>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Empty State / Add New Card */}
                    {companies.length === 0 && !error && !searchQuery && (
                        <div
                            onClick={handleCreate}
                            className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/50 transition-colors h-[220px]"
                        >
                            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-3">
                                <Plus className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium text-foreground">Add first company</h3>
                            <p className="text-sm text-muted-foreground mt-1">Start organizing your workspace</p>
                        </div>
                    )}
                </div>
            )}

            <CompanyForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                editingCompany={editingCompany}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="Deactivate Company"
                description="Are you sure you want to deactivate this company? This action can be undone later."
                confirmText="Deactivate"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={confirmDelete}
            />
        </div>
    );
}
