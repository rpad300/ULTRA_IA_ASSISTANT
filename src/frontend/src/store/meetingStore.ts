import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Slices
import type { AudioSlice } from './slices/audioSlice';
import { createAudioSlice } from './slices/audioSlice';
import type { TranscriptSlice } from './slices/transcriptSlice';
import { createTranscriptSlice } from './slices/transcriptSlice';
import type { IntelligenceSlice } from './slices/intelligenceSlice';
import { createIntelligenceSlice } from './slices/intelligenceSlice';
import type { UISlice } from './slices/uiSlice';
import { createUISlice } from './slices/uiSlice';
import type { SessionSlice } from './slices/sessionSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { socketManager } from '@/managers/TranscriptionSocketManager';

// --- Type Exports for Components ---
// Re-exporting from specific slices or types to maintain compatibility without monolithic interface definition here
export type {
    CrossMeetingPattern
} from '@/types/slices/intelligence';

export type {
    DetectedAction,
    Clarification,
    Risk,
    LiveSummary,
    MeetingHealth,
    MeetingQualityScore,
    TopicCluster,
    EmotionState,
    FlowPrediction,
    PredictiveQuestion,
    CoachingInsight,
    ConflictDetection,
    RelationshipInsight,
    PrepDocument,
    HighlightGroup,
    AutoAction
} from './slices/intelligenceSlice'; // Exporting from slice where we defined them

export type { Participant } from './slices/sessionSlice';
export type { TranscriptBlock } from '@/types/slices/transcript'; // Ensure this has 'topic' etc if needed
export type { Notification } from '@/types/slices/ui';
export type { AudioServiceStatus } from '@/types/slices/audio';

// --- Main Store Interface ---
export interface MeetingState extends
    AudioSlice,
    TranscriptSlice,
    IntelligenceSlice,
    UISlice,
    SessionSlice {
    // Meta-actions that span multiple slices or orchestration
    resetAll: () => void;
}

// --- Store Creation ---
export const useMeetingStore = create<MeetingState>()(
    persist(
        (set, get, api) => ({
            // Compose Slices
            ...createAudioSlice(set, get, api),
            ...createTranscriptSlice(set, get, api),
            ...createIntelligenceSlice(set, get, api),
            ...createUISlice(set, get, api),
            ...createSessionSlice(set, get, api),

            // Meta-Actions / Orchestration

            // Overwriting strict slice startSession to orchestrate audio? 
            // sessionSlice has startSession(id). audioSlice has startNativeStream(id).
            // We can rename slice method or hook into it.
            // Let's use a "Thunk" pattern manually if needed.
            // Actually, components call `startSession(newSessionId)`.
            // We need to override the simple sessionSlice implementation to include side effects (Audio, Timer).

            startSession: async (sessionId: string) => {
                const state = get();

                // 1. Initialize Session State
                // We call the slice's simple setter logic by manually setting it if we can't call 'super'.
                // But since we are inside the creator, 'startSession' key clashes with slice.
                // WE MUST DEFINE startSession HERE to encompass all logic.
                // The slice definition contributes properties, but this definition wins if it overrides.

                // Reset/Init Session Slice properties
                set({
                    sessionId,
                    isRecording: true,
                    isPaused: false,
                    startTime: Date.now(),
                    elapsedTime: 0,
                    transcriptBlocks: [], // Clear transcripts (TranscriptSlice)
                    participants: [],     // Clear participants (SessionSlice)
                    // Reset Intelligence
                    detectedActions: [],
                    risks: [],
                    liveSummary: { keyPoints: [], decisions: [], actionItems: [], lastUpdated: 0 },
                    // Reset Audio State
                    isAudioCapturing: true // Optimistic
                });

                // 2. Start Timer (Simulated by generic interval if needed, or component based)
                // In SOTA, we preferred server-sent time or local hook. 
                // But legacy store had a timer interval. 
                // We'll rely on the `SessionController` hook or `VisualTimeline` to tick, 
                // OR we accept that `elapsedTime` acts as a simplified state.
                // Note: The backup had `setInterval`. We can't easily put `setInterval` in a pure store creator 
                // without side-effect management. 
                // Ideally, a `useSessionTimer` hook handles this. 
                // FOR NOW: We leave it static. Components relying on it might stay at 0 unless we add the interval.
                // *Self-correction*: Adding a simple interval handler here for compatibility.

                if ((window as any).__meetingTimer) clearInterval((window as any).__meetingTimer);
                (window as any).__meetingTimer = setInterval(() => {
                    const s = get();
                    if (s.isRecording && !s.isPaused) {
                        set({ elapsedTime: Math.floor((Date.now() - (s.startTime || Date.now())) / 1000) });
                    }
                }, 1000);

                // 3. Start Audio Service
                try {
                    // Import dynamically or ensure top-level import to avoid circular dep issues if any?
                    // socketManager is a singleton, so top-level is fine.
                    // Connect WebSocket to receive transcripts
                    socketManager.connect(sessionId);

                    await state.startNativeStream(sessionId);
                } catch (e) {
                    console.error("Failed to start audio stream", e);
                    get().addNotification({
                        type: 'error',
                        title: 'Audio Error',
                        message: 'Failed to start audio service',
                        priority: 'high'
                    });
                }
            },

            stopSession: async () => {
                if ((window as any).__meetingTimer) clearInterval((window as any).__meetingTimer);

                const state = get();
                await state.stopAllAudio();

                set({
                    isRecording: false,
                    isPaused: false,
                    isAudioCapturing: false
                });
            },

            resetAll: () => {
                if ((window as any).__meetingTimer) clearInterval((window as any).__meetingTimer);
                const state = get();

                // Call slice resets explicitly if defined and exposed, or manual reset
                // Since we merged everything, we can just set properties.
                state.resetSession(); // SessionSlice reset
                state.clearTranscript(); // TranscriptSlice reset
                state.clearAllNotifications(); // UI Slice reset

                set({
                    // Redundant safety clear
                    transcriptBlocks: [],
                    participants: [],
                    sessionId: null,
                    isRecording: false,
                    audioServiceStatus: null
                });
            }
        }),
        {
            name: 'meeting-storage-v2',
            partialize: (state) => ({
                sessionId: state.sessionId,
                audioGain: state.audioGain,
                audioServiceStatus: state.audioServiceStatus,
                layoutMode: state.layoutMode,
                // Persist minimal necessary state
            })
        }
    )
);

// Register store with socketManager to avoid circular dependency
socketManager.registerStore(useMeetingStore);
