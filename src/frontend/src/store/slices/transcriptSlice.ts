import type { MeetingSlice, TranscriptSlice } from '../types';
import { workspaceApi } from '@/api/client';
import type { TranscriptBlock } from '@/types/slices/transcript';

export const createTranscriptSlice: MeetingSlice<TranscriptSlice> = (set, get) => ({
    transcriptBlocks: [],
    partialBlock: null,
    partialTranscript: null, // Legacy alias sync

    handleTranscriptEvent: (data) => {
        const { transcript, text, is_final, end_of_turn, turn_id, trace_id, speaker, speaker_id, turn_order, correlation_id } = data;
        const content = transcript || text;
        if (!content) return;

        // Accessing sibling slice state safely
        const state = get();
        const timestamp = state.elapsedTime || Date.now();

        set((s) => {
            // Stable ID Generation
            const stableId = turn_id || correlation_id || (turn_order !== undefined ? `turn-${turn_order}` : Date.now().toString());
            const isFinal = is_final ?? end_of_turn ?? false;

            // 1. Partial Block Logic (Streaming UX)
            if (!isFinal) {
                const partial = {
                    id: 'partial',
                    text: content,
                    speaker: speaker || s.partialBlock?.speaker || 'Speaking...',
                    isFinal: false,
                    traceId: trace_id,
                    timestamp: timestamp,
                    updatedAt: Date.now()
                };
                s.partialBlock = partial;
                s.partialTranscript = partial;
                return;
            }

            // 2. Final Block Logic
            const newBlock: TranscriptBlock = {
                id: stableId,
                traceId: trace_id,
                speakerId: speaker_id,
                text: content.trim(),
                speaker: speaker || 'Speaker',
                isFinal: true,
                timestamp: timestamp,
                updatedAt: Date.now()
            };

            const existingBlock = s.transcriptBlocks.find(b => b.id === stableId);

            if (existingBlock) {
                // Update existing block (e.g., AI Correction)
                Object.assign(existingBlock, newBlock);
            } else {
                // Append new block
                s.transcriptBlocks.push(newBlock);
            }

            // Clear partials
            s.partialBlock = null;
            s.partialTranscript = null;
        });
    },

    updateSpeakerByTrace: (traceId, contactId, name) => {
        set((state) => {
            // Retroactive Update: Find all blocks with this traceId or temporary speaker name
            state.transcriptBlocks.forEach(block => {
                if (block.traceId === traceId || block.speaker === traceId) {
                    block.speaker = name;
                    block.speakerId = contactId;
                    block.updatedAt = Date.now();
                }
            });
        });
    },

    assignSpeakerOptimistically: (traceId, contactId, contactName) => {
        set((state) => {
            state.transcriptBlocks.forEach(block => {
                if (block.traceId === traceId) {
                    block.speaker = contactName;
                    block.speakerId = contactId;
                    block.updatedAt = Date.now();
                }
            });
        });
    },

    clearTranscript: () => set((state) => {
        state.transcriptBlocks = [];
        state.partialBlock = null;
        state.partialTranscript = null;
    }),

    toggleHighlight: (blockId) => set((state) => {
        const block = state.transcriptBlocks.find(b => b.id === blockId);
        if (block) {
            block.isHighlighted = !block.isHighlighted;
            block.updatedAt = Date.now();
        }
    }),

    loadTranscripts: async (sessionId) => {
        try {
            const data = await workspaceApi.getSessionTranscript(sessionId);

            // Validate data is array
            if (Array.isArray(data)) {
                set((state) => {
                    // Type-safe mapping if needed, assuming backend matches TranscriptBlock
                    state.transcriptBlocks = data.map((block: any) => ({
                        ...block,
                        // Ensure required fields
                        isFinal: true, // Loaded transcripts are historical/final
                        timestamp: block.timestamp || 0
                    }));
                });
            }
        } catch (e) {
            console.error("Failed to load transcripts", e);
            // Could set empty or error state
        }
    }
});
