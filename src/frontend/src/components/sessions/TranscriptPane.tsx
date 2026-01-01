import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Star, StarOff, Filter, ArrowDown, UserPlus, Check, Loader2, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type TranscriptBlock } from "@/store/meetingStore";
import { toBrand } from "@/types/slices/intelligence";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { formatTime } from "@/utils/timeUtils";
// Virtual scrolling removed in favor of full render
// const virtualizer = ...
import { motion, AnimatePresence } from "framer-motion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Contact } from "@/api/client";
import { workspaceApi } from "@/api/client";

// Memoized Transcript Block Component with animations
const TranscriptBlockCard = memo(({
    block,
    onToggleHighlight,
    index,
    searchQuery,
    onAssignSpeaker,
    contacts,
    onCreateContact,
    isFocused,
    isChapterFocused
}: {
    block: TranscriptBlock;
    onToggleHighlight: (id: string) => void;
    index: number;
    searchQuery: string;
    onAssignSpeaker: (blockId: string, contactId: string) => Promise<void>;
    contacts: Contact[];
    onCreateContact: (blockId: string) => void;
    isFocused?: boolean;
    isChapterFocused?: boolean;
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
        // SOTA Fix: Allow assignment even without traceId (Native Mode)
        setIsAssigning(true);
        try {
            await onAssignSpeaker(block.id, contactId);
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
                "p-4 rounded-lg border transition-all duration-500 group border-l-4",
                isFocused
                    ? "bg-primary/20 border-primary shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)] scale-[1.02] z-10"
                    : isChapterFocused
                        ? "bg-primary/5 border-primary/30 shadow-[0_0_15px_-5px_rgba(var(--primary),0.15)] z-0" // Chapter Aura
                        : block.isHighlighted
                            ? "bg-yellow-500/10 border-yellow-500/40 shadow-md"
                            : "bg-card border-border hover:border-primary/40 hover:shadow-sm",
                getSentimentColor(block.sentiment)
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">

                    {/* Inline Speaker Assignment Dropdown - Enabled for all blocks */}
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
                        <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto">
                            <DropdownMenuLabel>Assign "{block.speaker}" to...</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => onCreateContact(block.id)}
                                className="flex items-center gap-2 cursor-pointer text-primary focus:text-primary focus:bg-primary/10"
                            >
                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Plus className="h-3 w-3" />
                                </div>
                                <span className="font-medium">Create new contact</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {contacts.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">No existing contacts</div>
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
                    block.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part: string, i: number) =>
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
    const {
        transcriptBlocks,
        toggleHighlight,
        partialTranscript,
        sessionId,
        topicClusters, // SOTA: For Chapter Aura
        // Search & Filter
        searchQuery,
        showOnlyHighlights,
        speakerFilter,
        focusedBlockId,
        setSearchQuery,
        toggleShowOnlyHighlights,
        setSpeakerFilter,
        setFocusedBlockId
    } = useMeetingStore();
    const { contacts, fetchContacts, companies, fetchCompanies } = useWorkspaceStore();


    // Create Contact State
    const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
    const [newContactName, setNewContactName] = useState("");
    const [newContactEmail, setNewContactEmail] = useState("");
    const [newContactRole, setNewContactRole] = useState("");
    const [newContactPhone, setNewContactPhone] = useState("");
    const [newContactCompanyId, setNewContactCompanyId] = useState("");
    const [creatingContactForBlockId, setCreatingContactForBlockId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        // Ensure companies are loaded for the dropdown
        if (companies.length === 0) fetchCompanies();
    }, [companies.length, fetchCompanies]);

    // Scroll handling ref and state
    const parentRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showJumpToLive, setShowJumpToLive] = useState(false);

    // activeChapterBlocks Logic using useMemo
    const activeChapterBlocks = useMemo(() => {
        if (!focusedBlockId || !topicClusters) return new Set();
        const activeCluster = topicClusters.find(c => c.blocks.includes(toBrand<import('@/types/slices/intelligence').BlockId>(focusedBlockId)));
        return activeCluster ? new Set(activeCluster.blocks) : new Set();
    }, [focusedBlockId, topicClusters]);

    const handleAssignSpeaker = useCallback(async (blockId: string, contactId: string) => {
        if (!sessionId) {
            console.error("No active session ID found for assignment");
            return;
        }

        // Find the block to get the guest ID (speaker name)
        // SOTA Fix: Use block.id for reliable lookup even if traceId is missing (Native Mode)
        const block = transcriptBlocks.find(b => b.id === blockId);
        if (!block) return;

        const guestId = block.speaker; // "Guest 1"

        try {
            await workspaceApi.assignGuest(contactId, guestId, sessionId);
            // Optimistic UI update could happen here, or wait for socket event
            console.log(`Assigned ${guestId} to contact ${contactId}`);
        } catch (error) {
            console.error("Assignment failed:", error);
        }
    }, [sessionId, transcriptBlocks]);

    const handleCreateContactRequest = useCallback((blockId: string) => {
        setCreatingContactForBlockId(blockId);
        setNewContactName("");
        setNewContactEmail("");
        setNewContactRole("");
        setNewContactPhone("");
        setNewContactCompanyId("");
        setIsCreateContactOpen(true);
    }, []);

    const handleCreateContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!creatingContactForBlockId) return;

        // Validation
        if (!newContactName.trim() || !newContactEmail.trim() || !newContactRole.trim() || !newContactPhone.trim() || !newContactCompanyId) {
            alert("All fields are mandatory. Please fill in Name, Email, Role, Phone, and Company.");
            return;
        }

        setIsCreating(true);
        try {
            // 1. Create Contact
            const newContact = await workspaceApi.createContact({
                name: newContactName,
                email: newContactEmail,
                role: newContactRole,
                phone: newContactPhone,
                company_id: newContactCompanyId || undefined,
                status: 'active'
            });

            // 2. Refresh assignment list
            await fetchContacts();

            // 3. Assign
            await handleAssignSpeaker(creatingContactForBlockId, newContact.id);

            setIsCreateContactOpen(false);
            setIsCreateContactOpen(false);
        } catch (error: any) {
            console.error("Failed to create contact:", error);
            const msg = error.response?.data?.detail || "Failed to create contact. Please try again.";
            alert(msg); // Basic alert for now, can be improved with UI toast later
        } finally {
            setIsCreating(false);
        }
    };


    const filteredBlocks = useMemo(() => {
        let filtered = transcriptBlocks;

        if (speakerFilter) {
            filtered = filtered.filter(block =>
                block.speaker === speakerFilter ||
                block.speakerId === speakerFilter
            );
        }

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
    }, [transcriptBlocks, searchQuery, showOnlyHighlights, speakerFilter]);



    // Deep Linking Scroll Effect
    useEffect(() => {
        if (focusedBlockId && filteredBlocks.length > 0) {
            // Native DOM scroll
            const element = document.querySelector(`[data-block-id="${focusedBlockId}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setIsAtBottom(false);
                const timer = setTimeout(() => setFocusedBlockId(null), 10000);
                return () => clearTimeout(timer);
            }
        }
    }, [focusedBlockId, filteredBlocks, setFocusedBlockId]);

    // Auto-scroll detection & Viewport Sync
    const checkScrollPosition = useCallback(() => {
        // Use window scroll
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;

        // "Near bottom" = within 200px of bottom
        const isNearBottom = docHeight - (scrollTop + windowHeight) < 200;

        setIsAtBottom(prev => {
            if (prev === isNearBottom) return prev;
            return isNearBottom;
        });

        // Show jump button if we are NOT at bottom and there is content
        const shouldShowJump = !isNearBottom && transcriptBlocks.length > 0;
        setShowJumpToLive(prev => {
            if (prev === shouldShowJump) return prev;
            return shouldShowJump;
        });

        // SOTA: Calculate Visible Time Range (Simplified for full render)
        // We can just find the blocks in the viewport using DOM rects or approximation
        // For now, disabling precise viewport tracking to prevent overhead in full render mode
        // Future opt: Use IntersectionObserver on first/last blocks
    }, [transcriptBlocks.length]);

    useEffect(() => {
        window.addEventListener('scroll', checkScrollPosition);
        // Initial check
        checkScrollPosition();
        return () => window.removeEventListener('scroll', checkScrollPosition);
    }, [checkScrollPosition]);

    // Auto-scroll to bottom
    // Auto-scroll to bottom
    useEffect(() => {
        if (isAtBottom && filteredBlocks.length > 0) {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [filteredBlocks.length, isAtBottom]);

    const handleToggleHighlight = useCallback((blockId: string) => {
        toggleHighlight(blockId);
    }, [toggleHighlight]);

    const jumpToLive = useCallback(() => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
    }, []);


    return (
        <div className="flex flex-col w-full bg-background rounded-xl">
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
                            onCheckedChange={toggleShowOnlyHighlights}
                            aria-label="Show only highlighted transcript blocks"
                        />
                    </div>
                </div>

                {speakerFilter && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between bg-primary/10 text-primary px-3 py-2 rounded-md text-xs"
                    >
                        <span>Filtered by: <span className="font-semibold">{speakerFilter}</span></span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 hover:bg-primary/20 text-primary"
                            onClick={() => setSpeakerFilter(null)}
                        >
                            Reset
                        </Button>
                    </motion.div>
                )}

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
                className="w-full relative p-4"
                role="log"
                aria-label="Live transcript"
                aria-live="polite"
                aria-atomic="false"
            >
                {filteredBlocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground animate-in fade-in duration-500" role="status" aria-live="polite">
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
                    <div className="flex flex-col w-full relative">
                        {filteredBlocks.map((block, index) => (
                            <div
                                key={block.id}
                                className="p-2"
                                data-timestamp={block.timestamp}
                                data-block-id={block.id}
                            >
                                <TranscriptBlockCard
                                    block={block}
                                    onToggleHighlight={handleToggleHighlight}
                                    index={index}
                                    searchQuery={searchQuery}
                                    onAssignSpeaker={handleAssignSpeaker}
                                    contacts={contacts}
                                    onCreateContact={handleCreateContactRequest}
                                    isFocused={focusedBlockId === block.id}
                                    isChapterFocused={activeChapterBlocks.has(block.id)}
                                />
                            </div>
                        ))}
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

            {/* Create Contact Dialog */}
            <Dialog open={isCreateContactOpen} onOpenChange={setIsCreateContactOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Contact</DialogTitle>
                        <DialogDescription>
                            Create a new contact to assign this speaker voice to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="contact-name">Name *</Label>
                            <div className="relative">
                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="contact-name"
                                    placeholder="John Doe"
                                    className="pl-9"
                                    value={newContactName}
                                    onChange={(e) => setNewContactName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact-email">Email *</Label>
                            <Input
                                id="contact-email"
                                type="email"
                                placeholder="john@example.com"
                                className="col-span-3"
                                value={newContactEmail}
                                onChange={(e) => setNewContactEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact-role">Role *</Label>
                                <Input
                                    id="contact-role"
                                    placeholder="Product Manager"
                                    value={newContactRole}
                                    onChange={(e) => setNewContactRole(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-phone">Phone *</Label>
                                <Input
                                    id="contact-phone"
                                    placeholder="+1 234 567 8900"
                                    value={newContactPhone}
                                    onChange={(e) => setNewContactPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact-company">Company *</Label>
                            <select
                                id="contact-company"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={newContactCompanyId}
                                onChange={(e) => setNewContactCompanyId(e.target.value)}
                            >
                                <option value="">Select a company</option>
                                {companies.map(company => (
                                    <option key={company.id} value={company.id}>
                                        {company.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsCreateContactOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateContactSubmit} disabled={isCreating || !newContactName.trim()}>
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

