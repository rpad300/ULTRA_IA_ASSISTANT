import { useMemo, useCallback } from 'react';
import type { TranscriptBlock } from '@/store/meetingStore';

interface UseTimelineEngineProps {
    duration: number; // in seconds
    zoom: number;
    containerWidth: number;
}

export interface TimelineEvent {
    id: string;
    time: number;
    type: 'transcript' | 'action' | 'risk' | 'highlight';
    data: any;
    priority: number; // 0-10, higher is more important
}

export interface TimelineCluster {
    id: string;
    startTime: number;
    endTime: number;
    events: TimelineEvent[];
    centerTime: number;
    count: number;
    primaryType: 'transcript' | 'action' | 'risk' | 'highlight' | 'mixed';
}

export function useTimelineEngine({ duration, zoom, containerWidth }: UseTimelineEngineProps) {
    // Basic scaling constants
    const MIN_PX_PER_SEC = 2; // At 1x zoom

    // Calculate total width of the timeline track
    const totalWidth = useMemo(() => {
        return Math.max(containerWidth, duration * MIN_PX_PER_SEC * zoom);
    }, [duration, zoom, containerWidth]);

    // Time <-> Pixel conversion
    const timeToPx = useCallback((time: number) => {
        if (duration === 0) return 0;
        return (time / duration) * totalWidth;
    }, [duration, totalWidth]);

    const pxToTime = useCallback((px: number) => {
        if (totalWidth === 0) return 0;
        return (px / totalWidth) * duration;
    }, [duration, totalWidth]);

    // Clustering Logic
    // Groups events that are visually too close to each other
    const computeClusters = useCallback((
        events: TimelineEvent[],
        thresholdPx: number = 24 // Minimum pixels between distinct items
    ): TimelineCluster[] => {
        if (!events.length) return [];

        const clusters: TimelineCluster[] = [];
        let currentCluster: TimelineEvent[] = [];
        let clusterStartTime = events[0].time;

        const sortedEvents = [...events].sort((a, b) => a.time - b.time);

        sortedEvents.forEach((event, index) => {
            const eventPx = timeToPx(event.time);
            const prevEvent = currentCluster.length > 0 ? currentCluster[currentCluster.length - 1] : null;

            let shouldCluster = false;
            if (prevEvent) {
                const prevPx = timeToPx(prevEvent.time);
                if (eventPx - prevPx < thresholdPx) {
                    shouldCluster = true;
                }
            }

            if (shouldCluster) {
                currentCluster.push(event);
            } else {
                // Finalize previous cluster
                if (currentCluster.length > 0) {
                    const centerTime = currentCluster.reduce((sum, e) => sum + e.time, 0) / currentCluster.length;
                    const primaryType = getPrimaryType(currentCluster);

                    clusters.push({
                        id: `cluster-${clusters.length}`,
                        startTime: clusterStartTime,
                        endTime: currentCluster[currentCluster.length - 1].time,
                        events: [...currentCluster],
                        centerTime,
                        count: currentCluster.length,
                        primaryType
                    });
                }
                // Start new cluster
                currentCluster = [event];
                clusterStartTime = event.time;
            }

            // Handle last item
            if (index === sortedEvents.length - 1 && currentCluster.length > 0) {
                const centerTime = currentCluster.reduce((sum, e) => sum + e.time, 0) / currentCluster.length;
                const primaryType = getPrimaryType(currentCluster);

                clusters.push({
                    id: `cluster-${clusters.length}`,
                    startTime: clusterStartTime,
                    endTime: currentCluster[currentCluster.length - 1].time,
                    events: [...currentCluster],
                    centerTime,
                    count: currentCluster.length,
                    primaryType
                });
            }
        });

        return clusters;
    }, [timeToPx]);

    // Helper: Determine dominant type in a cluster
    const getPrimaryType = (events: TimelineEvent[]): TimelineCluster['primaryType'] => {
        const counts = events.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Priority: Risk > Action > Highlight > Transcript
        if (counts['risk']) return 'risk';
        if (counts['action']) return 'action';
        if (counts['highlight']) return 'highlight';
        if (Object.keys(counts).length > 1) return 'mixed';
        return 'transcript';
    };

    // Helper: Generate Heatmap Data
    // Buckets time into chunks and counts density
    const generateHeatmap = useCallback((transcriptBlocks: TranscriptBlock[], buckets: number) => {
        if (!transcriptBlocks.length || duration === 0) return [];

        const bucketSize = duration / buckets;
        const heatArray = new Array(buckets).fill(0);

        transcriptBlocks.forEach(block => {
            if (block.timestamp > duration) return;
            const bucketIndex = Math.min(Math.floor(block.timestamp / bucketSize), buckets - 1);
            // Weight interaction: longer text = more heat? or just count?
            // User requested "trocas de turno" (turn exchanges) -> better metric is block count
            heatArray[bucketIndex] += 1;
        });

        // Normalize
        const maxHeat = Math.max(...heatArray, 1);
        return heatArray.map(val => val / maxHeat);
    }, [duration]);


    return {
        totalWidth,
        timeToPx,
        pxToTime,
        computeClusters,
        generateHeatmap
    };
}
