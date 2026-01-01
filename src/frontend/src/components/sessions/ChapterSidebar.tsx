
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";

interface Chapter {
    id: string;
    title: string;
    startTime: number; // in seconds
    duration?: number;
    status: 'completed' | 'current' | 'upcoming';
}

interface ChapterSidebarProps {
    chapters: Chapter[];
    currentTime: number;
    onChapterClick: (startTime: number) => void;
}

export function ChapterSidebar({ chapters, currentTime, onChapterClick }: ChapterSidebarProps) {
    return (
        <div className="w-64 border-r border-border bg-card/30 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-muted/20">
                <h3 className="font-semibold text-sm tracking-wide text-muted-foreground uppercase">Chapters</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {chapters.map((chapter, index) => {
                    const isActive = currentTime >= chapter.startTime &&
                        (index === chapters.length - 1 || currentTime < chapters[index + 1].startTime);

                    return (
                        <motion.button
                            key={chapter.id}
                            onClick={() => onChapterClick(chapter.startTime)}
                            className={cn(
                                "flex items-start gap-3 w-full p-3 rounded-lg text-left transition-all duration-200 group relative overflow-hidden",
                                isActive
                                    ? "bg-primary/10 border border-primary/20 shadow-sm"
                                    : "hover:bg-muted/50 border border-transparent"
                            )}
                            animate={{
                                scale: isActive ? 1.02 : 1,
                            }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeChapterGlow"
                                    className="absolute inset-0 bg-primary/5 pointer-events-none"
                                />
                            )}

                            <div className="mt-0.5 shrink-0 relative z-10">
                                {isActive ? (
                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                                        <Play className="w-2.5 h-2.5 text-primary-foreground fill-current ml-0.5" />
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary/50 flex items-center justify-center transition-colors">
                                        <span className="text-[10px] text-muted-foreground font-medium">{index + 1}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 relative z-10">
                                <div className="flex justify-between items-start gap-2">
                                    <span className={cn(
                                        "text-sm font-medium leading-tight",
                                        isActive ? "text-primary" : "text-foreground group-hover:text-primary/90"
                                    )}>
                                        {chapter.title}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground mt-1 block font-mono opacity-80">
                                    {formatTime(chapter.startTime)}
                                </span>
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}

function formatTime(seconds: number) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}
