import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ZoomIn, ZoomOut, Star, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { formatTime } from "@/utils/timeUtils";

export function VisualTimeline() {
    const { transcriptBlocks, detectedActions, risks, elapsedTime } = useMeetingStore();
    const [zoom, setZoom] = useState(1);
    const [selectedTime, setSelectedTime] = useState<number | null>(null);

    // Combine all events
    const events = useMemo(() => {
        const allEvents: Array<{
            time: number;
            type: 'transcript' | 'action' | 'risk' | 'highlight';
            label: string;
            color: string;
        }> = [];

        transcriptBlocks.forEach(block => {
            allEvents.push({
                time: block.timestamp,
                type: block.isHighlighted ? 'highlight' : 'transcript',
                label: `${block.speaker}: ${block.text.substring(0, 30)}...`,
                color: block.isHighlighted ? 'yellow' : 'blue',
            });
        });

        detectedActions.forEach(action => {
            allEvents.push({
                time: action.timestamp,
                type: 'action',
                label: action.text,
                color: 'green',
            });
        });

        risks.forEach(risk => {
            allEvents.push({
                time: risk.timestamp,
                type: 'risk',
                label: risk.summary,
                color: risk.severity === 'high' ? 'red' : risk.severity === 'medium' ? 'orange' : 'yellow',
            });
        });

        return allEvents.sort((a, b) => a.time - b.time);
    }, [transcriptBlocks, detectedActions, risks]);

    const maxTime = Math.max(elapsedTime, ...events.map(e => e.time), 1);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'highlight': return <Star className="h-3 w-3" />;
            case 'action': return <CheckCircle2 className="h-3 w-3" />;
            case 'risk': return <AlertTriangle className="h-3 w-3" />;
            default: return <div className="h-2 w-2 rounded-full" />;
        }
    };

    const getEventColor = (color: string) => {
        switch (color) {
            case 'yellow': return 'bg-yellow-500';
            case 'green': return 'bg-green-500';
            case 'red': return 'bg-red-500';
            case 'orange': return 'bg-orange-500';
            case 'blue': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };

    const handleTimeClick = (time: number) => {
        setSelectedTime(time);
        // Scroll to that time in transcript (would need to implement)
        const element = document.querySelector(`[data-timestamp="${time}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
        <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Visual Timeline
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            disabled={zoom <= 0.5}
                        >
                            <ZoomOut className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                            {zoom.toFixed(2)}x
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                            disabled={zoom >= 3}
                        >
                            <ZoomIn className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="relative h-32 overflow-x-auto overflow-y-hidden">
                    {/* Timeline line */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border transform -translate-y-1/2" />

                    {/* Current time indicator */}
                    <motion.div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                        style={{
                            left: `${(elapsedTime / maxTime) * 100}%`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-primary rounded-full border-2 border-background" />
                    </motion.div>

                    {/* Events */}
                    {events.map((event, index) => {
                        const leftPercent = (event.time / maxTime) * 100;
                        return (
                            <motion.div
                                key={index}
                                className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer group"
                                style={{ left: `${leftPercent}%` }}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleTimeClick(event.time)}
                            >
                                <div className={cn(
                                    "w-3 h-3 rounded-full border-2 border-background transition-all",
                                    getEventColor(event.color),
                                    selectedTime === event.time && "ring-2 ring-primary ring-offset-2 scale-150"
                                )} />

                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg max-w-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getEventIcon(event.type)}
                                            <span className="text-xs font-medium">{formatTime(event.time)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{event.label}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* Time markers */}
                    {Array.from({ length: Math.ceil(maxTime / 60) + 1 }).map((_, i) => {
                        const time = i * 60;
                        const leftPercent = (time / maxTime) * 100;
                        return (
                            <div
                                key={i}
                                className="absolute top-1/2 transform -translate-y-1/2"
                                style={{ left: `${leftPercent}%` }}
                            >
                                <div className="w-px h-2 bg-border" />
                                <span className="absolute top-3 left-1/2 transform -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatTime(time)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Transcript</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-muted-foreground">Highlight</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Action</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">Risk</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
