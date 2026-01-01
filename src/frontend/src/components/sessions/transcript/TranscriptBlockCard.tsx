import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, StarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getSentimentStyles } from "./transcriptUtils";
import { formatTime } from "@/utils/timeUtils";
import { SpeakerAssignmentMenu } from "./SpeakerAssignmentMenu";
import type { TranscriptBlock } from "@/store/meetingStore";
import type { Contact } from "@/api/client";

interface TranscriptBlockCardProps {
    block: TranscriptBlock;
    onToggleHighlight: (id: string) => void;
    index: number;
    searchQuery: string;
    onAssignSpeaker: (blockId: string, contactId: string) => Promise<void>;
    contacts: Contact[];
    onCreateContact: (blockId: string) => void;
    isFocused?: boolean;
}

export const TranscriptBlockCard = memo(({
    block,
    onToggleHighlight,
    searchQuery,
    onAssignSpeaker,
    contacts,
    onCreateContact,
    isFocused = false
}: TranscriptBlockCardProps) => {

    const highlightedText = useMemo(() => {
        if (!searchQuery.trim()) return block.text;

        const regex = new RegExp(`(${searchQuery})`, 'gi');
        const parts = block.text.split(regex);

        return parts.map((part: string, i: number) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
                <mark key={i} className="bg-yellow-500/30 text-foreground px-0.5 rounded font-medium">
                    {part}
                </mark>
            ) : part
        );
    }, [block.text, searchQuery]);

    // Responsive Interaction:
    // Mobile: Action buttons (Star) should be large and easy to tap.
    // Desktop: Star can appear on hover.

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
                "p-3 sm:p-4 rounded-lg border transition-all will-change-transform",
                block.isHighlighted
                    ? "bg-yellow-500/5 border-yellow-500/40 shadow-sm"
                    : "bg-card border-border/60 hover:border-border hover:shadow-sm",
                isFocused && "ring-2 ring-primary ring-offset-2 bg-primary/5",
                getSentimentStyles(block.sentiment)
            )}
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                    {/* Speaker Assignment Menu */}
                    <SpeakerAssignmentMenu
                        speakerName={block.speaker}
                        blockId={block.id}
                        contacts={contacts}
                        onAssignSpeaker={onAssignSpeaker}
                        onCreateContact={onCreateContact}
                        isAssigning={false} // Loading state handled locally or via optimistic update in parent mostly
                    />

                    <span className="text-[11px] text-muted-foreground font-mono">
                        {formatTime(block.timestamp)}
                    </span>

                    {block.topic && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-muted/50">
                            {block.topic}
                        </Badge>
                    )}
                </div>

                {/* Highlight Toggle */}
                {/* Mobile: Always visible or larger tap target. Desktop: Hover opacity niceness. */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 -mr-2 -mt-1 shrink-0 transition-opacity",
                        // Mobile: Always visible (opacity-100)
                        // Desktop: Visible on hover or if highlighted
                        block.isHighlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100",
                        // Mobile specific override to ensure accessibility
                        "max-md:opacity-100"
                    )}
                    onClick={() => onToggleHighlight(block.id)}
                    title={block.isHighlighted ? "Remove highlight" : "Highlight this block"}
                    aria-label={block.isHighlighted ? "Remove highlight" : "Highlight this block"}
                >
                    {block.isHighlighted ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground/50" />
                    )}
                </Button>
            </div>

            <div className="text-sm leading-relaxed text-foreground/90 break-words whitespace-pre-wrap font-sans">
                {highlightedText}
            </div>
        </motion.div>
    );
});

TranscriptBlockCard.displayName = "TranscriptBlockCard";
