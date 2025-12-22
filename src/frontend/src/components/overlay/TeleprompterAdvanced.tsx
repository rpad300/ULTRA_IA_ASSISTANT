import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    ChevronUp,
    ChevronDown,
    Mic,
    MicOff,
    Gauge,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
// Simplified voice commands hook for teleprompter
const useTeleprompterVoiceCommands = (
    enabled: boolean,
    onCommand: (command: string) => void,
    commands: string[]
) => {
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!enabled) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
            onCommand(text);
        };

        recognition.onerror = () => {
            // Silently handle errors
        };

        recognition.onend = () => {
            if (enabled) {
                setTimeout(() => recognition.start(), 500);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [enabled, onCommand, commands]);
};

interface TeleprompterAdvancedProps {
    scriptContent: string;
    scriptTitle?: string;
    scrollRef: React.RefObject<HTMLDivElement>;
    onScroll: (position: number) => void;
}

export function TeleprompterAdvanced({
    scriptContent,
    scrollRef,
    onScroll
}: TeleprompterAdvancedProps) {
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [scrollSpeed, setScrollSpeed] = useState(1.0); // 0.5x to 2.0x
    const [currentScrollPosition, setCurrentScrollPosition] = useState(0);
    const [speakingRate, setSpeakingRate] = useState(0); // words per minute
    const [pacingFeedback, setPacingFeedback] = useState<'fast' | 'normal' | 'slow' | null>(null);
    const [highlightedSections, setHighlightedSections] = useState<number[]>([]);
    const [cues, setCues] = useState<Array<{ line: number; type: 'key-point' | 'transition' | 'pause'; message: string }>>([]);

    const { transcriptBlocks, isRecording } = useMeetingStore();
    const [isVoiceControlEnabled, setIsVoiceControlEnabled] = useState(false);

    const scriptBlocks = scriptContent.split('\n\n').filter(b => b.trim());
    const lastTranscriptBlock = transcriptBlocks[transcriptBlocks.length - 1];

    // Calculate current line index based on scroll position
    const currentLineIndex = Math.floor(
        (currentScrollPosition / Math.max(scrollRef.current?.scrollHeight || 1, 1)) * scriptBlocks.length
    );

    // Calculate speaking rate (words per minute)
    useEffect(() => {
        if (!isRecording || transcriptBlocks.length < 2) return;

        const recentBlocks = transcriptBlocks.slice(-10);
        const totalWords = recentBlocks.reduce((sum, block) => sum + block.text.split(' ').length, 0);
        const timeSpan = recentBlocks.length > 1
            ? recentBlocks[recentBlocks.length - 1].timestamp - recentBlocks[0].timestamp
            : 60; // fallback to 1 minute

        if (timeSpan > 0) {
            const wpm = Math.round((totalWords / timeSpan) * 60);
            setSpeakingRate(wpm);

            // Pacing feedback
            if (wpm > 180) {
                setPacingFeedback('fast');
            } else if (wpm < 120) {
                setPacingFeedback('slow');
            } else {
                setPacingFeedback('normal');
            }
        }
    }, [transcriptBlocks, isRecording]);

    // Auto-scroll based on speaking rate
    useEffect(() => {
        if (!autoScrollEnabled || !scrollRef.current || !isRecording) return;

        // Calculate scroll position based on speaking rate and elapsed time
        // This is a simplified version - in production, would use more sophisticated NLP
        const wordsPerLine = 15; // average words per line
        const linesPerMinute = speakingRate > 0 ? speakingRate / wordsPerLine : 10;
        const scrollPerSecond = (linesPerMinute / 60) * scrollSpeed;

        const interval = setInterval(() => {
            if (scrollRef.current) {
                const currentScroll = scrollRef.current.scrollTop;
                const newScroll = currentScroll + (scrollPerSecond * 20); // 20px per line
                scrollRef.current.scrollTo({ top: newScroll, behavior: 'smooth' });
                onScroll(newScroll);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [autoScrollEnabled, speakingRate, scrollSpeed, isRecording, scrollRef, onScroll]);

    // Smart contextual highlighting
    useEffect(() => {
        if (!lastTranscriptBlock || !isRecording) return;

        const transcriptText = lastTranscriptBlock.text.toLowerCase();
        const newHighlights: number[] = [];

        scriptBlocks.forEach((block, idx) => {
            const blockWords = block.toLowerCase().split(/\s+/);
            const transcriptWords = transcriptText.split(/\s+/);

            // Check if block contains words from recent transcript
            const matchCount = blockWords.filter(word =>
                transcriptWords.some(tWord => tWord.includes(word) || word.includes(tWord))
            ).length;

            if (matchCount > 3) { // Threshold for highlighting
                newHighlights.push(idx);
            }
        });

        setHighlightedSections(newHighlights);
    }, [lastTranscriptBlock, scriptBlocks, isRecording]);

    // Generate intelligent cues
    useEffect(() => {
        const newCues: Array<{ line: number; type: 'key-point' | 'transition' | 'pause'; message: string }> = [];

        scriptBlocks.forEach((block, idx) => {
            // Key points (contain numbers, questions, or important keywords)
            if (/\d+/.test(block) || block.includes('?') ||
                ['importante', 'crucial', 'essencial', 'chave'].some(word => block.toLowerCase().includes(word))) {
                newCues.push({
                    line: idx,
                    type: 'key-point',
                    message: 'Ponto chave - enfatize'
                });
            }

            // Transitions (start of new paragraph after long block)
            if (idx > 0 && scriptBlocks[idx - 1].length > 200 && block.length < 100) {
                newCues.push({
                    line: idx,
                    type: 'transition',
                    message: 'Transição - pausa breve'
                });
            }
        });

        setCues(newCues);
    }, [scriptBlocks]);

    // Voice commands for teleprompter
    const handleVoiceCommand = useCallback((command: string) => {
        if (!isVoiceControlEnabled) return;

        const cmd = command.toLowerCase();
        if (cmd.includes('pause') || cmd.includes('pausar')) {
            setAutoScrollEnabled(false);
        } else if (cmd.includes('resume') || cmd.includes('continuar')) {
            setAutoScrollEnabled(true);
        } else if (cmd.includes('slower') || cmd.includes('mais devagar')) {
            setScrollSpeed(prev => Math.max(0.5, prev - 0.1));
        } else if (cmd.includes('faster') || cmd.includes('mais rápido')) {
            setScrollSpeed(prev => Math.min(2.0, prev + 0.1));
        } else if (cmd.includes('next') || cmd.includes('próximo')) {
            if (scrollRef.current) {
                scrollRef.current.scrollBy({ top: 100, behavior: 'smooth' });
            }
        } else if (cmd.includes('previous') || cmd.includes('anterior')) {
            if (scrollRef.current) {
                scrollRef.current.scrollBy({ top: -100, behavior: 'smooth' });
            }
        }
    }, [isVoiceControlEnabled, scrollRef]);

    useTeleprompterVoiceCommands(
        isVoiceControlEnabled,
        handleVoiceCommand,
        ['pause', 'resume', 'slower', 'faster', 'next', 'previous']
    );

    const handleScroll = (direction: 'up' | 'down') => {
        if (!scrollRef.current) return;
        const scrollAmount = 100;
        const newPosition = direction === 'up'
            ? scrollRef.current.scrollTop - scrollAmount
            : scrollRef.current.scrollTop + scrollAmount;
        scrollRef.current.scrollTo({ top: newPosition, behavior: 'smooth' });
    };

    // Check if current line has a cue
    const currentCue = cues.find(c => Math.abs(c.line - currentLineIndex) < 2);

    return (
        <div className="h-full flex flex-col">
            {/* Performance Feedback Bar */}
            {isRecording && (
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-2 border-b border-border bg-muted/30"
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-2">
                                <Gauge className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Velocidade:</span>
                                <Badge variant="outline" className={cn(
                                    "text-xs",
                                    pacingFeedback === 'fast' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                                    pacingFeedback === 'slow' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                    pacingFeedback === 'normal' && "bg-green-500/10 text-green-500 border-green-500/20"
                                )}>
                                    {speakingRate > 0 ? `${speakingRate} wpm` : 'Calculando...'}
                                </Badge>
                                {pacingFeedback === 'fast' && (
                                    <span className="text-xs text-yellow-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Muito rápido
                                    </span>
                                )}
                                {pacingFeedback === 'slow' && (
                                    <span className="text-xs text-blue-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Muito devagar
                                    </span>
                                )}
                                {pacingFeedback === 'normal' && (
                                    <span className="text-xs text-green-500 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Bom ritmo
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Scroll:</span>
                                <Progress
                                    value={(scrollSpeed - 0.5) / 1.5 * 100}
                                    className="w-24 h-2"
                                />
                                <span className="text-xs font-mono">{scrollSpeed.toFixed(1)}x</span>
                            </div>
                        </div>

                        <Button
                            size="sm"
                            variant={isVoiceControlEnabled ? "default" : "outline"}
                            className="h-7 text-xs"
                            onClick={() => setIsVoiceControlEnabled(!isVoiceControlEnabled)}
                        >
                            {isVoiceControlEnabled ? (
                                <>
                                    <Mic className="h-3 w-3 mr-1" />
                                    Voice On
                                </>
                            ) : (
                                <>
                                    <MicOff className="h-3 w-3 mr-1" />
                                    Voice Off
                                </>
                            )}
                        </Button>

                        <Button
                            size="sm"
                            variant={autoScrollEnabled ? "default" : "outline"}
                            className="h-7 text-xs"
                            onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
                        >
                            {autoScrollEnabled ? 'Auto' : 'Manual'}
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Cue Alert */}
            <AnimatePresence>
                {currentCue && isRecording && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                            "p-2 border-b border-border text-center",
                            currentCue.type === 'key-point' && "bg-primary/10 border-primary/20",
                            currentCue.type === 'transition' && "bg-blue-500/10 border-blue-500/20",
                            currentCue.type === 'pause' && "bg-yellow-500/10 border-yellow-500/20"
                        )}
                    >
                        <p className="text-xs font-semibold">{currentCue.message}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Script Content */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    ref={scrollRef}
                    className="h-full overflow-auto p-8"
                    style={{ scrollbarWidth: 'thin' }}
                    onScroll={(e) => {
                        const target = e.target as HTMLDivElement;
                        const scrollTop = target.scrollTop;
                        setCurrentScrollPosition(scrollTop);
                        onScroll(scrollTop);
                    }}
                >
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {scriptBlocks.map((block, idx) => {
                            const isHighlighted = highlightedSections.includes(idx);
                            const hasCue = cues.some(c => c.line === idx);

                            return (
                                <motion.p
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: isHighlighted ? 1.02 : 1,
                                        borderColor: isHighlighted ? 'rgb(59 130 246)' : 'transparent'
                                    }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={cn(
                                        "text-lg leading-relaxed text-center p-4 rounded-lg border-2 transition-all",
                                        isHighlighted && "bg-blue-500/10 border-blue-500/30 shadow-md",
                                        hasCue && "ring-2 ring-primary/30"
                                    )}
                                    style={{
                                        fontSize: 'clamp(18px, 2.5vw, 26px)',
                                        lineHeight: '1.8'
                                    }}
                                >
                                    {block}
                                </motion.p>
                            );
                        })}
                    </div>
                </div>

                {/* Scroll Controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-lg border border-border">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => handleScroll('up')}
                    >
                        <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                        {Math.round((scrollRef.current?.scrollTop || 0) / 10)}%
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => handleScroll('down')}
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

