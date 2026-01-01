
import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { type Session, workspaceApi } from "@/api/client";
import { Copy, DownloadCloud, Clock, Play, Pause, Grid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

import { TranscriptPane } from "@/components/sessions/TranscriptPane";
import { AttachmentsTab } from "@/components/sessions/AttachmentsTab";
import { ParticipantsPane } from "@/components/sessions/ParticipantsPane";
import { LiveSummaryPane } from "@/components/sessions/LiveSummaryPane";
import { type WidgetGroup, DASHBOARD_WIDGETS } from "@/config/dashboardWidgets";
import { useMeetingStore } from "@/store/meetingStore";
import { useAudioSync } from "@/hooks/useAudioSync";
import { WaveformVisualizer } from "@/components/sessions/WaveformVisualizer";
import { ChapterSidebar } from "@/components/sessions/ChapterSidebar";
import { generateMarkdownReport, downloadReport } from "@/utils/reportGenerator";

// Helper
const ReviewWidgetPanel = ({ group }: { group: WidgetGroup }) => {
    const widgets = Object.values(DASHBOARD_WIDGETS).filter(w => w.group === group);
    return (
        <div className="flex flex-col gap-3">
            {widgets.map(config => {
                const Widget = config.component;
                return (
                    <div key={config.id} className="rounded-xl border border-border bg-card/30 hover:bg-card/50 transition-colors p-1">
                        <Widget />
                    </div>
                );
            })}
        </div>
    );
};

interface SessionReviewLayoutProps {
    session: Session;
    projectId?: string;
}


export function SessionReviewLayout({ session, projectId }: SessionReviewLayoutProps) {
    const [activeTab, setActiveTab] = useState<'transcript' | 'attachments'>('transcript');
    const showChapters = true;
    const { liveSummary, transcriptBlocks, focusedBlockId, setFocusedBlockId, flowPredictions } = useMeetingStore();

    // 1. Audio Engine (Master Clock)
    const audioUrl = useMemo(() => session.audio_file_drive_id ? workspaceApi.getSessionAudioUrl(session.id) : null, [session.id, session.audio_file_drive_id]);
    const { state: audioState, controls: audioControls } = useAudioSync(audioUrl);

    // Temp Stats Calculation
    const talkRatio = useMemo(() => {
        if (!transcriptBlocks || transcriptBlocks.length === 0) return "0%";

        const speakerDurations: Record<string, number> = {};
        let totalTime = 0;

        transcriptBlocks.forEach((block, i) => {
            const nextBlock = transcriptBlocks[i + 1];
            // Simple duration estimation: time until next block or 2 seconds min
            let duration = nextBlock ? (nextBlock.timestamp - block.timestamp) : 2000;
            if (duration > 10000) duration = 5000; // Cap gaps at 5s

            const speaker = block.speaker || "Unknown";
            speakerDurations[speaker] = (speakerDurations[speaker] || 0) + duration;
            totalTime += duration;
        });

        // Find dominant speaker
        let maxDuration = 0;
        for (const speaker in speakerDurations) {
            if (speakerDurations[speaker] > maxDuration) {
                maxDuration = speakerDurations[speaker];
            }
        }

        const ratio = totalTime > 0 ? Math.round((maxDuration / totalTime) * 100) : 0;
        return `${ratio}% Dominance`;
    }, [transcriptBlocks]);

    // 2. Chapters Generation (AI Based)

    const chapters = useMemo(() => {
        // 1. First Priority: AI Flow Predictions (Topics)
        if (flowPredictions && flowPredictions.length > 0) {
            return flowPredictions
                .map(p => ({
                    id: p.id,
                    title: p.predictedTopic,
                    startTime: p.estimatedTime, // Using estimatedTime as simplified start time reference for now
                    status: 'upcoming' as const
                }))
                .sort((a, b) => a.startTime - b.startTime);
        }

        // 2. Second Priority: Key Highlights
        if (liveSummary?.keyPoints?.length) {
            return liveSummary.keyPoints
                .filter(p => p.lineage?.blockId)
                .map((p, i) => {
                    const block = transcriptBlocks.find(b => b.id === p.lineage?.blockId);
                    return {
                        id: p.id,
                        title: p.text.substring(0, 40) + '...',
                        startTime: block ? block.timestamp / 1000 : i * 300,
                        status: 'upcoming' as const
                    };
                }).sort((a, b) => a.startTime - b.startTime);
        }

        // 3. Fallback: Time Slices (Simulation based on duration)
        const fakeChapters = [];
        const sessionDuration = (session.ended_at && session.started_at)
            ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
            : 3600;
        const totalDuration = audioState.duration || sessionDuration;
        const chunkSize = 300; // 5 min chunks
        const count = Math.ceil(totalDuration / chunkSize);

        if (count > 0) {
            for (let i = 0; i < count; i++) {
                fakeChapters.push({
                    id: `ch-${i}`,
                    title: `Part ${i + 1}`,
                    startTime: i * chunkSize,
                    status: 'upcoming' as const
                });
            }
        }
        return fakeChapters;
    }, [liveSummary, transcriptBlocks, flowPredictions, audioState.duration, session.started_at, session.ended_at]);


    // 3. Deep Linking & Sync Logic
    // Sync Audio -> Transcript
    useEffect(() => {
        if (audioState.isPlaying && transcriptBlocks.length > 0) {
            const currentSec = audioState.currentTime;

            const activeBlock = transcriptBlocks.find((b, i) => {
                const nextB = transcriptBlocks[i + 1];
                const start = b.timestamp / 1000;
                const end = nextB ? nextB.timestamp / 1000 : Infinity;
                return currentSec >= start && currentSec < end;
            });

            if (activeBlock && activeBlock.id !== focusedBlockId) {
                setFocusedBlockId(activeBlock.id);
            }
        }
    }, [audioState.currentTime, audioState.isPlaying, transcriptBlocks, focusedBlockId, setFocusedBlockId]);

    // Sync Transcript Deep Link -> Audio
    const lastFocusedBlockRef = useRef<string | null>(null);
    useEffect(() => {
        if (focusedBlockId && focusedBlockId !== lastFocusedBlockRef.current) {
            const block = transcriptBlocks.find(b => b.id === focusedBlockId);
            if (block) {
                const blockTime = block.timestamp / 1000;
                // Heuristic: If time diff > 2s, it's a jump, not valid playback progression
                if (Math.abs(blockTime - audioState.currentTime) > 2.0) {
                    audioControls.seek(blockTime);
                }
            }
            lastFocusedBlockRef.current = focusedBlockId;
        }
    }, [focusedBlockId, transcriptBlocks, audioState.currentTime, audioControls]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    audioControls.toggle();
                    break;
                case 'KeyJ':
                    audioControls.skipBack(10);
                    break;
                case 'KeyL':
                    audioControls.skipForward(10);
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [audioControls]);


    // Data for Waveform Markers
    interface WaveformMarker {
        time: number;
        type: 'conflict' | 'decision' | 'flag' | 'insight';
        label?: string;
    }
    const waveformMarkers = useMemo<WaveformMarker[]>(() => {
        const markers: WaveformMarker[] = [];
        if (liveSummary) {
            liveSummary.decisions.forEach(d => {
                const b = transcriptBlocks.find(b => b.id === d.lineage?.blockId);
                if (b) markers.push({ time: b.timestamp / 1000, type: 'decision' as const, label: 'Decision' });
            });
        }
        return markers;
    }, [liveSummary, transcriptBlocks]);


    const handleExport = () => {
        // Prepare data for the report generator
        const participants = Array.from(new Set(transcriptBlocks.map(b => b.speaker))).filter(Boolean);

        const reportData = {
            session: {
                title: "Session " + session.id.slice(0, 8),
                date: new Date(session.created_at).getTime(),
                duration: audioState.duration || 0,
                participants: participants
            },
            summary: {
                context: "Generated from Live Session",
                keyPoints: liveSummary?.keyPoints.map(k => k.text) || [],
                conclusion: "End of Session Report"
            },
            decisions: liveSummary?.decisions.map(d => ({
                text: d.text,
                status: d.status,
                timestamp: Date.now() // Placeholder as specific decision time might not be in summary item
            })) || [],
            actions: liveSummary?.actionItems.map(a => ({
                text: a.text,
                assignee: a.assignee,
                dueDate: a.dueDate
            })) || [],
            metrics: {
                qualityScore: 85, // Placeholder/Default
                talkTime: participants.map(p => ({
                    name: p,
                    percentage: talkRatio ? parseInt(talkRatio) : 0 // Parse the ratio string
                }))
            }
        };

        const report = generateMarkdownReport(reportData);
        downloadReport(report, `session-report-${session.id}.md`);
        toast.success("Executive Report Downloaded");
    };

    const handleCopySummary = () => {
        if (!liveSummary) return;
        const text = `SESSION SUMMARY\n\nKEY POINTS:\n${liveSummary.keyPoints.map(p => `- ${p.text}`).join('\n')}`;
        navigator.clipboard.writeText(text);
        toast.success("Summary copied!");
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground font-sans">
            {/* 1. Header: Metadata Panel de Luxo */}
            <header className="shrink-0 h-16 border-b border-border/40 bg-card/60 backdrop-blur-3xl flex items-center justify-between px-4 lg:px-6 z-20 sticky top-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Grid className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Deep Intelligence Player
                        </h1>
                        <div className="flex items-center gap-3 text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(audioState.duration || ((session.ended_at && session.started_at) ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000 : 3600))}
                            </span>
                            <span className="w-px h-3 bg-border" />
                            <span className="flex items-center gap-1 text-green-500">
                                Talk-Ratio: 65%
                            </span>
                            <span className="w-px h-3 bg-border" />
                            <span>{new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopySummary} className="hidden sm:flex h-8 text-xs">
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                    <Button onClick={handleExport} size="sm" className="h-8 text-xs bg-primary/90 hover:bg-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)]">
                        <DownloadCloud className="w-3.5 h-3.5 mr-1.5" /> Export Report
                    </Button>
                </div>
            </header>

            {/* 2. Main Workspace */}
            <div className="flex-1 flex min-h-0 relative">

                {/* AI Chapters Sidebar */}
                <AnimatePresence initial={false}>
                    {showChapters && (
                        <motion.aside
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 260, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="hidden md:block shrink-0 h-full border-r border-border/50 bg-card/20 backdrop-blur-sm z-10"
                        >
                            <ChapterSidebar
                                chapters={chapters}
                                currentTime={audioState.currentTime}
                                onChapterClick={(t) => audioControls.seek(t)}
                            />
                        </motion.aside>
                    )}
                </AnimatePresence>

                {/* Center Stage */}
                <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
                    {/* Toggle Sidebar Button logic placeholder */}

                    {/* Waveform Visualizer (Top Sticky) */}
                    <div className="shrink-0 bg-card/40 border-b border-border/40 backdrop-blur-md p-4 pb-2 z-10">
                        <div className="flex items-center gap-4 mb-2">
                            <Button
                                variant="secondary"
                                size="icon"
                                className="h-10 w-10 rounded-full shadow-sm hover:scale-105 transition-transform"
                                onClick={() => audioControls.toggle()}
                            >
                                {audioState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                            </Button>

                            <div className="flex-1 h-16 bg-black/10 dark:bg-white/5 rounded-lg overflow-hidden border border-white/5 relative group">
                                <WaveformVisualizer
                                    duration={audioState.duration || 60}
                                    currentTime={audioState.currentTime}
                                    markers={waveformMarkers}
                                    onSeek={audioControls.seek}
                                    height={64}
                                />
                            </div>

                            <div className="flex flex-col items-end min-w-[60px] text-xs font-mono text-muted-foreground">
                                <span>{formatDuration(audioState.currentTime)}</span>
                                <span className="opacity-50">/ {formatDuration(audioState.duration)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Two-Column Content */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left: Transcript / Tabs */}
                        <div className="flex-1 flex flex-col min-w-0 border-r border-border/40">
                            <div className="flex items-center gap-6 px-4 border-b border-border/40 bg-card/20 backdrop-blur-sm">
                                <button
                                    onClick={() => setActiveTab('transcript')}
                                    className={cn(
                                        "py-3 text-sm font-medium transition-colors relative",
                                        activeTab === 'transcript' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Transcript
                                    {activeTab === 'transcript' && <motion.div layoutId="tab" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_-2px_8px_rgba(var(--primary),0.5)]" />}
                                </button>
                                <button
                                    onClick={() => setActiveTab('attachments')}
                                    className={cn(
                                        "py-3 text-sm font-medium transition-colors relative",
                                        activeTab === 'attachments' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Attachments
                                    {activeTab === 'attachments' && <motion.div layoutId="tab" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_-2px_8px_rgba(var(--primary),0.5)]" />}
                                </button>
                            </div>

                            <div className="flex-1 relative bg-card/10">
                                {activeTab === 'transcript' ? (
                                    <TranscriptPane />
                                ) : (
                                    <AttachmentsTab projectId={projectId || ""} />
                                )}
                            </div>
                        </div>

                        {/* Right: Insights & Widgets */}
                        <div className="w-[380px] shrink-0 border-l border-border/40 bg-card/20 backdrop-blur-sm hidden xl:flex flex-col overflow-hidden">
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Live Summary</h3>
                                        </div>
                                        <LiveSummaryPane />
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Participants</h3>
                                        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
                                            <ParticipantsPane />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Intelligence</h3>
                                        <ReviewWidgetPanel group="insights" />
                                        <ReviewWidgetPanel group="health" />
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

function formatDuration(seconds: number) {
    if (!seconds) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}
