import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
import type { MeetingState } from './types';
import { toBrand } from '@/types/slices/intelligence';
import type { TimestampMs } from '@/types/slices/intelligence';

export * from './types';
// Re-export common types for convenience (facade pattern)
export type { Participant, TranscriptBlock, SessionSlice } from './types';

// Slices
import { createAudioSlice } from './slices/audioSlice';
import { createTranscriptSlice } from './slices/transcriptSlice';
import { createIntelligenceSlice } from './slices/intelligenceSlice';
import { createUISlice } from './slices/uiSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createAgentSlice } from './slices/agentSlice';

import { socketManager } from '@/managers/TranscriptionSocketManager';

// --- Store Creation ---
export const useMeetingStore = create<MeetingState>()(
    persist(
        immer((set, get, api) => ({
            // Compose Slices
            ...createAudioSlice(set, get, api),
            ...createTranscriptSlice(set, get, api),
            ...createIntelligenceSlice(set, get, api),
            ...createUISlice(set, get, api),
            ...createSessionSlice(set, get, api),
            ...createAgentSlice(set, get, api),

            // --- Master Orchestrator: startSession ---
            startSession: async (sessionId: string) => {
                const state = get();

                // 1. Reset Global State (Clean Slate)
                // This ensures no stale data from previous sessions leaks in.
                state.resetAll();

                // 2. Initialize Session State
                // We use Immer's set to update multiple slices transactionally
                set((state) => {
                    state.sessionId = sessionId;
                    state.isRecording = true;
                    state.isPaused = false;
                    state.startTime = toBrand<TimestampMs>(Date.now());
                    state.elapsedTime = 0;

                    // Optimistic UI flags (Legacy)
                    state.isAudioCapturing = true;

                    // SOTA Audio Status Initialization
                    // Initialize with full structure to prevent "undefined reading 'mic'" errors in UI
                    state.audioServiceStatus = {
                        status: { status: 'capturing' }, // Optimistic
                        infrastructure: {
                            backend: { status: 'connected', latencyMs: 0 },
                            provider: { status: 'disconnected', latencyMs: 0 },
                            localService: { status: 'connected', latencyMs: 0 }
                        },
                        selectedDeviceId: null,
                        levels: {
                            mic: { rms: 0, peak: 0, clipping: false },
                            system: { rms: 0, peak: 0, clipping: false }
                        },
                        signalStability: 1.0
                    };
                });

                // 3. Audio Service Integration
                // Note: WebSocket connection is now decoupled. 
                // The generic 'socketManager' should be triggered by the UI or a dedicated middleware 
                // observing 'isRecording' changes, BUT for stability in this refactor step,
                // we assume the UI (SessionController) calls connect, or we rely on startNativeStream 
                // doing the heavy lifting if needed.

                try {
                    await state.startNativeStream(sessionId);
                } catch (e) {
                    console.error("[MeetingStore] Failed to start native stream", e);
                    state.addNotification({
                        type: 'error',
                        title: 'Audio Initialization Failed',
                        message: 'Could not access microphone or system audio.',
                        priority: 'high'
                    });

                    // Revert state on failure
                    set((s) => {
                        s.isRecording = false;
                        s.isAudioCapturing = false;
                    });
                }
            },

            // --- Master Orchestrator: stopSession ---
            stopSession: async () => {
                const state = get();

                // 1. Stop Services
                await state.stopAllAudio();

                // 2. Update State
                set((state) => {
                    state.isRecording = false;
                    state.isPaused = false;
                    state.isAudioCapturing = false;
                    state.sessionId = null;
                });

                // Note: Timer cleanup is handled by the hook consuming this state, 
                // as we removed the setInterval from the store.
            },

            resetAll: () => {
                // Trigger slice-specific resets
                const state = get();
                state.resetSession();
                state.clearTranscript();
                state.clearAllNotifications();

                // Manual overrides for safety
                set((state) => {
                    state.transcriptBlocks = [];
                    state.participants = [];
                    state.sessionId = null;
                    state.isRecording = false;
                    state.audioServiceStatus = null;
                    state.liveSummary = null;
                    state.meetingHealth = null;
                    state.meetingQualityScore = null;

                    // Reset Intelligence Arrays
                    state.detectedActions = [];
                    state.risks = [];
                    state.clarifications = [];
                    state.autoActions = [];
                    state.topicClusters = [];
                    state.emotionStates = [];
                    state.flowPredictions = [];
                    state.coachingInsights = [];
                    state.conflicts = [];
                    state.relationshipInsights = [];
                    state.highlightGroups = [];
                    state.prepDocuments = [];
                });
            }
        })),
        {
            name: 'meeting-storage-v3',
            partialize: (state) => ({
                // SOTA Persistence Strategy: Only persist User Configs & Identity
                // NEVER persist volatile runtime state (isRecording, audioStatus, etc.)
                audioGain: state.audioGain,
                layoutMode: state.layoutMode,
                // User Preferences (SOTA)
                userPreferences: state.userPreferences,

                // We typically DO NOT persist sessionId unless we want to recover on refresh.
                // If we do, we must handle re-connection logic in hydration.
                // checking requirement: "Persiste apenas configurações de utilizador e IDs de sessão" -> OK.
                sessionId: state.sessionId,
                customVocabulary: state.customVocabulary,
                autoStopEnabled: state.autoStopEnabled,
                isSilentMode: state.isSilentMode,
                isZenMode: state.isZenMode
            })
        }
    )
);

// Register store for legacy compatibility or external access if needed
socketManager.registerStore(useMeetingStore);
