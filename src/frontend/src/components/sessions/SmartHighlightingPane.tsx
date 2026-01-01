import { useState, useMemo, useEffect } from "react";
import { toBrand } from '@/types/slices/intelligence';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Bookmark,
    Zap,
    Target,
    AlertTriangle,
    HelpCircle,
    Lightbulb,
    Layers,
    BrainCircuit,
    Pin,
    Copy,
    ChevronDown,
    ChevronRight,
    Share2,
    Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useHighlightEngine } from "@/hooks/useHighlightEngine";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// --- Types ---


// --- Sub-components ---

const ContextMinimap = ({
    startTime,
    endTime,
    sessionStart,
    sessionDuration
}: {
    startTime: number;
    endTime: number;
    sessionStart: number;
    sessionDuration: number;
}) => {
    // Calculate relative position 0-100%
    // Avoid division by zero
    const duration = Math.max(sessionDuration, 1);
    // If inputs are ms, ensure consistency. usually meetingStore has ms for startTime, duration might be seconds from timer.
    // Let's assume input timestamps are ms. sessionDuration is usually seconds in store.
    // Adjust:
    const safeDurationMs = duration * 1000;
    const sP = Math.max(0, Math.min(100, ((startTime - sessionStart) / safeDurationMs) * 100));
    const widthP = Math.max(5, Math.min(100, ((endTime - startTime) / safeDurationMs) * 100));

    return (
        <div className="h-1.5 w-24 bg-muted/30 rounded-full overflow-hidden relative flex items-center">
            <div
                className="absolute h-full bg-primary/40 rounded-full"
                style={{
                    left: `${sP}% `,
                    width: `${widthP}% `
                }}
            />
        </div>
    );
};

