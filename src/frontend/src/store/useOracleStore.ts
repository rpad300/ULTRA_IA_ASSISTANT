
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
    TranscriptMessage,
    InsightMessage,
    TelemetryMessage,
    ConnectionState,
    SpeakerMap
} from '../types/oracle';

interface OracleState {
    // Data
    transcripts: TranscriptMessage[];
    insights: InsightMessage[];
    telemetry: TelemetryMessage | null;
    speakers: SpeakerMap;
    connection: ConnectionState;

    // Actions
    upsertTranscript: (msg: TranscriptMessage) => void;
    addInsight: (msg: InsightMessage) => void;
    updateTelemetry: (msg: TelemetryMessage) => void;
    updateSpeaker: (guestId: string, name: string) => void;
    setConnectionStatus: (status: ConnectionState['status'], error?: string) => void;
    clearSession: () => void;
}

export const useOracleStore = create<OracleState>()(
    devtools((set) => ({
        transcripts: [],
        insights: [],
        telemetry: null,
        speakers: {},
        connection: { status: 'disconnected', latency: 0 },

        upsertTranscript: (msg) => set((state) => {
            // SOTA: Trace ID based Upsert
            const index = state.transcripts.findIndex(t => t.trace_id === msg.trace_id);

            if (index !== -1) {
                // Update existing bubble
                const newTranscripts = [...state.transcripts];
                newTranscripts[index] = { ...newTranscripts[index], ...msg };
                return { transcripts: newTranscripts };
            } else {
                // New bubble
                return { transcripts: [...state.transcripts, msg] };
            }
        }),

        addInsight: (msg) => set((state) => ({
            insights: [msg, ...state.insights] // Newest first
        })),

        updateTelemetry: (msg) => set({ telemetry: msg }),

        updateSpeaker: (guestId, name) => set((state) => ({
            speakers: { ...state.speakers, [guestId]: name }
        })),

        setConnectionStatus: (status, error) => set((state) => ({
            connection: { ...state.connection, status, error }
        })),

        clearSession: () => set({
            transcripts: [],
            insights: [],
            telemetry: null,
            speakers: {}
        })
    }))
);
