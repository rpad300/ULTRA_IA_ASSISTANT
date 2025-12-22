import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Calendar, Building2, Briefcase, Settings, CheckSquare, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const { companies, projects, selectedCompanyId } = useWorkspaceStore();

    // Build dynamic results from actual data
    const results = [
        // Navigation
        { type: "nav", label: "Go to Companies", icon: Building2, action: () => navigate("/companies") },
        { type: "nav", label: "Go to Tasks", icon: CheckSquare, action: () => navigate("/tasks") },
        { type: "nav", label: "Go to Analytics", icon: TrendingUp, action: () => navigate("/analytics") },
        { type: "nav", label: "Go to Settings", icon: Settings, action: () => navigate("/settings") },
        // Companies
        ...companies.slice(0, 3).map(c => ({
            type: "company" as const,
            label: c.name,
            icon: Building2,
            action: () => {
                navigate(`/companies/${c.id}/projects`);
                onOpenChange(false);
            }
        })),
        // Projects (from selected company)
        ...projects
            .filter(p => p.company_id === selectedCompanyId)
            .slice(0, 3)
            .map(p => ({
                type: "project" as const,
                label: p.name,
                icon: Briefcase,
                action: () => {
                    navigate(`/companies/${selectedCompanyId}/projects/${p.id}`);
                    onOpenChange(false);
                }
            })),
        // Actions
        { type: "action", label: "Start meeting now", icon: Calendar, action: () => navigate("/") },
    ];

    const filteredResults = query
        ? results.filter(r => r.label.toLowerCase().includes(query.toLowerCase()))
        : results.slice(0, 4);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                onOpenChange(true);
            }
            if (e.key === 'Escape' && open) {
                onOpenChange(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0">
                <div className="flex items-center border-b border-border px-4">
                    <Search className="h-4 w-4 text-muted-foreground mr-2" />
                    <Input
                        placeholder="Search or run a command..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-14 text-base"
                        autoFocus
                    />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground px-2">
                        <kbd className="px-1.5 py-0.5 bg-muted rounded">⌘</kbd>
                        <kbd className="px-1.5 py-0.5 bg-muted rounded">K</kbd>
                    </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-2">
                    {filteredResults.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            <p>No results found</p>
                            <p className="text-xs mt-1 opacity-70">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredResults.map((result, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        result.action();
                                        onOpenChange(false);
                                        setQuery("");
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            result.action();
                                            onOpenChange(false);
                                            setQuery("");
                                        }
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-all group",
                                        "focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                                    )}
                                    tabIndex={0}
                                >
                                    <result.icon className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                                    <span className="flex-1 text-sm">{result.label}</span>
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

