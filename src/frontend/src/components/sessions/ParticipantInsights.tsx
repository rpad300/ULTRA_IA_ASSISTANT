import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { formatTime } from "@/utils/timeUtils";

export function ParticipantInsights() {
    const { participants, transcriptBlocks } = useMeetingStore();

    // Calculate insights for each participant (derived values only, no state updates)
    const participantInsights = useMemo(() => {
        if (transcriptBlocks.length === 0) return [];

        const insights = participants.map(participant => {
            const blocks = transcriptBlocks.filter(b =>
                b.speaker === participant.speakerId ||
                b.speaker === participant.name ||
                (participant.name && b.speaker.includes(participant.name))
            );
            const speakingTime = blocks.length * 5; // Estimate: 5 seconds per block
            const contributionCount = blocks.length;
            const engagementScore = transcriptBlocks.length > 0
                ? Math.min(100, (contributionCount / transcriptBlocks.length) * 100 * 2)
                : 0;

            return {
                ...participant,
                speakingTime,
                contributionCount,
                engagementScore: Math.round(engagementScore),
            };
        });

        // Return filtered and sorted insights (no state updates during render)
        return insights
            .filter(p => p.contributionCount > 0)
            .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));
    }, [participants, transcriptBlocks]);

    const totalSpeakingTime = participantInsights.reduce((sum, p) => sum + (p.speakingTime || 0), 0);

    if (participantInsights.length === 0) {
        return (
            <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Participant Insights
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Insights will appear as participants speak
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Participant Insights
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {participantInsights.map((participant, index) => {
                    const speakingPercentage = totalSpeakingTime > 0
                        ? Math.round((participant.speakingTime || 0) / totalSpeakingTime * 100)
                        : 0;

                    return (
                        <motion.div
                            key={participant.speakerId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium",
                                        participant.isSpeaking
                                            ? "bg-primary/20 text-primary"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        {participant.name?.[0] || participant.speakerId[0] || '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">
                                            {participant.name || participant.speakerId}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            <span>{formatTime(participant.speakingTime || 0)}</span>
                                            <span>•</span>
                                            <MessageSquare className="h-3 w-3" />
                                            <span>{participant.contributionCount || 0} contributions</span>
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {participant.engagementScore || 0}% engaged
                                </Badge>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Speaking time</span>
                                    <span className="font-medium">{speakingPercentage}%</span>
                                </div>
                                <Progress value={speakingPercentage} className="h-2" />
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Engagement</span>
                                    <span className="font-medium">{participant.engagementScore || 0}%</span>
                                </div>
                                <Progress
                                    value={participant.engagementScore || 0}
                                    className={cn(
                                        "h-2",
                                        (participant.engagementScore || 0) >= 70 && "bg-green-500",
                                        (participant.engagementScore || 0) >= 40 && (participant.engagementScore || 0) < 70 && "bg-yellow-500",
                                        (participant.engagementScore || 0) < 40 && "bg-red-500"
                                    )}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

