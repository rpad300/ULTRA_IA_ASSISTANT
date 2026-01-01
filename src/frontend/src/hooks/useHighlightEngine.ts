import { useEffect, useState, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { BlockId, TimestampMs } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

export function useHighlightEngine() {
    const transcriptBlocks = useMeetingStore(state => state.transcriptBlocks);
    const highlightGroups = useMeetingStore(state => state.highlightGroups);
    const createHighlightGroup = useMeetingStore(state => state.createHighlightGroup);
    const isRecording = useMeetingStore(state => state.isRecording);

    const [isProcessing, setIsProcessing] = useState(false);
    // const processingTimeoutRef = useRef<any>(null); // Unused for now

    // Topic Synthesis Heuristic
    const synthesizeTopic = (blocks: typeof transcriptBlocks, category: string) => {
        if (blocks.length === 0) return "New Collection";

        // Find the most significant noun phrase or act on the first block
        // Simple heuristic: Take the first 5-8 words of the first block
        const text = blocks[0].text;
        const snippet = text.split(' ').slice(0, 8).join(' ') + (text.split(' ').length > 8 ? '...' : '');

        const categoryLabels: Record<string, string> = {
            'decision': 'Decisão',
            'action': 'Ação',
            'risk': 'Risco',
            'insight': 'Insight',
            'question': 'Questão',
        };

        return `${categoryLabels[category] || 'Tópico'}: ${snippet}`;
    };

    // Clustering Engine
    const runClustering = useCallback(() => {
        if (!transcriptBlocks.length) return;

        setIsProcessing(true);

        // Simulate Neural Processing delay for effect
        setTimeout(() => {
            const ungroupedHighlights = transcriptBlocks.filter(b =>
                b.isHighlighted && !highlightGroups.some(g => g.blockIds.includes(toBrand<BlockId>(b.id)))
            );

            if (ungroupedHighlights.length === 0) {
                setIsProcessing(false);
                return;
            }

            // Simple clustering: Group highlights that are within 2 minutes of each other
            // Sort by time
            ungroupedHighlights.sort((a, b) => a.timestamp - b.timestamp);

            const clusters: typeof ungroupedHighlights[] = [];
            let currentCluster: typeof ungroupedHighlights = [];

            ungroupedHighlights.forEach((block, index) => {
                if (currentCluster.length === 0) {
                    currentCluster.push(block);
                } else {
                    const lastBlock = currentCluster[currentCluster.length - 1];
                    // 2 minutes threshold (120000ms)
                    if (block.timestamp - lastBlock.timestamp < 120000) {
                        currentCluster.push(block);
                    } else {
                        clusters.push([...currentCluster]);
                        currentCluster = [block];
                    }
                }

                // Push last cluster
                if (index === ungroupedHighlights.length - 1 && currentCluster.length > 0) {
                    clusters.push(currentCluster);
                }
            });

            // Create groups for clusters with > 1 item, or if it's a very significant single item (heuristic)
            clusters.forEach(cluster => {
                if (cluster.length >= 1) { // Current rule: Group even single items if they are "old" enough, but for now let's group all
                    // Determine category (majority vote or priority)
                    // Priority: Decision > Risk > Action > Insight > Question
                    // If we don't have per-block types, we default to 'insight' or try to detect keywords

                    let category: 'decision' | 'action' | 'risk' | 'insight' | 'question' | 'other' = 'insight';
                    const textCombined = cluster.map(b => b.text.toLowerCase()).join(' ');

                    if (textCombined.includes('decid') || textCombined.includes('agreed')) category = 'decision';
                    else if (textCombined.includes('risk') || textCombined.includes('worry')) category = 'risk';
                    else if (textCombined.includes('action') || textCombined.includes('todo')) category = 'action';
                    else if (textCombined.includes('?')) category = 'question';

                    const name = synthesizeTopic(cluster, category);

                    createHighlightGroup({
                        name,
                        blockIds: cluster.map(b => toBrand<BlockId>(b.id)),
                        category,
                        createdAt: toBrand<TimestampMs>(Date.now())
                    });

                    // Optional: Toast notification
                    // toast({
                    //     title: "Smart Grouping",
                    //     description: `Created new group: ${name}`,
                    // });
                }
            });

            setIsProcessing(false);
        }, 1500); // 1.5s "processing" time for the visual effect
    }, [transcriptBlocks, highlightGroups, createHighlightGroup]);

    // Auto-run interval
    useEffect(() => {
        if (!isRecording) return;

        const interval = setInterval(() => {
            runClustering();
        }, 45000); // 45s interval

        return () => clearInterval(interval);
    }, [isRecording, runClustering]);

    // Manual trigger exposed
    const triggerGrouping = useCallback(() => {
        runClustering();
    }, [runClustering]);

    return {
        isProcessing,
        triggerGrouping
    };
}
