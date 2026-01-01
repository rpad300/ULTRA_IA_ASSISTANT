import type { MeetingSlice, SessionSlice, Participant } from '../types';
import { workspaceApi } from '@/api/client';

export const createSessionSlice: MeetingSlice<SessionSlice> = (set, get) => ({
    sessionId: null,
    threadId: null,
    isRecording: false,
    isPaused: false,
    startTime: null,
    elapsedTime: 0,
    participants: [],
    activeViewers: [],

    setSessionId: (id) => set((s) => { s.sessionId = id; }),
    setElapsedTime: (time) => set((s) => { s.elapsedTime = time; }),

    startSession: (_sessionId) => {
        // This is typically overridden by the Master Orchestrator in meetingStore.ts
        // If called directly without override (unlikely), it sets basic flags.
        set((s) => {
            s.sessionId = _sessionId;
            s.isRecording = true;
            s.isPaused = false;
            s.startTime = Date.now();
            s.elapsedTime = 0;
            s.participants = [];
        });
    },

    stopSession: () => {
        set((s) => {
            s.isRecording = false;
            s.isPaused = false;
        });
    },

    pauseSession: () => set((s) => { s.isPaused = true; }),
    resumeSession: () => set((s) => { s.isPaused = false; }),

    resetSession: () => {
        set((s) => {
            s.sessionId = null;
            s.threadId = null;
            s.isRecording = false;
            s.isPaused = false;
            s.startTime = null;
            s.elapsedTime = 0;
            s.participants = [];
            s.activeViewers = [];
        });
        // Note: Global reset orchestrator should handle cross-slice clearing (transcripts, etc.)
    },

    updateParticipant: (speakerId, updates) => {
        set((s) => {
            const participant = s.participants.find(p => p.speakerId === speakerId);
            if (participant) {
                Object.assign(participant, updates);
            } else {
                // Auto-create if not exists
                s.participants.push({
                    id: speakerId,
                    speakerId,
                    name: updates.name || `Speaker ${speakerId}`,
                    ...updates
                } as Participant);
            }
        });
    },

    updateSpeakerName: (contactId, newName) => {
        set((s) => {
            s.participants.forEach(p => {
                if (p.contactId === contactId) {
                    p.name = newName;
                }
            });
        });
    },

    addViewer: (viewer) => set((s) => { s.activeViewers.push(viewer); }),
    removeViewer: (id) => set((s) => { s.activeViewers = s.activeViewers.filter(v => v.id !== id); }),

    promoteGuestToContact: async (guestId, contactId) => {
        const sessionId = get().sessionId;
        if (!sessionId) return;

        try {
            await workspaceApi.promoteGuest(contactId, guestId, sessionId);

            // Optimistic Update
            set((s) => {
                const p = s.participants.find(part => part.speakerId === guestId);
                if (p) {
                    p.contactId = contactId;
                    // Optionally update name if API returns it, but for now we link the ID
                }
            });

        } catch (e) {
            console.error("Promote guest failed", e);
            throw e;
        }
    }
});