export function SmartHighlightingPane() {
    // Optimized selectors to prevent "getSnapshot" infinite loops
    const highlightGroups = useMeetingStore(state => state.highlightGroups);
    const transcriptBlocks = useMeetingStore(state => state.transcriptBlocks);
    const sessionStartTime = useMeetingStore(state => state.startTime || 0);
    const elapsedTime = useMeetingStore(state => state.elapsedTime);
    const setFocusedBlockId = useMeetingStore(state => state.setFocusedBlockId);


    const { isProcessing, triggerGrouping } = useHighlightEngine();

    // UI State
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [filterPerson, setFilterPerson] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<string | null>(null); // 'decision', 'action' etc.
    const [pinnedGroups, setPinnedGroups] = useState<string[]>([]);
    const [showHighlightsOnly, setShowHighlightsOnly] = useState(false);

    // Helpers
    const toggleGroup = (id: string) => {
        setExpandedGroups(prev =>
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const togglePin = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPinnedGroups(prev =>
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const handleCopyCollection = (group: typeof highlightGroups[0], blocks: typeof transcriptBlocks) => {
        const text = blocks.map(b => `[${format(b.timestamp, 'HH:mm')}] ${b.speaker}: ${b.text} `).join('\n\n');
        const header = `# ${group.name} \nType: ${group.category.toUpperCase()} \n\n`;
        navigator.clipboard.writeText(header + text);
        // Simple visual feedback could be added here
    };

    const handleJump = (blockId: string) => {
        setFocusedBlockId(blockId);
    };

    // Speakers extraction for filter
    const speakers = useMemo(() => {
        const set = new Set<string>();
        highlightGroups.forEach(g => {
            const blocks = transcriptBlocks.filter(b => g.blockIds.includes(toBrand<import('@/types/slices/intelligence').BlockId>(b.id)));
            blocks.forEach(b => set.add(b.speaker));
        });
        return Array.from(set);
    }, [highlightGroups, transcriptBlocks]);

    // Keyboard Shortcut 'H'
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'h' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                setShowHighlightsOnly(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Filter Logic
    const filteredGroups = useMemo(() => {
        let groups = [...highlightGroups];

        // 1. Filter by Type
        if (filterType) {
            groups = groups.filter(g => g.category === filterType);
        }

        // 2. Filter by Person
        if (filterPerson) {
            groups = groups.filter(g => {
                const blocks = transcriptBlocks.filter(b => g.blockIds.includes(toBrand<import('@/types/slices/intelligence').BlockId>(b.id)));
                return blocks.some(b => b.speaker === filterPerson);
            });
        }

        // 3. Sort: Pinned first, then time desc
        groups.sort((a, b) => {
            const isAPinned = pinnedGroups.includes(a.id);
            const isBPinned = pinnedGroups.includes(b.id);
            if (isAPinned && !isBPinned) return -1;
            if (!isAPinned && isBPinned) return 1;
            return b.createdAt - a.createdAt;
        });

        return groups;

    }, [highlightGroups, filterType, filterPerson, pinnedGroups, transcriptBlocks]);

    // Categories config
    const categoryConfig = {
        decision: { color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: Target },
        action: { color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', icon: Zap },
        risk: { color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: AlertTriangle },
        insight: { color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', icon: Lightbulb },
        question: { color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: HelpCircle },
        other: { color: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-500/10', icon: Layers },
    };

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            {/* Header / Command Bar */}
            <div className="shrink-0 p-4 border-b border-white/5 bg-white/5 backdrop-blur-md flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Bookmark className={cn("h-5 w-5 text-primary", isProcessing && "animate-pulse")} />
                            {isProcessing && (
                                <motion.div
                                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary"
                                    layoutId="processing-dot"
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                            )}
                        </div>
                        <h3 className="font-semibold text-sm tracking-tight">Curation Engine</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={showHighlightsOnly ? "secondary" : "ghost"}
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setShowHighlightsOnly(!showHighlightsOnly)}
                                    >
                                        <Filter className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Show Only Highlights (H)</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground/70 hover:text-primary"
                                        onClick={triggerGrouping}
                                        disabled={isProcessing}
                                    >
                                        <BrainCircuit className={cn("h-4 w-4", isProcessing && "animate-spin")} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Synthesize Now</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant={filterPerson ? "default" : "outline"} size="sm" className="h-6 text-xs rounded-full px-3 border-dashed">
                                {filterPerson || "Anyone"}
                                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => setFilterPerson(null)}>Anyone</DropdownMenuItem>
                            {speakers.map(s => (
                                <DropdownMenuItem key={s} onClick={() => setFilterPerson(s)}>
                                    {s}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="h-4 w-[1px] bg-border mx-1" />

                    <Button
                        variant={filterType === null ? "secondary" : "ghost"}
                        size="sm"
                        className="h-6 text-xs rounded-full px-3"
                        onClick={() => setFilterType(null)}
                    >
                        All
                    </Button>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                        <Button
                            key={key}
                            variant={filterType === key ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-6 text-xs rounded-full px-3 gap-1.5 transition-colors",
                                filterType === key ? config.bg + " " + config.color : "text-muted-foreground"
                            )}
                            onClick={() => setFilterType(key as any)}
                        >
                            <config.icon className="h-3 w-3" />
                            <span className="capitalize">{key}</span>
                        </Button>
                    ))}
                </div>
            </div>

            {/* Content Stream */}
            <ScrollArea className="flex-1 px-3 py-3">
                <div className="space-y-3 min-h-[200px]">
                    <AnimatePresence initial={false}>
                        {filteredGroups.map((group, index) => {
                            const blocks = transcriptBlocks.filter(b => group.blockIds.includes(toBrand<import('@/types/slices/intelligence').BlockId>(b.id)));
                            if (blocks.length === 0) return null;
                            const isExpanded = expandedGroups.includes(group.id);
                            const Config = categoryConfig[group.category] || categoryConfig.other;
                            const isPinned = pinnedGroups.includes(group.id);
                            const firstBlockTime = blocks[0]?.timestamp || 0;
                            const lastBlockTime = blocks[blocks.length - 1]?.timestamp || 0;

                            return (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05, type: 'spring', stiffness: 350, damping: 25 }}
                                    className={cn(
                                        "group border rounded-xl overflow-hidden transition-all duration-300",
                                        "bg-card/40 backdrop-blur-md hover:bg-card/60",
                                        Config.border,
                                        isExpanded ? "shadow-lg shadow-black/10 ring-1 ring-white/10" : ""
                                    )}
                                >
                                    {/* Header */}
                                    <div
                                        className="p-3 cursor-pointer flex flex-col gap-2"
                                        onClick={() => toggleGroup(group.id)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className={cn(
                                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                                    Config.bg, Config.color
                                                )}>
                                                    <Config.icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-medium leading-tight text-foreground/90 line-clamp-2">
                                                        {group.name}
                                                    </h4>
                                                    <div className="flex items-center gap-3 mt-1.5 opacity-60">
                                                        <span className="text-[10px] uppercase tracking-wider font-semibold">
                                                            {group.category}
                                                        </span>
                                                        <div className="h-0.5 w-0.5 rounded-full bg-current" />
                                                        <span className="text-xs">
                                                            {blocks.length} {blocks.length === 1 ? 'item' : 'items'}
                                                        </span>

                                                        {/* Context Timeline */}
                                                        <div className="ml-auto opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <ContextMinimap
                                                                startTime={firstBlockTime}
                                                                endTime={lastBlockTime}
                                                                sessionStart={sessionStartTime || 0}
                                                                sessionDuration={elapsedTime}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("h-7 w-7", isPinned && "text-primary")}
                                                    onClick={(e) => togglePin(group.id, e)}
                                                >
                                                    <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={(e) => { e.stopPropagation(); handleCopyCollection(group, blocks); }}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                                <div className="h-7 w-7 flex items-center justify-center">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4 opacity-50 block" /> : <ChevronRight className="h-4 w-4 opacity-50 block" />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="border-t border-white/5 bg-black/5"
                                            >
                                                <div className="p-3 space-y-2">
                                                    {blocks.map((block) => (
                                                        <div
                                                            key={block.id}
                                                            className="text-xs p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer group/block"
                                                            onClick={() => handleJump(block.id)}
                                                        >
                                                            <div className="flex items-center justify-between mb-1 opacity-50 text-[10px]">
                                                                <span>{block.speaker}</span>
                                                                <span className="group-hover/block:text-primary transition-colors">Jump to context →</span>
                                                            </div>
                                                            <p className="text-muted-foreground/90 leading-relaxed group-hover/block:text-foreground transition-colors">
                                                                {block.text}
                                                            </p>
                                                        </div>
                                                    ))}
                                                    <div className="pt-2 flex justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1.5 opacity-70 hover:opacity-100"
                                                            onClick={() => handleCopyCollection(group, blocks)}
                                                        >
                                                            <Share2 className="h-3 w-3" />
                                                            Share Collection
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {filteredGroups.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                            <Layers className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-xs">No collections formed yet.</p>
                            <p className="text-[10px] mt-1">AI is analyzing context...</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Card>
    );
}
