import { useEffect, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { TopicCluster, TimestampMs, BlockId, ParticipantId, ClusterId } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';
import { useAICoPilotEngine } from '@/hooks/useAICoPilotEngine';

// Heuristic Constants
const CLUSTER_TIME_GAP_THRESHOLD_MS = 25000; // New topic if silence > 25s
const MIN_BLOCKS_PER_CLUSTER = 2;

export function useChapterEngine() {
    const {
        transcriptBlocks,
        isRecording,
        topicClusters,
    } = useMeetingStore();

    const { sendUserMessage } = useAICoPilotEngine();

    // --- Core Logic: Clustering ---
    const calculateClusters = useCallback(() => {
        if (!transcriptBlocks || transcriptBlocks.length === 0) return;

        // 1. Group blocks by time gaps
        const newClusters: TopicCluster[] = [];
        let currentClusterBlocks: typeof transcriptBlocks = [];

        transcriptBlocks.forEach((block, index) => {
            const prevBlock = transcriptBlocks[index - 1];
            // Duration estimate: text length * 50ms per char as fallback since TranscriptBlock lacks duration
            const prevDuration = prevBlock ? (prevBlock.text.length * 50) : 0;
            const isGap = prevBlock && (block.timestamp - (prevBlock.timestamp + prevDuration)) > CLUSTER_TIME_GAP_THRESHOLD_MS;

            if (isGap && currentClusterBlocks.length >= MIN_BLOCKS_PER_CLUSTER) {
                // Finalize previous cluster
                newClusters.push(createClusterFromBlocks(currentClusterBlocks));
                currentClusterBlocks = [];
            }
            currentClusterBlocks.push(block);
        });

        // Add the open, active cluster
        if (currentClusterBlocks.length > 0) {
            newClusters.push(createClusterFromBlocks(currentClusterBlocks));
        }

        // Only update if changed (deep compare or length check + id check)
        // For efficiency, we just overwrite for now or check length
        // In a real app, use a stable definition of "changed"
        useMeetingStore.setState({ topicClusters: newClusters });

    }, [transcriptBlocks]);

    // --- Helper: Create Cluster Object ---
    const createClusterFromBlocks = (blocks: typeof transcriptBlocks): TopicCluster => {
        if (blocks.length === 0) throw new Error("Empty blocks");

        const startTime = toBrand<TimestampMs>(blocks[0].timestamp);
        const lastBlock = blocks[blocks.length - 1];
        const lastDuration = lastBlock.text.length * 50;
        const endTime = toBrand<TimestampMs>(lastBlock.timestamp + lastDuration);

        // 1. Dominant Speaker
        const speakerDurations: Record<string, number> = {};
        blocks.forEach(b => {
            const duration = b.text.length * 50;
            const sid = b.speakerId || 'unknown';
            speakerDurations[sid] = (speakerDurations[sid] || 0) + duration;
        });
        const dominantSpeakerId = toBrand<ParticipantId>(Object.entries(speakerDurations)
            .sort(([, a], [, b]) => b - a)[0]?.[0]);

        // 2. Keywords (Simple Frequency)
        const allText = blocks.map(b => b.text).join(" ").toLowerCase();
        const words = allText.match(/\b(\w+)\b/g) || [];
        const stopWords = new Set(['the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'it', 'for', 'on', 'with', 'as', 'was', 'at', 'this', 'we', 'you', 'i', 'are']);
        const freq: Record<string, number> = {};
        words.forEach(w => {
            if (!stopWords.has(w) && w.length > 3) freq[w] = (freq[w] || 0) + 1;
        });
        const keywords = Object.entries(freq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([w]) => w);

        // 3. AI TL;DR (Heuristic)
        const summary = `Discussion focusing on ${keywords.join(', ') || 'general topics'}`;

        // 4. Density Map (Sparkline)
        const totalDuration = endTime - startTime;
        const densityMap = blocks.map(b => ({
            position: totalDuration > 0 ? (b.timestamp - startTime) / totalDuration : 0,
            intensity: Math.min(1, (b.text.length / 100)), // Normalized intensity
            speakerId: toBrand<ParticipantId>(b.speakerId || 'unknown')
        }));

        // 5. Sentiment & Temperature (Heuristic)
        const negativeWords = ['issue', 'problem', 'error', 'bug', 'fail', 'concern', 'bad', 'wrong'];
        const positiveWords = ['great', 'success', 'good', 'fixed', 'solved', 'love', 'happy', 'ok'];
        let score = 0;
        words.forEach(w => {
            if (negativeWords.includes(w)) score--;
            if (positiveWords.includes(w)) score++;
        });

        const sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
        // 'active' maps to tense/ambiguous/productive depending on score sign? 
        const finalTemp = score < -2 ? 'tense' : score > 2 ? 'productive' : 'neutral';

        return {
            id: toBrand<ClusterId>(`chapter-${startTime}`),
            name: keywords[0] ? (keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1)) : "General Discussion",
            blocks: blocks.map(b => toBrand<BlockId>(b.id)),
            startTime,
            endTime,
            sentiment,
            keywords,
            participantCount: Object.keys(speakerDurations).length,
            summary,
            dominantSpeakerId,
            densityMap,
            temperature: finalTemp as any,
            timestamp: startTime,
            confidence: 0.85
        };
    };

    // --- Effect: Auto-Cluster Loop ---
    useEffect(() => {
        if (!isRecording) return;

        // Initial Calculation
        calculateClusters();

        // Interval
        const interval = setInterval(() => {
            calculateClusters();
        }, 45000); // 45s as requested

        return () => clearInterval(interval);
    }, [isRecording, calculateClusters]); // transcriptBlocks dependency in calculateClusters handles updates

    // --- Action: Interrogate ---
    const interrogateTopic = (cluster: TopicCluster) => {
        const prompt = `Give me more details about what was decided in the topic "${cluster.name}" (Chapter: ${cluster.summary})`;
        // Focus CoPilot via message injection
        sendUserMessage(prompt);

        // Optional: Trigger UI focus to CoPilot panel if architecture supports it
    };

    return {
        topicClusters,
        interrogateTopic
    };
}
