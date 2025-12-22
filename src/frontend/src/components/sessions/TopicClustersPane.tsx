import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderTree, TrendingUp, TrendingDown, Minus, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime } from "@/utils/timeUtils";

export function TopicClustersPane() {
    const { topicClusters } = useMeetingStore();

    useEffect(() => {
        const store = useMeetingStore.getState();
        store.autoClusterTopics(); // Initial cluster

        const interval = setInterval(() => {
            useMeetingStore.getState().autoClusterTopics();
        }, 45000); // Optimized: Re-cluster every 45 seconds (was 20)

        return () => clearInterval(interval);
    }, []); // Only run once on mount

    const sortedClusters = useMemo(() => {
        if (!topicClusters || !Array.isArray(topicClusters)) {
            return [];
        }
        return [...topicClusters].sort((a, b) => b.blocks.length - a.blocks.length);
    }, [topicClusters]);

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return <TrendingUp className="h-3 w-3 text-green-500" />;
            case 'negative': return <TrendingDown className="h-3 w-3 text-red-500" />;
            default: return <Minus className="h-3 w-3 text-yellow-500" />;
        }
    };

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return "bg-green-500/10 text-green-500 border-green-500/20";
            case 'negative': return "bg-red-500/10 text-red-500 border-red-500/20";
            default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
        }
    };

    if (sortedClusters.length === 0) {
        return (
            <Card className="border-border">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-primary" />
                        Topic Clusters
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Topics will be automatically clustered as the meeting progresses
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
                        <FolderTree className="h-4 w-4 text-primary" />
                        Topic Clusters
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {sortedClusters.length}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                <AnimatePresence mode="popLayout">
                    {sortedClusters.map((cluster, index) => (
                        <motion.div
                            key={cluster.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 rounded-lg border border-border hover:border-primary/40 transition-all cursor-pointer group"
                            onClick={() => {
                                // Navigate to first block in cluster
                                const firstBlock = document.querySelector(`[data-block-id="${cluster.blocks[0]}"]`);
                                firstBlock?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-medium">{cluster.name}</h4>
                                        {getSentimentIcon(cluster.sentiment)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatTime(cluster.startTime)} - {formatTime(cluster.endTime)}</span>
                                        <span>•</span>
                                        <Users className="h-3 w-3" />
                                        <span>{cluster.participantCount} participants</span>
                                        <span>•</span>
                                        <span>{cluster.blocks.length} blocks</span>
                                    </div>
                                    {cluster.keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {cluster.keywords.slice(0, 3).map((keyword, i) => (
                                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                                    {keyword}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Badge variant="outline" className={cn("text-xs shrink-0", getSentimentColor(cluster.sentiment))}>
                                    {cluster.sentiment}
                                </Badge>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

