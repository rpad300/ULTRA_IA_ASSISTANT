import type { StateCreator } from 'zustand';
import type { MeetingState } from '../meetingStore';
import type { TranscriptBlock } from '@/types/slices/transcript';

export interface TranscriptSlice {
    transcriptBlocks: TranscriptBlock[];
    partialBlock: TranscriptBlock | null;
    partialTranscript: TranscriptBlock | null; // Legacy alias

    // Actions
    handleTranscriptEvent: (data: any) => void;
    // The original `updateSpeakerByTrace` is removed as per the instruction's provided interface snippet.
    updateSpeakerByTrace: (traceId: string, contactId: string, name: string) => void;
    assignSpeakerOptimistically: (traceId: string, contactId: string, contactName: string) => void;
    clearTranscript: () => void;

    // Legacy / Action
    toggleHighlight: (blockId: string) => void;
    loadTranscripts: (sessionId: string) => Promise<void>;
}

export const createTranscriptSlice: StateCreator<MeetingState, [], [], TranscriptSlice> = (set, get) => ({
    transcriptBlocks: [],
    partialBlock: null,
    partialTranscript: null,

    handleTranscriptEvent: (data) => {
        // console.log('[transcriptSlice] Handling Event:', data);
        const { transcript, text, is_final, turn_id, trace_id, speaker, speaker_id, turn_order } = data;
        const content = transcript || text;
        if (!content) return;

        // Note: Assuming 'elapsedTime' is available in the store (another slice)
        // Accessing it via get().elapsedTime if it exists in MeetingState
        // We'll cast to any for now to avoid circular dependency issues until full merge
        // Safely access elapsedTime if it exists, else Date.now()
        const state = get() as any;
        const timestamp = typeof state?.elapsedTime === 'number' ? state.elapsedTime : Date.now();

        set((s) => {
            // Stable ID Generation: Prefer turn_id, fallback to turn_order, fallback to timestamp
            const stableId = turn_id || (turn_order !== undefined ? `turn-${turn_order}` : Date.now().toString());

            // 1. Lógica de Bloco Parcial (Streaming UX)
            if (!is_final) {
                const partial = {
                    id: 'partial',
                    text: content,
                    speaker: speaker || s.partialBlock?.speaker || 'Speaking...',
                    isFinal: false,
                    traceId: trace_id,
                    timestamp: timestamp,
                    updatedAt: Date.now()
                };
                return {
                    partialBlock: partial,
                    partialTranscript: partial
                };
            }

            // 2. Lógica de Deduplicação e Update de Bloco Final
            const existingIndex = s.transcriptBlocks.findIndex(b => b.id === stableId);
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

            if (existingIndex !== -1) {
                // Atualiza bloco existente (ex: IA melhorou a pontuação do texto final)
                const updatedBlocks = [...s.transcriptBlocks];
                updatedBlocks[existingIndex] = { ...updatedBlocks[existingIndex], ...newBlock };
                return { transcriptBlocks: updatedBlocks, partialBlock: null };
            }

            // Adiciona novo bloco
            return {
                transcriptBlocks: [...s.transcriptBlocks, newBlock],
                partialBlock: null
            };
        });
    },

    updateSpeakerByTrace: (traceId: string, contactId: string, name: string) => {
        set((state) => ({
            // Update Retroativo: Procura todos os blocos com o rastro de voz X 
            // e atualiza o nome do orador instantaneamente.
            transcriptBlocks: state.transcriptBlocks.map(block =>
                block.traceId === traceId || block.speaker === traceId
                    ? { ...block, speaker: name, speakerId: contactId, updatedAt: Date.now() }
                    : block
            )
        }));
    },

    assignSpeakerOptimistically: (traceId: string, contactId: string, contactName: string) => {
        // 1. Atualização Imediata (Optimistic)
        set((state) => ({
            transcriptBlocks: state.transcriptBlocks.map(block =>
                block.traceId === traceId ? { ...block, speaker: contactName, speakerId: contactId, updatedAt: Date.now() } : block
            )
        }));

        // 2. Notificação ao Servidor -> This should be handled by the SocketManager or via Action
        // Ideally we assume socketManager is imported or we trigger a side effect
        // For now, we'll placeholder this or call a global if defined, but cleaner is to have a method.
        // We will assume the component calling this also handles the socket send, OR we import socketManager here.
        // Importing socketManager here might verify circular deps. 
        // Let's defer strict socket sending to the UI or Manager for now to keep store pure, 
        // Or better, import the instance if it's a singleton.

        // import { socketManager } from '@/managers/socketManager'; 
        // socketManager.send(...) 
    },

    clearTranscript: () => set({ transcriptBlocks: [], partialBlock: null, partialTranscript: null }),

    toggleHighlight: (blockId: string) => set(state => ({
        transcriptBlocks: state.transcriptBlocks.map(b =>
            b.id === blockId ? { ...b, isHighlighted: !b.isHighlighted, updatedAt: Date.now() } : b
        )
    })),

    loadTranscripts: async (_sessionId: string) => {
        return Promise.resolve();
    }
});
