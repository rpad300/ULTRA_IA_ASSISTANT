import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Smile, Frown, Meh } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

export function SentimentAnalysisPane() {
    const { transcriptBlocks, analyzeSentiment } = useMeetingStore();

    // Analyze sentiment for all blocks
    const sentimentData = useMemo(() => {
        const analyzed = transcriptBlocks.map(block => {
            if (!block.sentiment) {
                const sentiment = analyzeSentiment(block.text);
                // Update block with sentiment (would need to update store)
                return { ...block, sentiment };
            }
            return block;
        });

        const positive = analyzed.filter(b => b.sentiment === 'positive').length;
        const neutral = analyzed.filter(b => b.sentiment === 'neutral').length;
        const negative = analyzed.filter(b => b.sentiment === 'negative').length;
        const total = analyzed.length;

        return {
            positive: total > 0 ? Math.round((positive / total) * 100) : 0,
            neutral: total > 0 ? Math.round((neutral / total) * 100) : 0,
            negative: total > 0 ? Math.round((negative / total) * 100) : 0,
            overall: total > 0
                ? positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'
                : 'neutral',
        };
    }, [transcriptBlocks, analyzeSentiment]);



    const getOverallColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return "bg-green-500/10 text-green-500 border-green-500/20";
            case 'negative': return "bg-red-500/10 text-red-500 border-red-500/20";
            default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
        }
    };

    const getOverallIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return <Smile className="h-4 w-4 text-green-500" />;
            case 'negative': return <Frown className="h-4 w-4 text-red-500" />;
            default: return <Meh className="h-4 w-4 text-yellow-500" />;
        }
    };

    if (transcriptBlocks.length === 0) {
        return (
            <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Sentiment Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Sentiment analysis will appear as the meeting progresses
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Sentiment Analysis
                    </CardTitle>
                    <Badge variant="outline" className={cn("text-xs", getOverallColor(sentimentData.overall))}>
                        {getOverallIcon(sentimentData.overall)}
                        <span className="ml-1 capitalize">{sentimentData.overall}</span>
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Positive */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-muted-foreground">Positive</span>
                        </div>
                        <span className="font-medium">{sentimentData.positive}%</span>
                    </div>
                    <Progress value={sentimentData.positive} className="h-2 bg-green-500/20" />
                </div>

                {/* Neutral */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <Minus className="h-3 w-3 text-yellow-500" />
                            <span className="text-muted-foreground">Neutral</span>
                        </div>
                        <span className="font-medium">{sentimentData.neutral}%</span>
                    </div>
                    <Progress value={sentimentData.neutral} className="h-2 bg-yellow-500/20" />
                </div>

                {/* Negative */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="h-3 w-3 text-red-500" />
                            <span className="text-muted-foreground">Negative</span>
                        </div>
                        <span className="font-medium">{sentimentData.negative}%</span>
                    </div>
                    <Progress value={sentimentData.negative} className="h-2 bg-red-500/20" />
                </div>

                {/* Real-time sentiment trend */}
                <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Recent Trend</p>
                    <div className="flex items-center gap-1 h-8">
                        {transcriptBlocks.slice(-20).map((block, index) => {
                            const sentiment = block.sentiment || analyzeSentiment(block.text);
                            const color = sentiment === 'positive' ? 'bg-green-500' : sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500';
                            return (
                                <motion.div
                                    key={block.id}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={cn("flex-1 h-full rounded-sm", color, "opacity-60 hover:opacity-100 transition-opacity")}
                                    title={`${block.speaker}: ${sentiment}`}
                                />
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

