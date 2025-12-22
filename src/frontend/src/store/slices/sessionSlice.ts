import type { StateCreator } from 'zustand';
import type { MeetingState } from '../meetingStore';

export interface Participant {
    id: string;
    speakerId: string; // The ID used in transcript blocks (speaker_0, etc.)
    name?: string;     // Display name (e.g. from Contact)
    contactId?: string; // Linked Contact ID
    isSpeaking?: boolean;
    totalSpeakingTime?: number;
    engagementScore?: number; // 0-100
    contributionCount?: number;
    avatar?: string;
}

export interface SessionSlice {
    sessionId: string | null;
    isRecording: boolean;
    isPaused: boolean;
    startTime: number | null;
    elapsedTime: number; // seconds
    participants: Participant[];
    activeViewers: Array<{ id: string; name: string; avatar?: string }>;

    // Actions
    setSessionId: (id: string | null) => void;
    setElapsedTime: (time: number) => void;
    startSession: (sessionId: string) => void;
    stopSession: () => void;
    pauseSession: () => void;
    resumeSession: () => void;
    resetSession: () => void;

    // Participant Management
    updateParticipant: (speakerId: string, updates: Partial<Participant>) => void;
    updateSpeakerName: (contactId: string, newName: string) => void;
    addViewer: (viewer: { id: string; name: string; avatar?: string }) => void;
    removeViewer: (viewerId: string) => void;
}

export const createSessionSlice: StateCreator<MeetingState, [], [], SessionSlice> = (set, get) => ({
    sessionId: null,
    isRecording: false,
    isPaused: false,
    startTime: null,
    elapsedTime: 0,
    participants: [],
    activeViewers: [],

    setSessionId: (id) => set({ sessionId: id }),
    setElapsedTime: (time) => set({ elapsedTime: time }),

    startSession: (sessionId) => {
        // Stop any existing session logic (timer provided by meetingStore subscription/middleware usually)
        set({
            sessionId,
            isRecording: true,
            isPaused: false,
            startTime: Date.now(),
            elapsedTime: 0,
            participants: [],
            // Clear other slices via reset if needed, but startSession usually implies fresh
        });
    },

    stopSession: () => {
        set({ isRecording: false, isPaused: false });
    },

    pauseSession: () => set({ isPaused: true }),
    resumeSession: () => set({ isPaused: false }),

    resetSession: () => {
        set({
            sessionId: null,
            isRecording: false,
            isPaused: false,
            startTime: null,
            elapsedTime: 0,
            participants: [],
            activeViewers: []
        });
        // Other slices should listen to this or have their own reset triggers? 
        // Ideally a global reset calls individual slice resets.
        // For now, we rely on the main store's resetSession to delegate.
        get().clearTranscript();
        get().clearAllNotifications();
        // Intelligence slice reset?
    },

    updateParticipant: (speakerId, updates) => {
        set((state) => {
            const existingIndex = state.participants.findIndex(p => p.speakerId === speakerId);
            if (existingIndex !== -1) {
                const updated = [...state.participants];
                updated[existingIndex] = { ...updated[existingIndex], ...updates };
                return { participants: updated };
            }
            // Add if not exists (auto-create logic)
            return {
                participants: [...state.participants, {
                    id: speakerId,
                    speakerId,
                    name: updates.name || `Speaker ${speakerId}`,
                    ...updates
                }]
            };
        });
    },

    updateSpeakerName: (contactId, newName) => {
        set((state) => ({
            participants: state.participants.map(p =>
                p.contactId === contactId ? { ...p, name: newName } : p
            )
        }));
    },

    addViewer: (viewer) => set(state => ({ activeViewers: [...state.activeViewers, viewer] })),
    removeViewer: (id) => set(state => ({ activeViewers: state.activeViewers.filter(v => v.id !== id) }))
});
