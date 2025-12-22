import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Star, StarOff, Filter, ArrowDown, UserPlus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type TranscriptBlock } from "@/store/meetingStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { formatTime } from "@/utils/timeUtils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Contact } from "@/api/client";

// Memoized Transcript Block Component with animations
const TranscriptBlockCard = memo(({
    block,
    onToggleHighlight,
    index,
    searchQuery,
    onAssignSpeaker,
    contacts
}: {
    block: TranscriptBlock;
    onToggleHighlight: (id: string) => void;
    index: number;
    searchQuery: string;
    onAssignSpeaker: (traceId: string, contactId: string) => Promise<void>;
    contacts: Contact[];
}) => {
    const [isAssigning, setIsAssigning] = useState(false);

    const getSpeakerColor = (speaker: string) => {
        const colors = [
            "bg-blue-500/10 text-blue-500 border-blue-500/20",
            "bg-green-500/10 text-green-500 border-green-500/20",
            "bg-purple-500/10 text-purple-500 border-purple-500/20",
            "bg-orange-500/10 text-orange-500 border-orange-500/20",
            "bg-pink-500/10 text-pink-500 border-pink-500/20",
        ];
        const hash = speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    const getSentimentColor = (sentiment?: string) => {
        if (!sentiment) return "";
        switch (sentiment) {
            case 'positive': return "border-l-green-500";
            case 'negative': return "border-l-red-500";
            default: return "border-l-yellow-500";
        }
    };

    const handleSelectContact = async (contactId: string) => {
        if (!block.traceId) return;
        setIsAssigning(true);
        try {
            await onAssignSpeaker(block.traceId, contactId);
        } catch (error) {
            console.error("Failed to assign:", error);
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: index * 0.02
            }}
            className={cn(
                "p-4 rounded-lg border transition-all group border-l-4",
                block.isHighlighted
                    ? "bg-yellow-500/10 border-yellow-500/40 shadow-md"
                    : "bg-card border-border hover:border-primary/40 hover:shadow-sm",
                getSentimentColor(block.sentiment)
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">

                    {/* Inline Speaker Assignment Dropdown */}
                    {block.traceId ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <div
                                    className={cn("flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors outline-none", "hover:ring-1 ring-primary/30")}
                                    title="Click to assign speaker"
                                >
                                    <Badge variant="outline" className={cn("text-xs pointer-events-none", getSpeakerColor(block.speaker))}>
                                        {isAssigning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                        {block.speaker}
                                    </Badge>
                                    <UserPlus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                                <DropdownMenuLabel>Assign "{block.speaker}" to...</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {contacts.length === 0 ? (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No contacts found</div>
                                ) : (
                                    contacts.map((contact) => (
                                        <DropdownMenuItem
                                            key={contact.id}
                                            onClick={() => handleSelectContact(contact.id)}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Avatar className="h-5 w-5">
                                                <AvatarFallback className="text-[10px]">
                                                    {contact.name.substring(0, 1)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate flex-1">{contact.name}</span>
                                            {block.speaker === contact.name && <Check className="h-3 w-3 text-primary" />}
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        /* No Trace ID - Non-clickable Badge */
                        <div className="flex items-center gap-1 px-1 -ml-1">
                            <Badge variant="outline" className={cn("text-xs", getSpeakerColor(block.speaker))}>
                                {block.speaker}
                            </Badge>
                        </div>
                    )}

                    <span className="text-xs text-muted-foreground">
                        {formatTime(block.timestamp)}
                    </span>
                    {block.topic && (
                        <Badge variant="secondary" className="text-xs">
                            {block.topic}
                        </Badge>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onToggleHighlight(block.id)}
                    title={block.isHighlighted ? "Remove highlight" : "Highlight"}
                >
                    {block.isHighlighted ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                        <StarOff className="h-4 w-4" />
                    )}
                </Button>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
                {searchQuery.trim() ? (
                    block.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                            <mark key={i} className="bg-yellow-500/30 text-foreground px-0.5 rounded">
                                {part}
                            </mark>
                        ) : part
                    )
                ) : (
                    block.text
                )}
            </p>
        </motion.div>
    );
});

TranscriptBlockCard.displayName = "TranscriptBlockCard";

export function TranscriptPane() {
    const { transcriptBlocks, toggleHighlight, partialTranscript } = useMeetingStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [showOnlyHighlights, setShowOnlyHighlights] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showJumpToLive, setShowJumpToLive] = useState(false);
    const parentRef = useRef<HTMLDivElement>(null);

    // Reactive Contacts State from Store
    const contacts = useWorkspaceStore((state) => state.contacts);

    useEffect(() => {
        // Ensure contacts are loaded
        useWorkspaceStore.getState().fetchContacts();
    }, []);

    const handleAssignSpeaker = useCallback(async (traceId: string, contactId: string) => {
        try {
            const response = await fetch('/api/voice/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trace_id: traceId,
                    contact_id: contactId
                })
            });

            if (!response.ok) throw new Error('Failed to assign speaker');

            // Note: Backend broadcast will update the UI via WebSocket
        } catch (error) {
            console.error("Assignment failed:", error);
        }
    }, []);

    const filteredBlocks = useMemo(() => {
        let filtered = transcriptBlocks;

        if (showOnlyHighlights) {
            filtered = filtered.filter(block => block.isHighlighted);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(block =>
                block.text.toLowerCase().includes(query) ||
                block.speaker.toLowerCase().includes(query) ||
                block.topic?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [transcriptBlocks, searchQuery, showOnlyHighlights]);

    // Virtual scrolling
    const virtualizer = useVirtualizer({
        count: filteredBlocks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
        overscan: 5,
    });

    // Auto-scroll detection
    const checkScrollPosition = useCallback(() => {
        if (!parentRef.current) return;

        // Use setTimeout to defer state updates to the next tick
        setTimeout(() => {
            if (!parentRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

            setIsAtBottom(prev => {
                if (prev === isNearBottom) return prev;
                return isNearBottom;
            });

            const shouldShowJump = !isNearBottom && transcriptBlocks.length > 0;
            setShowJumpToLive(prev => {
                if (prev === shouldShowJump) return prev;
                return shouldShowJump;
            });
        }, 0);
    }, [transcriptBlocks.length]);

    useEffect(() => {
        const scrollElement = parentRef.current;
        if (!scrollElement) return;

        scrollElement.addEventListener('scroll', checkScrollPosition);
        checkScrollPosition();

        return () => {
            scrollElement.removeEventListener('scroll', checkScrollPosition);
        };
    }, [checkScrollPosition]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (isAtBottom && filteredBlocks.length > 0 && parentRef.current) {
            const scrollElement = parentRef.current;
            scrollElement.scrollTo({
                top: scrollElement.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [filteredBlocks.length, isAtBottom]);

    const handleToggleHighlight = useCallback((blockId: string) => {
        toggleHighlight(blockId);
    }, [toggleHighlight]);

    const jumpToLive = useCallback(() => {
        if (parentRef.current) {
            parentRef.current.scrollTo({
                top: parentRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, []);


    return (
        <div className="flex flex-col h-full">
            {/* Header with Filters */}
            <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Live Transcript</h3>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="highlights-only" className="text-xs text-muted-foreground cursor-pointer">
                            Highlights only
                        </Label>
                        <Switch
                            id="highlights-only"
                            checked={showOnlyHighlights}
                            onCheckedChange={setShowOnlyHighlights}
                            aria-label="Show only highlighted transcript blocks"
                        />
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <Input
                        placeholder="Search transcript..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background"
                        aria-label="Search transcript"
                    />
                </div>
            </div>

            {/* Transcript Blocks with Virtual Scrolling */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto p-4 relative min-h-0"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--muted) var(--background)' }}
                role="log"
                aria-label="Live transcript"
                aria-live="polite"
                aria-atomic="false"
            >
                {filteredBlocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground animate-in fade-in duration-500" role="status" aria-live="polite">
                        <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4" aria-hidden="true">
                            <Filter className="h-6 w-6" />
                        </div>
                        <p className="text-sm">
                            {transcriptBlocks.length === 0
                                ? "Transcript will appear here when the meeting starts"
                                : "No blocks match your filters"}
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${filteredBlocks.length > 0 ? virtualizer.getTotalSize() : 0}px`,
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
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    <div
                                        ref={virtualizer.measureElement}
                                        data-index={virtualItem.index}
                                        className="p-2"
                                        data-timestamp={block.timestamp}
                                        data-block-id={block.id}
                                    >
                                        <TranscriptBlockCard
                                            block={block}
                                            onToggleHighlight={handleToggleHighlight}
                                            index={virtualItem.index}
                                            searchQuery={searchQuery}
                                            onAssignSpeaker={handleAssignSpeaker}
                                            contacts={contacts}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Partial Transcript Display */}
                {partialTranscript && (
                    <div className="mt-4 px-2 pb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 animate-pulse">
                                    {partialTranscript.speaker || "Speaking..."}
                                </Badge>
                                <span className="text-xs text-muted-foreground italic">
                                    Typing...
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed text-foreground/80 italic">
                                {partialTranscript.text}
                            </p>
                        </div>
                    </div>
                )}

                {/* Jump to Live Button */}
                <AnimatePresence>
                    {showJumpToLive && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-4 right-4"
                        >
                            <Button
                                onClick={jumpToLive}
                                size="sm"
                                className="gap-2 shadow-lg backdrop-blur-sm bg-card/90 border border-border"
                            >
                                <ArrowDown className="h-4 w-4" />
                                Jump to Live
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
