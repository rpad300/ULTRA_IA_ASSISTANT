
import type { MeetingSlice, AgentSlice } from '../types';
import type { ReasoningStep } from '@/types/slices/agent';

export const createAgentSlice: MeetingSlice<AgentSlice> = (set, _get) => ({
    // Initial State
    ragStatus: 'idle',
    reasoningSteps: [],
    knowledgeSources: [],
    activeTools: [],
    activityLevel: 0,
    lastUpdate: Date.now(),
    isStale: false,

    // Actions
    // Actions
    addReasoningStep: (description, type) => set((state) => {
        const step: ReasoningStep = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            description,
            type,
            status: 'active',
            timestamp: Date.now(),
            // Auto-link to context if provided in description/metadata (Generic for now, or passed in arg if we change signature)
            // SOTA: We assume the backend might send blockId? 
            // Current signature is (description, type). We can parse it or extend.
            // Let's keep signature simple and handle metadata later if needed.
        };

        // Mark previous steps as completed
        state.reasoningSteps.forEach(s => { if (s.status === 'active') s.status = 'completed'; });

        state.reasoningSteps.push(step);
        state.lastUpdate = Date.now();
        state.isStale = false;
        state.activityLevel = Math.min(state.activityLevel + 0.2, 1.0); // Pulse up
    }),

    updateSourceStatus: (sourceUpdate) => set((state) => {
        const existingIdx = state.knowledgeSources.findIndex(s => s.name === sourceUpdate.name || (sourceUpdate.id && s.id === sourceUpdate.id));

        if (existingIdx >= 0) {
            // Update existing
            Object.assign(state.knowledgeSources[existingIdx], sourceUpdate, { timestamp: Date.now() });
        } else {
            // New Source
            state.knowledgeSources.push({
                id: sourceUpdate.id || Date.now().toString(),
                status: sourceUpdate.status as any || 'searching',
                type: (sourceUpdate.type as any) || 'file',
                timestamp: Date.now(),
                ...sourceUpdate
            });
        }

        state.lastUpdate = Date.now();
        state.isStale = false;
        state.activityLevel = Math.min(state.activityLevel + 0.1, 1.0);
    }),

    updateActiveTool: (tool) => set((state) => {
        const idx = state.activeTools.findIndex(t => t.tool === tool.tool);
        if (idx >= 0) {
            Object.assign(state.activeTools[idx], tool);
        } else {
            state.activeTools.push({
                ...tool,
                startedAt: Date.now(),
                isInterruptible: true // Default to true unless specified
            });
        }
        state.lastUpdate = Date.now();
        state.isStale = false;
        state.activityLevel = 1.0;
    }),

    heartbeat: () => set((state) => {
        state.lastUpdate = Date.now();
        state.isStale = false;
    }),

    interruptAgent: () => set((state) => {
        // 1. Clear Active Tools
        console.log("User Interrupted Agent");
        state.activeTools = [];

        // 2. Add Reasoning Step
        state.reasoningSteps.push({
            id: Date.now().toString(),
            description: "Interrupted by user.",
            status: 'failed',
            type: 'logic',
            timestamp: Date.now()
        });

        // 3. Reset Status
        state.ragStatus = 'idle';
        state.activityLevel = 0;
        state.isStale = true; // Force idle state
    }),

    checkStaleState: () => set((state) => {
        const timeDiff = Date.now() - state.lastUpdate;
        if (timeDiff > 15000 && !state.isStale) { // 15s timeout
            state.isStale = true;
            state.ragStatus = 'idle';
            state.activeTools = []; // Clear tools
            state.activityLevel = 0;
            state.reasoningSteps.push({
                id: Date.now().toString(),
                description: "Connection idle...",
                status: 'completed',
                type: 'logic',
                timestamp: Date.now()
            });
        }

        // Decay activity level
        if (state.activityLevel > 0) {
            state.activityLevel = Math.max(0, state.activityLevel - 0.05); // Decay 5% per tick
        }
    }),

    resetAgentState: () => set((state) => {
        state.ragStatus = 'idle';
        state.reasoningSteps = [];
        state.knowledgeSources = [];
        state.activeTools = [];
        state.activityLevel = 0;
        state.isStale = false;
    })
});
