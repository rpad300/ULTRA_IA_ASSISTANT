import { useState, useEffect, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { LiveSummaryItem, TimestampMs, BlockId } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

export function useLiveSummaryEngine() {
    const { liveSummary, updateLiveSummary, addNotification } = useMeetingStore();
    const [isLive, setIsLive] = useState(true);

    // Deep Linking Handler
    const scrollToBlock = useCallback((blockId: BlockId) => {
        const element = document.getElementById(`block-${blockId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Visual feedback
            element.classList.add('bg-primary/20', 'transition-colors', 'duration-500');
            setTimeout(() => {
                element.classList.remove('bg-primary/20');
            }, 2000);
        } else {
            console.warn(`Block ${blockId} not found in DOM`);
        }
    }, []);

    // Engine Pulse & Mock Generator
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isLive) return;

            // --- SIMULATION / MOCK LOGIC START ---
            const state = useMeetingStore.getState();
            // Access transcriptBlocks directly from state to avoid dependency loop or unused var in hook scope
            const blocks = state.transcriptBlocks;
            const currentSummary = state.liveSummary;

            if (blocks.length > 0) {
                const newItems: Partial<import('@/store/slices/intelligenceSlice').LiveSummary> = {
                    lastUpdated: toBrand<TimestampMs>(Date.now())
                };

                let hasChanges = false;

                // 1. Generate Key Points (Mock: Every 5th block is a key point)
                if ((currentSummary?.keyPoints.length || 0) < Math.floor(blocks.length / 5)) {
                    const idx = (currentSummary?.keyPoints.length || 0) * 5;
                    const block = blocks[idx];
                    if (block) {
                        const newItem: LiveSummaryItem = {
                            id: `kp-${Date.now()}`,
                            text: `Discussed: ${block.text.substring(0, 50)}...`,
                            type: 'key_point',
                            timestamp: toBrand<TimestampMs>(Date.now()),
                            status: 'confirmed',
                            confidence: 1.0,
                            lineage: { blockId: toBrand<BlockId>(block.id) }
                        };
                        newItems.keyPoints = [...(currentSummary?.keyPoints || []), newItem];
                        hasChanges = true;
                    }
                }

                // 2. Generate Decisions (Mock: Randomly if block contains "agree" or "decide")
                // Only if we haven't generated one recently
                if (Math.random() > 0.7) {
                    const decisionBlock = blocks.slice(-3).find(b => b.text.toLowerCase().includes('agree') || b.text.toLowerCase().includes('ok'));
                    if (decisionBlock && !currentSummary?.decisions.some(d => d.lineage?.blockId === decisionBlock.id)) {
                        const newItem: LiveSummaryItem = {
                            id: `dec-${Date.now()}`,
                            text: `Decision: ${decisionBlock.text}`,
                            type: 'decision',
                            timestamp: toBrand<TimestampMs>(Date.now()),
                            status: 'pending',
                            confidence: 0.8,
                            lineage: { blockId: toBrand<BlockId>(decisionBlock.id) }
                        };
                        newItems.decisions = [...(currentSummary?.decisions || []), newItem];
                        hasChanges = true;
                    }
                }

                // 3. Generate Action Items (Mock: Randomly if block contains "will" or "todo")
                if (Math.random() > 0.8) {
                    const actionBlock = blocks.slice(-3).find(b => b.text.toLowerCase().includes('will') || b.text.toLowerCase().includes('need to'));
                    if (actionBlock && !currentSummary?.actionItems.some(d => d.lineage?.blockId === actionBlock.id)) {
                        const newItem: LiveSummaryItem = {
                            id: `act-${Date.now()}`,
                            text: `Action: ${actionBlock.text}`,
                            type: 'action_item',
                            timestamp: toBrand<TimestampMs>(Date.now()),
                            status: 'pending',
                            confidence: 0.8,
                            lineage: { blockId: toBrand<BlockId>(actionBlock.id) }
                        };
                        newItems.actionItems = [...(currentSummary?.actionItems || []), newItem];
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    updateLiveSummary(newItems);
                } else {
                    // Heartbeat only
                    updateLiveSummary({});
                }
            } else {
                updateLiveSummary({});
            }
            // --- SIMULATION END ---

        }, 5000); // 30s logic applied via store, but 5s pulse for demonstration

        return () => clearInterval(interval);
    }, [isLive, updateLiveSummary]);

    // Initial Trigger
    useEffect(() => {
        updateLiveSummary({});
    }, []);

    // Copy to Clipboard
    const copyToClipboard = useCallback(() => {
        if (!liveSummary) return;

        const formatSection = (title: string, items: readonly LiveSummaryItem[]) => {
            if (items.length === 0) return '';
            return `## ${title}\n${items.map(i => `- ${i.text}`).join('\n')}\n\n`;
        };

        const markdown =
            `# Meeting Summary\nGenerated by Ultra Assistant\n\n` +
            formatSection('Key Points', liveSummary.keyPoints) +
            formatSection('Decisions', liveSummary.decisions) +
            formatSection('Action Items', liveSummary.actionItems);

        navigator.clipboard.writeText(markdown);

        // infer types: id, timestamp, read are generated by store if missing or not required by addNotification signature
        addNotification({
            type: 'success',
            title: 'Summary Copied',
            message: 'Markdown summary copied to clipboard.',
            priority: 'low'
        });
    }, [liveSummary, addNotification]);

    // Helper to check if item is "New" (last 60 seconds)
    const isItemNew = useCallback((item: LiveSummaryItem) => {
        return (Date.now() - item.timestamp) < 60000;
    }, []);

    // Interactive Actions
    const handleValidateItem = useCallback((id: string) => {
        const { updateLiveSummaryItem } = useMeetingStore.getState();
        updateLiveSummaryItem(id, { status: 'confirmed' });

        addNotification({
            type: 'success',
            title: 'Item Validated',
            message: 'Decision confirmed and logged.',
            priority: 'low'
        });
    }, [addNotification]);

    const handleEditItem = useCallback((id: string, newText: string) => {
        const { updateLiveSummaryItem } = useMeetingStore.getState();
        updateLiveSummaryItem(id, { text: newText });
    }, []);

    const handleRejectItem = useCallback((id: string) => {
        const { updateLiveSummaryItem } = useMeetingStore.getState();
        updateLiveSummaryItem(id, { status: 'rejected' });
    }, []);

    return {
        liveSummary,
        scrollToBlock,
        copyToClipboard,
        isLive,
        setIsLive,
        isItemNew,
        handleValidateItem,
        handleEditItem,
        handleRejectItem
    };
}
