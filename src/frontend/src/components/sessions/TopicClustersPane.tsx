import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderTree, Clock, Users, Mic, Sparkles, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useChapterEngine } from "@/hooks/useChapterEngine";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime } from "@/utils/timeUtils";


export function TopicClustersPane() {
    const { topicClusters, interrogateTopic } = useChapterEngine();
    const { setFocusedBlockId, participants } = useMeetingStore();
    const listRef = useRef<HTMLDivElement>(null);

    const getTemperatureColor = (temp?: string) => {
        switch (temp) {
            case 'tense': return "from-amber-500/20 to-orange-600/20 border-orange-500/30 text-orange-200";
            case 'productive': return "from-blue-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-200";
            default: return "from-indigo-500/10 to-purple-500/10 border-white/10 text-muted-foreground";
        }
    };

    const getDominantSpeakerData = (speakerId?: string) => {
        const p = participants.find(p => p.id === speakerId);
        return p ? { name: p.name, color: "text-foreground" } : { name: "Multiple", color: "text-muted-foreground" };
    };

    if (!topicClusters || topicClusters.length === 0) {
        return (
            <Card className="h-full border-border bg-card/40 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                    <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1">Awaiting Context</h3>
                <p className="text-xs text-muted-foreground">Topics will emerge as the conversation flows...</p>
            </Card>
        );
    }

    return (
        <Card className="h-auto border-border bg-card/40 backdrop-blur-xl overflow-visible flex flex-col shadow-sm">
            <CardHeader className="p-4 border-b border-border/40 bg-muted/10 shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-primary" />
                        Semantic Chapters
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-background/50 backdrop-blur-md">
                        {topicClusters.length} Chapters
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0 h-auto overflow-visible relative" ref={listRef}>
                {/* Timeline Connector Line */}
                <div className="absolute left-[22px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-border/50 via-primary/20 to-transparent z-0" />

                <div className="p-4 space-y-6 z-10 relative">
                    <AnimatePresence mode="popLayout">
                        {topicClusters.map((cluster, index) => (
                            <motion.div
                                key={cluster.id}
                                layoutId={cluster.id}
                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.05 }}
                                className="group relative pl-8"
                            >
                                {/* Timeline Node */}
                                <div className={cn(
                                    "absolute left-0 top-6 h-3 w-3 rounded-full border-2 border-background z-20 shadow-[0_0_10px_rgba(0,0,0,0.2)] transition-colors duration-500",
                                    cluster.sentiment === 'positive' ? "bg-emerald-500 shadow-emerald-500/50" :
                                        cluster.sentiment === 'negative' ? "bg-rose-500 shadow-rose-500/50" : "bg-indigo-500 shadow-indigo-500/50"
                                )} />

                                {/* Chapter Card */}
                                <div
                                    onClick={() => {
                                        const firstBlockId = cluster.blocks[0];
                                        if (firstBlockId) setFocusedBlockId(firstBlockId);
                                    }}
                                    className={cn(
                                        "relative rounded-xl border bg-gradient-to-br p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.01] hover:border-primary/30 group-hover:ring-1 group-hover:ring-primary/20",
                                        getTemperatureColor(cluster.temperature)
                                    )}
                                >
                                    {/* Header: Time & Density */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/80 bg-background/30 backdrop-blur-sm px-2 py-1 rounded-md">
                                            <Clock className="h-3 w-3" />
                                            {formatTime(cluster.startTime)} - {formatTime(cluster.endTime)}
                                        </div>

                                        {/* Density Sparkline */}
                                        <div className="flex items-center gap-0.5 h-4 w-16">
                                            {(cluster.densityMap || Array.from({ length: 10 })).slice(0, 15).map((d: any, i) => (
                                                <div
                                                    key={i}
                                                    className="w-1 bg-foreground/20 rounded-full transition-all"
                                                    style={{
                                                        height: `${Math.max(20, (d?.intensity || Math.random()) * 100)}%`,
                                                        opacity: (d?.intensity || 0.3)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title & Stats */}
                                    <h4 className="text-base font-semibold tracking-tight text-foreground mb-1 group-hover:text-primary transition-colors">
                                        {cluster.name}
                                    </h4>

                                    {/* AI TL;DR */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                                        {cluster.summary || "Analyzing topic content..."}
                                    </p>

                                    {/* Metadata Footer */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                        <div className="flex items-center gap-3">
                                            {/* Dominant Speaker */}
                                            {cluster.dominantSpeakerId && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground" title="Dominant Speaker">
                                                    <Mic className="h-3 w-3" />
                                                    <span className={getDominantSpeakerData(cluster.dominantSpeakerId).color}>
                                                        {getDominantSpeakerData(cluster.dominantSpeakerId).name}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Participation */}
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                <Users className="h-3 w-3" />
                                                <span>{cluster.participantCount} active</span>
                                            </div>
                                        </div>

                                        {/* Interrogate Action */}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 text-[10px] px-2 hover:bg-primary/10 hover:text-primary gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                interrogateTopic(cluster);
                                            }}
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                            Interrogate
                                            <ArrowRight className="h-3 w-3 opacity-50" />
                                        </Button>
                                    </div>

                                    {/* "Aura" Selection Indicator (If active logic was added, omitting for now but style exists on hover) */}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}


