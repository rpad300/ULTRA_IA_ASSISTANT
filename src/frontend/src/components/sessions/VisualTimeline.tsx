import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ZoomIn, ZoomOut, AlertTriangle, CheckCircle2,
    Star, MessageSquare, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useChapterEngine } from "@/hooks/useChapterEngine";
import { useTimelineEngine, type TimelineEvent } from "@/hooks/useTimelineEngine";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime } from "@/utils/timeUtils";

// --- Components for Swimlanes ---

const LaneLabel = ({ children, icon: Icon }: { children: React.ReactNode, icon?: any }) => (
    <div className="absolute left-0 top-0 bottom-0 w-24 bg-background/80 backdrop-blur-md border-r border-border z-20 flex items-center px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="w-3 h-3 mr-1.5 opacity-70" />}
        {children}
    </div>
);

const ParticipantColorStrip = ({ speaker }: { speaker: string }) => {
    // Stable color generation using simple hashing -> OKLCH-like HSLA
    const hash = speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return (
        <div
            className="h-full w-full opacity-60 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: `hsla(${hue}, 70%, 50%, 0.6)` }}
            title={speaker}
        />
    );
};

export function VisualTimeline() {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Store Data
    const {
        transcriptBlocks, detectedActions, risks, elapsedTime,
        setFocusedBlockId
    } = useMeetingStore();
    const { topicClusters } = useChapterEngine();

    // Local State
    const [zoom, setZoom] = useState(1);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState(0);

    // Derived: Duration (min 1 min)
    const duration = Math.max(elapsedTime, transcriptBlocks.length > 0 ? transcriptBlocks[transcriptBlocks.length - 1].timestamp : 60, 60);

    // Timeline Engine Hook
    const { totalWidth, timeToPx, pxToTime, computeClusters, generateHeatmap } = useTimelineEngine({
        duration,
        zoom,
        containerWidth: containerRef.current?.offsetWidth || 800
    });

    // Prepare Events for Clustering
    const rawEvents = useMemo<TimelineEvent[]>(() => {
        const events: TimelineEvent[] = [];

        transcriptBlocks.forEach(b => {
            if (b.isHighlighted) {
                events.push({ id: b.id, time: b.timestamp, type: 'highlight', data: b, priority: 5 });
            }
        });

        detectedActions.forEach(a => {
            events.push({ id: a.id, time: a.timestamp, type: 'action', data: a, priority: 8 });
        });

        risks.forEach(r => {
            events.push({ id: r.id, time: r.timestamp, type: 'risk', data: r, priority: 10 });
        });

        return events;
    }, [transcriptBlocks, detectedActions, risks]);

    // Computed Clusters
    const clusters = useMemo(() => computeClusters(rawEvents, 20), [computeClusters, rawEvents]);

    // Heatmap Data (100 buckets)
    const heatmapData = useMemo(() => generateHeatmap(transcriptBlocks, 100), [generateHeatmap, transcriptBlocks]);

    // Helpers
    const getClusterIcon = (type: string) => {
        switch (type) {
            case 'risk': return <AlertTriangle className="w-3 h-3 text-red-500" />;
            case 'action': return <CheckCircle2 className="w-3 h-3 text-green-500" />;
            case 'highlight': return <Star className="w-3 h-3 text-yellow-500" />;
            case 'mixed': return <Activity className="w-3 h-3 text-primary" />;
            default: return <div className="w-2 h-2 rounded-full bg-primary" />;
        }
    };

    const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!scrollRef.current) return;
        const rect = scrollRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const time = pxToTime(x);

        // Scroll Transcript
        // Optimisation: Find closest block
        const block = transcriptBlocks.find(b => Math.abs(b.timestamp - time) < 5); // 5 sec window
        if (block) {
            // We use data attributes in TranscriptPane to scroll
            const element = document.querySelector(`[data-timestamp="${block.timestamp}"]`);
            element?.scrollIntoView({ behavior: 'auto', block: 'center' });
            // Optional: highlight
            // setFocusedBlockId(block.id); // Maybe too noisy if dragging?
        }
    }, [pxToTime, transcriptBlocks]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        const rect = scrollRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left; // relative to viewport
        const scrollX = scrollRef.current.scrollLeft;

        setHoverX(x);
        setHoverTime(pxToTime(x + scrollX));
        setIsHovering(true);

        // Scrub if mouse down (simple drag impl)
        if (e.buttons === 1) {
            handleScrub(e as any);
        }
    };

    // SOTA: Viewport Highlight Data
    const { transcriptViewport } = useMeetingStore();

    // SOTA: Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (clusters.length === 0) return;
            // Only capture if not typing in input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                // Find current closest cluster based on Playhead or last selection
                // For now, let's just find the closest to current time (elapsedTime) if we wanted linear nav,
                // BUT user wants to jump between IMPORTANT events.

                // Let's implement "Selection State" or just jump playhead/focus
                // We'll jump the scroll position (Scrub)

                // 1. Find the cluster closest to the current center of view? Or elapsed time?
                // Let's use the currently focused block timestamp if available, else center of viewport

                // Simple version: Sort clusters by time. Find next/prev from 'elapsedTime' (Playhead) 
                // OR 'hoverTime' if hovering? No, Playhead/SelectedTime.

                const currentT = elapsedTime;
                const sorted = [...clusters].sort((a, b) => a.centerTime - b.centerTime);

                let target: typeof clusters[0] | undefined;

                if (e.key === 'ArrowRight') {
                    target = sorted.find(c => c.centerTime > currentT + 1); // +1 buffer
                    if (!target && sorted.length) target = sorted[sorted.length - 1]; // Loop or stay? Stay.
                } else {
                    target = [...sorted].reverse().find(c => c.centerTime < currentT - 1);
                    if (!target && sorted.length) target = sorted[0];
                }

                if (target) {
                    // Jump to it
                    const element = document.querySelector(`[data-timestamp="${target.events[0].time}"]`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Provide visual feedback could be by selecting it
                    setFocusedBlockId(target.events[0].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clusters, elapsedTime, setFocusedBlockId]);

    return (
        <Card className="border-border bg-card/60 backdrop-blur-xl shadow-lg flex flex-col h-auto min-h-[260px] isolate overflow-visible relative group/card">
            {/* Cinematic HUD Header */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 z-50"></div>

            <CardHeader className="p-3 border-b border-border/40 flex flex-row items-center justify-between shrink-0 h-14 bg-muted/5">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold tracking-tight">Temporal Navigator</CardTitle>
                        <CardDescription className="text-[10px] m-0">
                            {formatTime(elapsedTime)} elapsed • {clusters.length} smart clusters
                        </CardDescription>
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-background/50 rounded-full border border-border p-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/20" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
                        <ZoomOut className="h-3 w-3" />
                    </Button>
                    <span className="text-[9px] font-mono w-8 text-center text-muted-foreground">{zoom.toFixed(1)}x</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/20" onClick={() => setZoom(Math.min(4, zoom + 0.25))}>
                        <ZoomIn className="h-3 w-3" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 h-auto relative overflow-visible" ref={containerRef}>
                {/* Main Scrollable Area */}
                <div
                    ref={scrollRef}
                    className="w-full h-full overflow-x-auto overflow-y-hidden no-scrollbar relative pl-24 cursor-crosshair select-none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setIsHovering(false)}
                    onMouseDown={handleScrub}
                >
                    <div
                        className="relative h-full min-w-full"
                        style={{ width: `${Math.max(totalWidth, containerRef.current?.offsetWidth || 0)}px` }}
                    >
                        {/* --- GRID BACKGROUND --- */}
                        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />

                        {/* --- SOTA: Viewport Highlight (Reverse Sync) --- */}
                        {transcriptViewport.end > 0 && (
                            <motion.div
                                className="absolute top-0 bottom-0 bg-primary/5 border-l border-r border-primary/10 pointer-events-none z-0"
                                initial={false}
                                animate={{
                                    left: timeToPx(transcriptViewport.start),
                                    width: Math.max(timeToPx(transcriptViewport.end - transcriptViewport.start), 2)
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}

                        {/* --- HEAD: Time Ruler --- */}
                        <div className="h-6 border-b border-border/30 relative bg-muted/10">
                            {Array.from({ length: Math.ceil(duration / (30 / zoom)) }).map((_, i) => {
                                const time = i * (30 / zoom);
                                const left = timeToPx(time);
                                return (
                                    <div key={i} className="absolute top-0 bottom-0 border-l border-border/20 text-[9px] pl-1 text-muted-foreground/50 truncate" style={{ left }}>
                                        {formatTime(time)}
                                    </div>
                                )
                            })}
                        </div>

                        {/* --- LANE 1: Topics (Chapters) --- */}
                        <div className="h-10 relative border-b border-border/20 group-hover/lane:bg-primary/5 transition-colors">
                            <LaneLabel icon={MessageSquare}>Context</LaneLabel>
                            {topicClusters?.map(cluster => {
                                const startPx = timeToPx(cluster.startTime);
                                const widthPx = timeToPx(cluster.endTime - cluster.startTime);
                                return (
                                    <motion.div
                                        key={cluster.id}
                                        className={cn(
                                            "absolute top-2 bottom-2 rounded-md border text-[10px] flex items-center px-2 overflow-hidden whitespace-nowrap shadow-sm hover:ring-1 hover:ring-primary/50 transition-all cursor-pointer backdrop-blur-sm",
                                            cluster.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                                                cluster.sentiment === 'negative' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
                                                    'bg-blue-500/10 border-blue-500/30 text-blue-500'
                                        )}
                                        style={{ left: startPx, width: Math.max(widthPx, 20) }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (cluster.blocks.length) setFocusedBlockId(cluster.blocks[0]);
                                        }}
                                        whileHover={{ scale: 1.02, zIndex: 10 }}
                                    >
                                        <span className="font-semibold opacity-90">{cluster.name}</span>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* --- LANE 2: Activity Heatmap --- */}
                        <div className="h-12 relative border-b border-border/20 flex items-center">
                            <LaneLabel icon={Activity}>Density</LaneLabel>
                            <div className="absolute inset-0 flex items-end px-[1px] gap-[1px] opacity-60">
                                {heatmapData.map((intensity, i) => (
                                    <motion.div
                                        key={i}
                                        className="bg-primary flex-1 min-w-[2px] rounded-t-[1px]"
                                        style={{ height: `${intensity * 100}%`, opacity: 0.3 + (intensity * 0.7) }}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${intensity * 100}%` }}
                                        transition={{ duration: 0.5, delay: i * 0.01 }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* --- LANE 3: Markers (Risks, Actions) --- */}
                        <div className="h-12 relative border-b border-border/20 flex items-center">
                            <LaneLabel icon={AlertTriangle}>Markers</LaneLabel>
                            <AnimatePresence>
                                {clusters.map((cluster) => {
                                    const left = timeToPx(cluster.centerTime);
                                    return (
                                        <motion.div
                                            key={cluster.id}
                                            className="absolute top-1/2 -translate-y-1/2 -ml-3 z-30"
                                            style={{ left }}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            whileHover={{ scale: 1.2, zIndex: 50 }}
                                        >
                                            {cluster.count > 1 ? (
                                                <div className="w-6 h-6 rounded-full bg-background border-2 border-primary shadow-lg flex items-center justify-center text-[9px] font-bold text-primary cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors group">
                                                    {cluster.count}
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block min-w-[120px] bg-popover text-popover-foreground text-xs p-2 rounded shadow-xl border z-50">
                                                        <div className="font-semibold mb-1 border-b pb-1">Cluster Content</div>
                                                        {cluster.events.slice(0, 3).map(ev => (
                                                            <div key={ev.id} className="truncate text-[10px] mb-0.5">• {ev.data.summary || ev.data.text || "Event"}</div>
                                                        ))}
                                                        {cluster.events.length > 3 && <div className="text-[9px] opacity-70">+{cluster.events.length - 3} more</div>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative group cursor-pointer" onClick={() => {
                                                    // Navigate
                                                    setFocusedBlockId(cluster.events[0].id);
                                                }}>
                                                    <div className={cn(
                                                        "w-5 h-5 rounded-full border-2 bg-background flex items-center justify-center shadow-md",
                                                        cluster.primaryType === 'risk' ? "border-red-500 text-red-500" :
                                                            cluster.primaryType === 'action' ? "border-green-500 text-green-500" :
                                                                "border-yellow-500 text-yellow-500"
                                                    )}>
                                                        {getClusterIcon(cluster.primaryType)}
                                                    </div>
                                                    {/* Simple Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md border z-50">
                                                        {cluster.events[0].data.summary || cluster.events[0].data.text?.substring(0, 20)}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {/* --- LANE 4: Participants (Footer) --- */}
                        <div className="h-4 relative mt-auto flex">
                            {/* <LaneLabel>Speakers</LaneLabel> (Too small for label) */}
                            {transcriptBlocks.map((block) => {
                                const left = timeToPx(block.timestamp);
                                // Approximation: assume block length ~ 2s min or calculate diff
                                const next = transcriptBlocks.find(b => b.timestamp > block.timestamp);
                                const width = next ? timeToPx(next.timestamp - block.timestamp) : 10;

                                return (
                                    <div
                                        key={block.id}
                                        className="absolute top-0 bottom-0 border-r border-background/10"
                                        style={{ left, width }}
                                    >
                                        <ParticipantColorStrip speaker={block.speaker} />
                                    </div>
                                )
                            })}
                        </div>

                        {/* Playhead Indicator */}
                        <motion.div
                            className="absolute top-0 bottom-0 w-[2px] bg-primary z-40 pointer-events-none shadow-[0_0_10px_rgba(var(--primary),0.8)]"
                            style={{ left: timeToPx(elapsedTime) }}
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full blur-[1px]" />
                        </motion.div>

                    </div>
                </div>

                {/* --- MOUSE HOVER LINE (Preview) --- */}
                {isHovering && hoverTime !== null && (
                    <div
                        className="absolute top-14 bottom-0 w-[1px] bg-white/50 border-l border-dashed border-white/50 z-50 pointer-events-none flex flex-col items-center"
                        style={{ left: hoverX + 24 + 1 }} // padding-left compensator? No, mouseX is relative to scroll container? 
                    // Wait. e.clientX - rect.left in handleMouseMove is relative to viewport.
                    // But transcript is scrolled. 
                    // Actually, for fixed overlay relative to Container, we need relative to Card. 
                    // Let's simpler: Use absolute inside Scroll Container? No, then it scrolls with it.
                    // We want it fixed to mouse.
                    // Refactoring hover approach: using a fixed overlay on top of scroll container.
                    />
                )}
                {/* Better Hover Implementation inside Scroll Container but translated? 
                     Actually, standard editors render the hover line inside the scroll content but update its LEFT position based on mouse.
                     But we already have hoverX relative to viewport.
                  */}
            </CardContent>
        </Card>
    );
}

// SOTA visual fix for scrollbar hiding in some browsers
// .custom-scrollbar::-webkit-scrollbar { height: 4px; }
// .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
// .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground)/0.3); border-radius: 4px; }
