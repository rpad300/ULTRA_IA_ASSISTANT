import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CommandItem {
    id: string;
    label: string;
    shortcut?: string;
    icon?: React.ReactNode;
    action: () => void;
    keywords?: string[];
}

interface CommandPaletteProps {
    items: CommandItem[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ items, open, onOpenChange }: CommandPaletteProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredItems = items.filter(item => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            item.label.toLowerCase().includes(query) ||
            item.keywords?.some(kw => kw.toLowerCase().includes(query))
        );
    });

    const handleSelect = useCallback((item: CommandItem) => {
        item.action();
        onOpenChange?.(false);
        setSearchQuery("");
        setSelectedIndex(0);
    }, [onOpenChange]);

    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSelectedIndex(0);
        }
    }, [open]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredItems.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    handleSelect(filteredItems[selectedIndex]);
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                onOpenChange?.(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, filteredItems, selectedIndex, handleSelect, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
                <div className="flex items-center border-b border-border px-4">
                    <Search className="h-4 w-4 text-muted-foreground mr-2" />
                    <Input
                        placeholder="Type a command or search..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        autoFocus
                    />
                </div>
                <div className="max-h-[400px] overflow-y-auto p-2">
                    {filteredItems.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-8">
                            No commands found
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredItems.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <button
                                        onClick={() => handleSelect(item)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                                            selectedIndex === index
                                                ? "bg-accent text-accent-foreground"
                                                : "hover:bg-accent/50"
                                        )}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
                                            <span>{item.label}</span>
                                        </div>
                                        {item.shortcut && (
                                            <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                                                {item.shortcut}
                                            </kbd>
                                        )}
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">↑</kbd>
                            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">↓</kbd>
                            <span>Navigate</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">↵</kbd>
                            <span>Select</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">Esc</kbd>
                        <span>Close</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Hook to use command palette globally
export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return { isOpen, setIsOpen };
}

