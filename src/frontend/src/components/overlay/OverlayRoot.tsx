import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    FileText,
    Lightbulb,
    X,
    Maximize2,
    Minimize2,
    Move
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { TeleprompterAdvanced } from "./TeleprompterAdvanced";

type OverlayMode = 'teleprompter' | 'hints' | 'hybrid' | 'minimal' | 'focus';

interface OverlayRootProps {
    scriptContent?: string;
    scriptTitle?: string;
    onClose?: () => void;
}

export function OverlayRoot({ scriptContent, onClose }: OverlayRootProps) {
    const [mode, setMode] = useState<OverlayMode>('teleprompter');
    const [isMinimized, setIsMinimized] = useState(false);
    const [scrollPosition, setScrollPosition] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragStartRef = useRef({ x: 0, y: 0 });
    const [overlaySize] = useState<'small' | 'medium' | 'large'>('medium');

    const {
        transcriptBlocks,
        isRecording,
        sessionId,
        coachingInsights
    } = useMeetingStore();

    // Get top 3 insights for hints mode
    const topInsights = [...coachingInsights]
        .sort((a, b) => ((b as any).priority || 0) - ((a as any).priority || 0))
        .slice(0, 3);

    // Get last 3 transcript blocks
    const lastTranscriptBlocks = transcriptBlocks.slice(-3);

    // Get current line for focus/minimal modes
    const scriptBlocks = scriptContent?.split('\n\n').filter(b => b.trim()) || [];
    const currentLineIndex = Math.floor((scrollPosition / (scrollRef.current?.scrollHeight || 1)) * scriptBlocks.length);
    const currentLine = scriptBlocks[currentLineIndex] || scriptBlocks[0] || '';
    const nextLines = scriptBlocks.slice(currentLineIndex, currentLineIndex + 3);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).closest('[data-drag-handle]')) {
            setIsDragging(true);
            dragStartRef.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging]);

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
                "fixed z-[9999] bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-2xl",
                isMinimized ? "w-64 h-16" :
                    mode === 'minimal' ? "w-[400px] h-[200px]" :
                        mode === 'focus' ? "w-[500px] h-[300px]" :
                            overlaySize === 'small' ? "w-[500px] h-[350px]" :
                                overlaySize === 'large' ? "w-[800px] h-[500px]" :
                                    "w-[600px] h-[400px]",
                "transition-all duration-300"
            )}
            style={{
                left: position.x || '50%',
                top: position.y || '50%',
                transform: position.x || position.y ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : 'default'
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div
                data-drag-handle
                className="flex items-center justify-between p-3 border-b border-border bg-muted/30 cursor-move"
            >
                <div className="flex items-center gap-2">
                    <Move className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {mode === 'teleprompter' ? 'Teleprompter' : 'Live Hints'}
                        </Badge>
                        {isRecording && sessionId && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1" />
                                Live
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setIsMinimized(!isMinimized)}
                    >
                        {isMinimized ? (
                            <Maximize2 className="h-3 w-3" />
                        ) : (
                            <Minimize2 className="h-3 w-3" />
                        )}
                    </Button>
                    {onClose && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={onClose}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/20 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                        <Button
                            size="sm"
                            variant={mode === 'teleprompter' ? 'default' : 'ghost'}
                            className="h-7 text-xs shrink-0"
                            onClick={() => setMode('teleprompter')}
                        >
                            <FileText className="h-3 w-3 mr-1" />
                            Full
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'hints' ? 'default' : 'ghost'}
                            className="h-7 text-xs shrink-0"
                            onClick={() => setMode('hints')}
                        >
                            <Lightbulb className="h-3 w-3 mr-1" />
                            Hints
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'hybrid' ? 'default' : 'ghost'}
                            className="h-7 text-xs shrink-0"
                            onClick={() => setMode('hybrid')}
                        >
                            Hybrid
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'minimal' ? 'default' : 'ghost'}
                            className="h-7 text-xs shrink-0"
                            onClick={() => setMode('minimal')}
                        >
                            Minimal
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'focus' ? 'default' : 'ghost'}
                            className="h-7 text-xs shrink-0"
                            onClick={() => setMode('focus')}
                        >
                            Focus
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        <AnimatePresence mode="wait">
                            {mode === 'teleprompter' ? (
                                <motion.div
                                    key="teleprompter"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="h-full flex flex-col"
                                >
                                    {scriptContent ? (
                                        <TeleprompterAdvanced
                                            scriptContent={scriptContent}
                                            // @ts-ignore
                                            scrollRef={scrollRef}
                                            onScroll={setScrollPosition}
                                        />
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center p-8 text-center">
                                            <div>
                                                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                                <p className="text-muted-foreground mb-2">No script loaded</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Select a script from the Thread to use in teleprompter mode
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ) : mode === 'hints' ? (
                                <motion.div
                                    key="hints"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="h-full flex flex-col"
                                >
                                    <ScrollArea className="flex-1 p-4">
                                        <div className="space-y-4">
                                            {/* Top Insights */}
                                            <div>
                                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                    <Lightbulb className="h-4 w-4 text-primary" />
                                                    Priority Insights
                                                </h3>
                                                <div className="space-y-2">
                                                    {topInsights.length > 0 ? (
                                                        topInsights.map((insight, idx) => (
                                                            <Card key={idx} className="p-3 border-primary/20 bg-primary/5">
                                                                <CardContent className="p-0">
                                                                    <p className="text-sm">{insight.message}</p>
                                                                    {(insight as any).priority && (
                                                                        <Badge variant="outline" className="mt-2 text-xs">
                                                                            Priority: {(insight as any).priority}
                                                                        </Badge>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">No insights yet</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Last Transcript */}
                                            <div>
                                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-primary" />
                                                    Last 3 Lines
                                                </h3>
                                                <div className="space-y-2">
                                                    {lastTranscriptBlocks.length > 0 ? (
                                                        lastTranscriptBlocks.map((block, idx) => (
                                                            <Card key={block.id || idx} className="p-2 border-border">
                                                                <CardContent className="p-0">
                                                                    <div className="flex items-start gap-2">
                                                                        <Badge variant="outline" className="text-xs shrink-0">
                                                                            {block.speaker}
                                                                        </Badge>
                                                                        <p className="text-xs flex-1">{block.text}</p>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">No transcript yet</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </motion.div>
                            ) : mode === 'hybrid' ? (
                                <motion.div
                                    key="hybrid"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="h-full flex"
                                >
                                    <div className="flex-1 border-r border-border">
                                        {scriptContent ? (
                                            <TeleprompterAdvanced
                                                scriptContent={scriptContent}
                                                // @ts-ignore
                                                scrollRef={scrollRef}
                                                onScroll={setScrollPosition}
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full p-4 text-center">
                                                <p className="text-xs text-muted-foreground">No script loaded</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-48 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                        <h3 className="text-xs font-semibold mb-2">Insights</h3>
                                        <div className="space-y-2">
                                            {topInsights.slice(0, 3).map((insight, idx) => (
                                                <Card key={idx} className="p-2 border-primary/20 bg-primary/5">
                                                    <CardContent className="p-0">
                                                        <p className="text-xs">{insight.message}</p>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ) : mode === 'minimal' ? (
                                <motion.div
                                    key="minimal"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="h-full flex flex-col items-center justify-center p-6"
                                >
                                    {nextLines.length > 0 ? (
                                        <div className="space-y-3 text-center">
                                            {nextLines.map((line, idx) => (
                                                <motion.p
                                                    key={idx}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                    className={cn(
                                                        "text-base leading-relaxed",
                                                        idx === 0 && "text-lg font-semibold text-primary"
                                                    )}
                                                >
                                                    {line}
                                                </motion.p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No script loaded</p>
                                    )}
                                </motion.div>
                            ) : mode === 'focus' ? (
                                <motion.div
                                    key="focus"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="h-full flex items-center justify-center p-8"
                                >
                                    {currentLine ? (
                                        <motion.p
                                            key={currentLineIndex}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-2xl leading-relaxed text-center font-medium"
                                            style={{
                                                fontSize: 'clamp(20px, 4vw, 32px)',
                                                lineHeight: '1.8'
                                            }}
                                        >
                                            {currentLine}
                                        </motion.p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No script loaded</p>
                                    )}
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>
                </>
            )}
        </motion.div>
    );
}

