import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, XCircle } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ParticipantStatCard, type InsightsData } from "./ParticipantStatCard";

// --- Main Component ---

export function ParticipantInsights() {
    const { participants, transcriptBlocks, partialTranscript, speakerFilter, setSpeakerFilter } = useMeetingStore();

    // 1. Optimized O(N) Aggregation + Real-time Partial Handling
    const insights = useMemo(() => {
        const stats = new Map<string, {
            speakingTime: number;
            contributions: number;
            timestamps: number[];
            sentimentSum: number;
            sentimentCount: number;
            lastActive: number;
        }>();

        // 1.1 Process Completed Blocks
        let totalTime = 0;
        let sessionStartTime = Number.MAX_SAFE_INTEGER;
        let sessionEndTime = 0;

        transcriptBlocks.forEach(block => {
            const speaker = block.speaker || "Unknown";
            sessionStartTime = Math.min(sessionStartTime, block.timestamp);
            sessionEndTime = Math.max(sessionEndTime, block.timestamp);

            // Initialize if new
            if (!stats.has(speaker)) {
                stats.set(speaker, {
                    speakingTime: 0,
                    contributions: 0,
                    timestamps: [],
                    sentimentSum: 0,
                    sentimentCount: 0,
                    lastActive: 0
                });
            }

            const entry = stats.get(speaker)!;

            const duration = block.text.length * 0.06;
            const safeDuration = Math.max(2000, Math.min(15000, duration * 1000));

            entry.speakingTime += safeDuration;
            totalTime += safeDuration;
            entry.contributions += 1;
            entry.timestamps.push(block.timestamp);
            entry.lastActive = Math.max(entry.lastActive, block.timestamp);

            if (block.sentiment) {
                entry.sentimentCount++;
                entry.sentimentSum += block.sentiment === 'positive' ? 1 : block.sentiment === 'negative' ? -1 : 0;
            }
        });

        // Handle empty session case for time range
        if (sessionStartTime === Number.MAX_SAFE_INTEGER) {
            sessionStartTime = Date.now();
            sessionEndTime = Date.now();
        }

        // 1.2 Incorporate Partial Transcript (Real-time)
        if (partialTranscript && partialTranscript.speaker) {
            const speaker = partialTranscript.speaker;
            if (!stats.has(speaker)) {
                stats.set(speaker, {
                    speakingTime: 0,
                    contributions: 0,
                    timestamps: [],
                    sentimentSum: 0,
                    sentimentCount: 0,
                    lastActive: Date.now()
                });
            }
            const entry = stats.get(speaker)!;
            // Estimate partial time
            const partialDuration = partialTranscript.text.length * 60;
            entry.speakingTime += partialDuration;
            totalTime += partialDuration;
            entry.lastActive = Date.now(); // Currently active
            entry.timestamps.push(Date.now()); // Add current activity to trend
            sessionEndTime = Math.max(sessionEndTime, Date.now());
        }

        // 1.3 Map Back to Participants or Create Guests
        const allSpeakers = new Set([...participants.map(p => p.name || p.speakerId), ...stats.keys()]);

        return Array.from(allSpeakers).map(speakerName => {
            const data = stats.get(speakerName) || {
                speakingTime: 0,
                contributions: 0,
                timestamps: [],
                sentimentSum: 0,
                sentimentCount: 0,
                lastActive: 0
            };

            const knownParticipant = participants.find(p => p.name === speakerName || p.speakerId === speakerName);

            const airtimePercentage = totalTime > 0 ? Math.round((data.speakingTime / totalTime) * 100) : 0;
            const avgSentiment = data.sentimentCount > 0 ? data.sentimentSum / data.sentimentCount : 0;

            // --- Trend Logic: Bucket Density ---
            // Divide session into 10 buckets and count activity in each
            const buckets = 10;
            const sessionDuration = Math.max(1000, sessionEndTime - sessionStartTime);
            const bucketSize = sessionDuration / buckets;
            const activityTrend = new Array(buckets).fill(0);

            if (data.timestamps.length > 0) {
                data.timestamps.forEach(ts => {
                    const relativeTime = ts - sessionStartTime;
                    const bucketIndex = Math.min(buckets - 1, Math.floor(relativeTime / bucketSize));
                    if (bucketIndex >= 0) {
                        activityTrend[bucketIndex] += 1;
                    }
                });
            } else {
                // Fallback: Deterministic trend based on name hash if no real data yet
                // (Prevents flat line on initialization, looks "alive")
                let hash = 0;
                for (let i = 0; i < speakerName.length; i++) hash = speakerName.charCodeAt(i) + ((hash << 5) - hash);
                for (let i = 0; i < buckets; i++) {
                    activityTrend[i] = Math.abs(Math.sin(hash + i)) * 5;
                }
            }

            return {
                id: knownParticipant?.id || speakerName,
                name: speakerName,
                isGuest: !knownParticipant,
                isSpeaking: partialTranscript?.speaker === speakerName,
                speakingTime: data.speakingTime,
                contributions: data.contributions,
                airtimePercentage,
                avgSentiment, // -1 to 1
                activityTrend,
                lastActive: data.lastActive
            } as InsightsData;
        }).sort((a, b) => b.isSpeaking ? -1 : b.lastActive - a.lastActive);

    }, [transcriptBlocks, partialTranscript, participants]);


    if (insights.length === 0) {
        return (
            <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Analytics Command Center
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <p className="text-xs text-muted-foreground text-center pt-2">Waiting for session activity...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border flex flex-col h-full bg-card/50 shadow-none">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <span>Command Center</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {speakerFilter && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => setSpeakerFilter(null)}
                            >
                                <XCircle className="h-3 w-3 mr-1" />
                                Clear Filter
                            </Button>
                        )}
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                            {insights.length} Active
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden relative">
                {/* 
                    Mobile: Horizontal Scroll Snap Carousel 
                    Desktop: Vertical List 
                */}
                <div className="absolute inset-0 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto custom-scrollbar flex sm:flex-col gap-4 sm:gap-0 sm:divide-y sm:divide-border px-4 py-4 sm:px-0 sm:py-0 snap-x snap-mandatory sm:snap-none">
                    <AnimatePresence initial={false}>
                        {insights.map((p) => (
                            <ParticipantStatCard
                                key={p.id}
                                data={p}
                                isFiltered={speakerFilter === p.name}
                                onClick={() => setSpeakerFilter(speakerFilter === p.name ? null : p.name)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}

