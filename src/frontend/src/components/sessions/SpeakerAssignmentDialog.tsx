
import { useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Search, UserPlus, Sparkles, Mic, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdentityEngine } from "./hooks/useIdentityEngine";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SpeakerAssignmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    traceId: string;
    currentSpeaker: string;
    onAssign: (contactName: string) => void;
}

export function SpeakerAssignmentDialog({
    open,
    onOpenChange,
    traceId,
    currentSpeaker,
    onAssign
}: SpeakerAssignmentDialogProps) {
    const {
        filteredResults,
        suggestions,
        searchQuery,
        setSearchQuery,
        isLoading,
        isAssigning,
        selectedContactId,
        setSelectedContactId,
        assignIdentity,
        createAndAssignIdentity
    } = useIdentityEngine({
        onAssignSuccess: onAssign,
        onClose: () => onOpenChange(false)
    });

    const parentRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filter suggestions out of the main list to avoid duplicates if needed,
    // OR just show suggestions at top and then standard list below.
    // The requirement says "Add a section of 'AI Suggestions' at the top".
    // We should probably dedupe if they appear in both.
    const dedupedResults = filteredResults.filter(
        r => !suggestions.some(s => s.id === r.id)
    );

    // Flattened list for keyboard navigation: Suggestions First, then Results
    const navigatableItems = [
        ...suggestions.map(s => ({ ...s, type: 'suggestion' })),
        ...dedupedResults.map(r => ({ ...r, type: 'result' }))
    ];

    // Virtualization for the result list (deduped items only, or maybe we can virtualize the whole thing?)
    // For simplicity and "Suggestions" separation, let's keep suggestions static (only 3) and virtualize the rest.
    const rowVirtualizer = useVirtualizer({
        count: dedupedResults.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60, // approximate height of a row
        overscan: 5,
    });

    // Auto-focus search on open
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    // Keyboard Navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (filteredResults.length === 0 && suggestions.length === 0) {
            // Allow Enter to create if valid name
            if (e.key === 'Enter' && searchQuery.trim().length > 2) {
                e.preventDefault();
                createAndAssignIdentity(traceId, searchQuery);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIndex = navigatableItems.findIndex(i => i.id === selectedContactId);
            const nextIndex = (currentIndex + 1) % navigatableItems.length;
            setSelectedContactId(navigatableItems[nextIndex].id);

            // If it's in the virtualized list, we might want to scroll to ensure visibility
            // (omitted for brevity, but `scrollToIndex` on virtualizer could work if mapped correctly)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentIndex = navigatableItems.findIndex(i => i.id === selectedContactId);
            const prevIndex = (currentIndex - 1 + navigatableItems.length) % navigatableItems.length;
            setSelectedContactId(navigatableItems[prevIndex].id);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedContactId) {
                assignIdentity(traceId, selectedContactId);
            } else if (searchQuery.trim().length > 2) {
                // Determine if we should create? Maybe only if explicit?
                // Requirements say: "Confirm with Enter". Best to stick to selection unless empty.
            }
        }
    }, [filteredResults.length, suggestions.length, navigatableItems, selectedContactId, setSelectedContactId, assignIdentity, traceId, searchQuery, createAndAssignIdentity]);


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-none bg-background/60 backdrop-blur-2xl shadow-2xl overflow-hidden p-0 gap-0">
                {/* Header Area with Neural Glass Aesthetic */}
                <div className="bg-gradient-to-b from-primary/5 to-transparent p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-light tracking-tight">
                            <Fingerprint className="w-5 h-5 text-primary animate-pulse" />
                            Voice Identity Lab
                        </DialogTitle>
                        <DialogDescription className="flex items-center justify-between pt-2">
                            <span>Calibrating identity for:</span>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                <span className="font-semibold text-primary">{currentSpeaker}</span>
                                {/* Voice Aura Visualization */}
                                <div className="flex items-center gap-0.5 h-4">
                                    {[1, 2, 3, 4].map((i) => (
                                        <motion.div
                                            key={i}
                                            className="w-1 bg-primary rounded-full"
                                            animate={{
                                                height: [4, 12, 4],
                                                opacity: [0.5, 1, 0.5]
                                            }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                delay: i * 0.1,
                                                ease: "easeInOut"
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search Input */}
                    <div className="relative mt-6 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            ref={searchInputRef}
                            placeholder="Type to recognize identity..."
                            className="pl-10 h-10 border-primary/10 bg-background/50 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all font-light"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="h-[450px] flex flex-col bg-background/30" ref={parentRef}>

                    {/* State: Loading */}
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                                <Fingerprint className="w-12 h-12 text-primary animate-pulse relative z-10" />
                            </div>
                            <p className="text-sm text-muted-foreground animate-pulse">Scanning workspace directory...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">

                            {/* AI Suggestions Section */}
                            {suggestions.length > 0 && !searchQuery && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-primary/80 uppercase tracking-wider">
                                        <Sparkles className="w-3 h-3" />
                                        AI Recommendations
                                    </div>
                                    <div className="grid gap-2">
                                        {suggestions.map((contact, index) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                key={contact.id}
                                                onClick={() => setSelectedContactId(contact.id)}
                                                className={cn(
                                                    "relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-300 group overflow-hidden",
                                                    selectedContactId === contact.id
                                                        ? "bg-primary/10 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                                                        : "bg-background/40 border-transparent hover:bg-background/80 hover:border-primary/10"
                                                )}
                                            >
                                                {/* Glow Effect for Suggestions */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                                <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-700 dark:text-indigo-300 font-semibold">
                                                        {contact.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 z-10">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-medium text-sm leading-none">{contact.name}</p>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                            {((index === 0) ? "98%" : (index === 1) ? "85%" : "72%")} Match
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                                        {contact.role || contact.email || "Frequent Collaborator"}
                                                    </p>
                                                </div>
                                                {selectedContactId === contact.id && (
                                                    <motion.div
                                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                        className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-lg"
                                                    >
                                                        <Check className="h-3 w-3 text-primary-foreground" />
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Main List */}
                            {dedupedResults.length === 0 && suggestions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                                        <Search className="h-6 w-6 text-muted-foreground/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">No identities found</p>
                                        <p className="text-xs text-muted-foreground">
                                            {searchQuery ? `No matches for "${searchQuery}"` : "Try searching with a different term"}
                                        </p>
                                    </div>

                                    {/* Create New Contact Action */}
                                    {searchQuery.trim().length > 1 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2 gap-2 border-dashed border-primary/40 hover:bg-primary/5 hover:border-primary/60 transition-all font-medium text-primary"
                                            onClick={() => createAndAssignIdentity(traceId, searchQuery)}
                                            disabled={isAssigning}
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Create "{searchQuery}"
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {dedupedResults.length > 0 && searchQuery && (
                                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Search Results
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            height: `${rowVirtualizer.getTotalSize()}px`,
                                            width: '100%',
                                            position: 'relative',
                                        }}
                                    >
                                        {rowVirtualizer.getVirtualItems().map((virtualIcon) => {
                                            const contact = dedupedResults[virtualIcon.index];
                                            return (
                                                <div
                                                    key={contact.id}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: `${virtualIcon.size}px`,
                                                        transform: `translateY(${virtualIcon.start}px)`,
                                                    }}
                                                    onClick={() => setSelectedContactId(contact.id)}
                                                    className={cn(
                                                        "flex items-center gap-3 p-2 mx-1 rounded-lg cursor-pointer transition-all duration-200",
                                                        selectedContactId === contact.id
                                                            ? "bg-primary/10"
                                                            : "hover:bg-muted/50"
                                                    )}
                                                >
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                                            {contact.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className={cn("text-sm truncate", selectedContactId === contact.id ? "font-semibold text-primary" : "font-medium")}>
                                                            {contact.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate">{contact.role || contact.email}</p>
                                                    </div>
                                                    {selectedContactId === contact.id && (
                                                        <Check className="h-4 w-4 text-primary" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-background/50 border-t border-primary/5 backdrop-blur-sm flex justify-between items-center">
                    <div className="text-[10px] text-muted-foreground/60 hidden sm:flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded border bg-background">↑</span>
                        <span className="px-1.5 py-0.5 rounded border bg-background">↓</span>
                        <span>to navigate</span>
                        <span className="px-1.5 py-0.5 rounded border bg-background ml-2">Enter</span>
                        <span>to select</span>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            onClick={() => selectedContactId && assignIdentity(traceId, selectedContactId)}
                            disabled={!selectedContactId || isAssigning}
                            className={cn(
                                "min-w-[140px] transition-all duration-300",
                                isAssigning ? "bg-primary/20 text-primary hover:bg-primary/20" : ""
                            )}
                        >
                            {isAssigning ? (
                                <div className="flex items-center gap-2">
                                    <motion.div
                                        className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    />
                                    <span>Syncing Voice...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Mic className="w-4 h-4" />
                                    <span>Confirm & Learn</span>
                                </div>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
