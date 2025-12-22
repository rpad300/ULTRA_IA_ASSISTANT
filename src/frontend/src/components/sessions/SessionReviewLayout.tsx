import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type Session, workspaceApi } from "@/api/client";
import { Copy, Download, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";

import { TranscriptPane } from "@/components/sessions/TranscriptPane";
import { AttachmentsTab } from "@/components/sessions/AttachmentsTab";
import { ParticipantsPane } from "@/components/sessions/ParticipantsPane";
import { LiveSummaryPane } from "@/components/sessions/LiveSummaryPane";
import { type WidgetGroup, DASHBOARD_WIDGETS } from "@/config/dashboardWidgets";
import { useMeetingStore } from "@/store/meetingStore";

// Helper
const ReviewWidgetPanel = ({ group }: { group: WidgetGroup }) => {
    const widgets = Object.values(DASHBOARD_WIDGETS).filter(w => w.group === group);
    return (
        <div className="flex flex-col gap-3">
            {widgets.map(config => {
                const Widget = config.component;
                return (
                    <div key={config.id} className="rounded-xl border border-border bg-card/30 p-1">
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

    // SOTA: Real Audio Player sync would go here
    // const audioRef = useRef<HTMLAudioElement>(null);

    const { liveSummary } = useMeetingStore();

    const handleCopySummary = () => {
        if (!liveSummary) {
            toast.error("No summary available");
            return;
        }
        const text = [
            "Session Summary",
            "===============",
            "\n## Key Points",
            ...liveSummary.keyPoints.map(p => `• ${p}`),
            "\n## Decisions",
            ...liveSummary.decisions.map(d => `• ${d}`),
            "\n## Action Items",
            ...liveSummary.actionItems.map(a => `☐ ${a}`)
        ].join("\n");

        navigator.clipboard.writeText(text);
        toast.success("Summary copied to clipboard");
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
            {/* 1. Review Header */}
            <div className="shrink-0 p-6 border-b border-border bg-card/50 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">Session Review</h1>
                            <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                                Completed
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(session.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{new Date(session.created_at).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopySummary}
                        >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Summary
                        </Button>
                        <Button variant="default" size="sm" className="bg-blue-600">
                            <Download className="w-4 h-4 mr-2" />
                            Export Report
                        </Button>
                    </div>
                </div>

                {/* Audio Player */}
                {session.audio_file_drive_id && (
                    <div className="w-full bg-secondary/20 p-3 rounded-lg border border-white/5 mb-6">
                        <audio
                            controls
                            className="w-full h-10 outline-none"
                            src={workspaceApi.getSessionAudioUrl(session.id)}
                        />
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-6 border-b border-border/50">
                    <button
                        onClick={() => setActiveTab('transcript')}
                        className={cn("pb-3 text-sm font-medium transition-all relative", activeTab === 'transcript' ? "text-primary" : "text-muted-foreground")}
                    >
                        Transcript & Insights
                        {activeTab === 'transcript' && <motion.div layoutId="activeTabReview" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('attachments')}
                        className={cn("pb-3 text-sm font-medium transition-all relative", activeTab === 'attachments' ? "text-primary" : "text-muted-foreground")}
                    >
                        Attachments
                        {activeTab === 'attachments' && <motion.div layoutId="activeTabReview" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                    </button>
                </div>
            </div>

            {/* 2. Main Content */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0 overflow-hidden">
                {/* Left Column: Transcript/Attachments */}
                <div className="flex-1 flex flex-col bg-card/30 border border-border rounded-xl overflow-hidden min-h-0">
                    {activeTab === 'transcript' ? (
                        <TranscriptPane />
                    ) : (
                        <AttachmentsTab projectId={projectId || ""} />
                    )}
                </div>

                {/* Right Column: Insights Scrollable Feed */}
                <div className="w-full md:w-[400px] flex flex-col gap-4 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                    <div className="bg-card/40 border border-border p-4 rounded-xl">
                        <h3 className="font-semibold mb-3">Summary</h3>
                        <LiveSummaryPane />
                    </div>

                    <div className="bg-card/40 border border-border p-4 rounded-xl">
                        <h3 className="font-semibold mb-3">Participants</h3>
                        <ParticipantsPane />
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">AI Insights</h3>
                        <ReviewWidgetPanel group="insights" />
                        <ReviewWidgetPanel group="health" />
                        <ReviewWidgetPanel group="timeline" />
                    </div>
                </div>
            </div>
        </div>
    );
}
