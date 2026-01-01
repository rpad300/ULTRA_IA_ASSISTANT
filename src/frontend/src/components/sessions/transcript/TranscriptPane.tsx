import { useState, useMemo, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import Fuse from "fuse.js";
import { Search, Filter, ArrowDown } from "lucide-react";

import { useMeetingStore } from "@/store/meetingStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceApi } from "@/api/client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { TranscriptBlockCard } from "./TranscriptBlockCard";
import { CreateContactDialog } from "./CreateContactDialog";
import { useTranscriptScroll } from "./useTranscriptScroll";

export function TranscriptPane() {
    // Stores
    const {
        transcriptBlocks,
        toggleHighlight,
        partialTranscript,
        sessionId,
        searchQuery,
        showOnlyHighlights,
        setSearchQuery,
        toggleShowOnlyHighlights
    } = useMeetingStore();

    const { contacts, fetchContacts, companies, fetchCompanies } = useWorkspaceStore();

    // Local State
    const parentRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Create Contact Dialog State
    const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
    const [createContactForBlockId, setCreateContactForBlockId] = useState<string | null>(null);

    // Deep Linking State
    const { focusedBlockId } = useMeetingStore();

    // Initial Data Loading
    useEffect(() => {
        const load = async () => {
            try {
                await Promise.all([
                    companies.length === 0 ? fetchCompanies() : Promise.resolve(),
                    contacts.length === 0 ? fetchContacts() : Promise.resolve()
                ]);
            } finally {
                // Simulate a slight delay or wait for actual data if we had a loading state for blocks
                // For now, we assume if we are mounting, we might be waiting for connection
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // --- Search Logic (Fuse.js) ---
    // Memoize the Fuse instance so we don't recreate it on every render
    const fuseIndex = useMemo(() => {
        return new Fuse(transcriptBlocks, {
            keys: ['text', 'speaker', 'topic'],
            threshold: 0.3, // Fuzzy threshold
            ignoreLocation: true
        });
    }, [transcriptBlocks]);

    // Derived State: Filtered Blocks
    const filteredBlocks = useMemo(() => {
        let result = transcriptBlocks;

        if (showOnlyHighlights) {
            result = result.filter(b => b.isHighlighted);
        }

        if (searchQuery.trim()) {
            // Fuse Search
            const searchResults = fuseIndex.search(searchQuery);
            result = searchResults.map(r => r.item);

            // If strictly creating a subset, Fuse is great.
            // If we wanted to keep order but just highlight, we'd need a different strategy,
            // but for a "Search results" view, returning the matches is standard.
            // However, typical transcript search just highlights and scrolls.
            // The user requested "Fuzzy Search".
            // If we filter out blocks, context is lost.
            // Let's stick to filtering for "Search Mode" as per original implementation logic
            // but upgraded with Fuse.

            // OPTIONAL SOTA TWEAK: Maybe just filter if the score is high enough?
            // Already handled by map above.
        }

        return result;
    }, [transcriptBlocks, searchQuery, showOnlyHighlights, fuseIndex]);


    // --- Virtualization ---
    const virtualizer = useVirtualizer({
        count: filteredBlocks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 120, // Slightly higher estimate for cards
        overscan: 5,
        onChange: () => {
            // Optional: fine-tuning scroll behavior
        }
    });

    // --- Scroll Hook ---
    const { showJumpToLive, jumpToLive } = useTranscriptScroll({
        parentRef,
        dataLength: filteredBlocks.length
    });

    // ResizeObserver for Orientation Changes (Mobile)
    useEffect(() => {
        if (!parentRef.current) return;
        const ro = new ResizeObserver(() => {
            virtualizer.measure();
        });
        ro.observe(parentRef.current);
        return () => ro.disconnect();
    }, [virtualizer]);

    // --- Deep Linking Effect ---
    useEffect(() => {
        if (focusedBlockId && filteredBlocks.length > 0) {
            const index = filteredBlocks.findIndex(b => b.id === focusedBlockId);
            if (index !== -1) {
                // Scroll to item
                virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });

                // Optional: Clear focus after animation delay to allow re-focusing same block if clicked again
                const timer = setTimeout(() => {
                    // We keep it in store? Or clear it? 
                    // If we clear it, the highlight might disappear too quickly if we use focusedBlockId for styling.
                    // Let's keep it but maybe have a local "flash" state if needed.
                    // For now, we'll let the user manually clear or just click another.
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [focusedBlockId, filteredBlocks, virtualizer]);


    // --- Actions ---
    // --- Actions ---

    const handleAssignSpeaker = async (blockId: string, contactId: string) => {
        if (!sessionId) return;
        const block = transcriptBlocks.find(b => b.id === blockId);
        if (!block) return;

        try {
            await workspaceApi.assignGuest(contactId, block.speaker, sessionId);
            // Optimistic update handled by store/socket usually
        } catch (error) {
            console.error("Assignment failed", error);
        }
    };

    const handleCreateContactRequest = (blockId: string) => {
        setCreateContactForBlockId(blockId);
        setIsCreateContactOpen(true);
    };

    const handleContactCreated = async (newContactId: string) => {
        // Refresh contacts logic is inside store/dialog usually, but ensure we have latest
        await fetchContacts();
        if (createContactForBlockId) {
            handleAssignSpeaker(createContactForBlockId, newContactId);
        }
        setCreateContactForBlockId(null);
    };


    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Header: Responsive Stacking */}
            <div className="p-3 md:p-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0 flex flex-col md:flex-row gap-3 md:items-center justify-between z-10 transition-all duration-300">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        Live Transcript
                        {transcriptBlocks.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5">{transcriptBlocks.length}</Badge>
                        )}
                    </h3>

                    {/* Mobile Only: Quick Toggles (if space is tight) */}
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Fuzzy search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-background/50 focus:bg-background transition-colors"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2">
                        <Label htmlFor="highlights-only" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                            Highlights only
                        </Label>
                        <Switch
                            id="highlights-only"
                            checked={showOnlyHighlights}
                            onCheckedChange={toggleShowOnlyHighlights}
                        />
                    </div>
                </div>
            </div>

            {/* Virtual Scroll Container */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto px-2 md:px-4 py-2 relative min-h-0 scroll-smooth"
                style={{ scrollbarWidth: 'thin' }}
            >
                {/* Skeleton Loading State */}
                {isLoading && transcriptBlocks.length === 0 && (
                    <div className="space-y-4 p-2 animate-pulse">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-16" />
                                    <Skeleton className="h-4 w-12" />
                                </div>
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && filteredBlocks.length === 0 && !partialTranscript && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                        <div className="h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center animate-pulse">
                            <Filter className="h-8 w-8 opacity-50" />
                        </div>
                        <div className="text-center max-w-[200px]">
                            <p className="text-sm font-medium">No transcript yet</p>
                            <p className="text-xs opacity-70 mt-1">
                                {searchQuery ? "Try adjusting your search filters" : "Waiting for conversation to start..."}
                            </p>
                        </div>
                    </div>
                )}

                {/* List */}
                {filteredBlocks.length > 0 && (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                            const block = filteredBlocks[virtualItem.index];
                            return (
                                <div
                                    key={virtualItem.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                    ref={virtualizer.measureElement}
                                    data-index={virtualItem.index}
                                    className="py-1.5"
                                >
                                    <TranscriptBlockCard
                                        block={block}
                                        index={virtualItem.index}
                                        searchQuery={searchQuery}
                                        onAssignSpeaker={handleAssignSpeaker}
                                        onToggleHighlight={toggleHighlight}
                                        isFocused={block.id === focusedBlockId}
                                        contacts={contacts}
                                        onCreateContact={handleCreateContactRequest}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Partial Transcript (Live Buffer) */}
                <AnimatePresence>
                    {partialTranscript && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="mt-4 mb-2 sticky bottom-0 z-10"
                        >
                            <div className="p-3 md:p-4 rounded-lg border border-dashed border-primary/30 bg-background/80 backdrop-blur-md shadow-lg mx-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 flex gap-1 items-center">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </span>
                                        {partialTranscript.speaker || "Speaking..."}
                                    </Badge>
                                </div>
                                <p className="text-sm leading-relaxed text-foreground/80 font-medium font-mono">
                                    {partialTranscript.text}
                                    <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary/50 animate-pulse" />
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Jump to Live Button - Safe Area Aware */}
            <AnimatePresence>
                {showJumpToLive && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-8 z-20 pb-[env(safe-area-inset-bottom)]"
                    >
                        <Button
                            onClick={jumpToLive}
                            size="sm"
                            className="shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-2 rounded-full px-4 h-9 shadow-primary/20"
                        >
                            <ArrowDown className="h-4 w-4" />
                            Jump to Live
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dialogs */}
            <CreateContactDialog
                open={isCreateContactOpen}
                onOpenChange={setIsCreateContactOpen}
                companies={companies}
                onSuccess={handleContactCreated}
            />
        </div>
    );
}
