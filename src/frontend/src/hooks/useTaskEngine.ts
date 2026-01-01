import { useMemo, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { useNetworkWorker } from './useNetworkWorker';
import type { DetectedAction, BlockId, ParticipantId } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';
import { addDays, nextFriday, format } from 'date-fns';

export interface TaskEngineReturn {
    processedActions: DetectedAction[];
    confirmAction: (actionId: string, modifications?: Partial<DetectedAction>) => void;
    deleteAction: (actionId: string) => void;
    bulkConfirm: (actionIds: string[]) => void;
    stats: {
        highPriorityCount: number;
        avgConfidence: number;
    };
    navigateToContext: (blockId: BlockId) => void;
}

// Simple heuristic keyword maps
const URGENCY_KEYWORDS = {
    high: ['asap', 'urgent', 'critical', 'immediately', 'blocker', 'prioritize'],
    medium: ['soon', 'next week', 'follow up', 'check'],
    low: ['eventually', 'maybe', 'later', 'if possible']
};

const TOOL_KEYWORDS = {
    jira: ['jira', 'ticket', 'bug', 'story', 'epic'],
    notion: ['notion', 'doc', 'page', 'wiki'],
    linear: ['linear', 'issue'],
    tasks: ['reminder', 'todo', 'task']
};

export function useTaskEngine(): TaskEngineReturn {
    const {
        detectedActions,
        participants,
        confirmActionAsTask,
        rejectDetectedAction,
        transcriptBlocks,
        // updateEmotionState, // Removed unused
        setFocusedBlockId
    } = useMeetingStore();

    // 1. Metadata Extraction & Auto-Calibration Engine
    const processedActions = useMemo(() => {
        return detectedActions
            .filter(a => !a.confirmed)
            .map(action => {
                // If metadata is already present (e.g. from backend), use it.
                // Otherwise, calculate it on the fly (Client-side AI simulation or enhancement).

                if (action.confidence) return action; // Already processed

                const textLower = action.text.toLowerCase();
                let confidence = 0.6; // Base confidence
                let priority: DetectedAction['priority'] = 'medium';
                let suggestedAssigneeId = undefined;
                let suggestedDueDate = undefined;
                let relatedTool: DetectedAction['relatedTool'] = 'tasks';

                // A. Priority Detection
                if (URGENCY_KEYWORDS.high.some(k => textLower.includes(k))) {
                    priority = 'high';
                    confidence += 0.15;
                } else if (URGENCY_KEYWORDS.low.some(k => textLower.includes(k))) {
                    priority = 'low';
                }

                // B. Assignee Extraction (NLP Suggestive)
                // specific logic: check if participant name is in text
                const foundParticipant = participants.find(p =>
                    p.name && textLower.includes(p.name.toLowerCase())
                );
                if (foundParticipant) {
                    suggestedAssigneeId = toBrand<ParticipantId>(foundParticipant.id);
                    confidence += 0.2;
                }

                // C. Due Date Extraction (Semantic)
                // Very basic regex/keyword matching for demo
                const today = new Date();
                if (textLower.includes('tomorrow')) {
                    suggestedDueDate = format(addDays(today, 1), 'yyyy-MM-dd');
                    confidence += 0.1;
                } else if (textLower.includes('friday') || textLower.includes('end of week')) {
                    suggestedDueDate = format(nextFriday(today), 'yyyy-MM-dd');
                    confidence += 0.1;
                }

                // D. Tool Integration Classification
                if (TOOL_KEYWORDS.jira.some(k => textLower.includes(k))) relatedTool = 'jira';
                else if (TOOL_KEYWORDS.notion.some(k => textLower.includes(k))) relatedTool = 'notion';
                else if (TOOL_KEYWORDS.linear.some(k => textLower.includes(k))) relatedTool = 'linear';

                // E. Context Lineage
                let lineage = action.lineage;

                if (!lineage?.blockId && transcriptBlocks.length > 0) {
                    // Find closest block before action timestamp
                    const closestBlock = [...transcriptBlocks]
                        .reverse()
                        .find(b => b.timestamp <= (action.timestamp as number)); // Cast to number for comparison
                    if (closestBlock) {
                        lineage = { blockId: toBrand<BlockId>(closestBlock.id) };
                    }
                }

                // Cap confidence
                confidence = Math.min(0.98, confidence);

                return {
                    ...action,
                    priority,
                    suggestedAssigneeId,
                    suggestedDueDate,
                    relatedTool,
                    confidence,
                    lineage
                } as DetectedAction;
            })
            .sort((a, b) => {
                // Dynamic Reordering: High Priority > High Confidence > Timestamp
                const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
                const pDiff = (priorityScore[b.priority || 'medium'] - priorityScore[a.priority || 'medium']);
                if (pDiff !== 0) return pDiff;

                const cDiff = (b.confidence || 0) - (a.confidence || 0);
                if (Math.abs(cDiff) > 0.1) return cDiff;

                return b.timestamp - a.timestamp;
            });
    }, [detectedActions, participants, transcriptBlocks]);

    // 2. Actions
    // SOTA: Offline-First Sync
    // We access the worker via the hook (or singleton if we prefer, but hook is safer for React context)
    // We assume the sessionId is active if we are using this engine.
    const sessionId = useMeetingStore(s => s.sessionId);
    const socketId = `transcription-${sessionId || 'default'}`;
    const { sendMessage: syncToBackend } = useNetworkWorker(socketId);

    const confirmAction = useCallback((actionId: string, modifications?: Partial<DetectedAction>) => {
        // Now fully supported by the store
        confirmActionAsTask(actionId, modifications);

        // SOTA: Sync to Backend (Queued by Worker if Offline)
        const action = detectedActions.find(a => a.id === actionId);
        if (action) {
            const payload = {
                type: 'sync_action',
                actionId,
                ...action,
                ...modifications,
                timestamp: Date.now()
            };
            syncToBackend(payload);
        }

        // Simulating external tool sync (keeping log for verified behavior as requested by user, but data IS preserved locally)
        if (modifications?.relatedTool) {
            console.log(`[Integration] Syncing to ${modifications.relatedTool}...`);
        }
    }, [confirmActionAsTask, detectedActions, syncToBackend]);

    const deleteAction = useCallback((actionId: string) => {
        rejectDetectedAction(actionId);
    }, [rejectDetectedAction]);

    const bulkConfirm = useCallback((actionIds: string[]) => {
        // Bulk confirm currently doesn't apply modifications, just accepts as is
        actionIds.forEach(id => confirmActionAsTask(id));
    }, [confirmActionAsTask]);

    const navigateToContext = useCallback((blockId: BlockId) => {
        setFocusedBlockId(blockId);
    }, [setFocusedBlockId]);

    // 3. Stats
    const stats = useMemo(() => ({
        highPriorityCount: processedActions.filter(a => a.priority === 'high').length,
        avgConfidence: processedActions.reduce((acc, a) => acc + (a.confidence || 0), 0) / (processedActions.length || 1)
    }), [processedActions]);

    return {
        processedActions,
        confirmAction,
        deleteAction,
        bulkConfirm,
        navigateToContext,
        stats
    };
}
