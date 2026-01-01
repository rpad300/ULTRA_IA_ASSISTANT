import type { MeetingSlice, UISlice } from '../types';
import { toNotificationId } from '@/types/slices/ui';

export const createUISlice: MeetingSlice<UISlice> = (set) => ({
    // --- SOTA State Initialization ---

    layoutMode: 'detailed',
    sidebarOpen: true,
    focusedPanelId: null,

    // Initial Layout State (Essential panels active by default)
    panelsVisibility: {
        transcript: true,
        guidance: true,
        participants: true, // SOTA: Default to true for Detailed layout consistency
        summary: true,
        insights: true, // SOTA: Default to true
        health: true, // SOTA: Default to true
        timeline: true,
        analytics: true, // SOTA: Default to true
        attachments: false,
        settings: false,
        agent: false, // Default to true or false? Let's say false initially, toggled by user or mode.
        debug: false
    },

    modelStatus: {
        stage: 'idle',
        progress: 0,
        message: 'System ready'
    },

    notifications: [],

    userPreferences: {
        isMuted: false,
        autoScrollEnabled: true,
        highContrastMode: false,
        showNotifications: true,
        fontSize: 'medium'
    },

    // Legacy / Loosely Typed State
    isListening: false,
    searchQuery: '',
    showOnlyHighlights: false,
    speakerFilter: null,
    focusedBlockId: null,
    transcriptViewport: { start: 0, end: 0 },
    focusedPanels: [], // Legacy array, kept to satisfy interface if needed or deprecated
    isScreenSharing: false,
    isSilentMode: false, // Legacy mirror of userPreferences.isMuted
    isZenMode: false,


    // --- Actions ---

    setModelStatus: (status) => set((s) => {
        s.modelStatus = { ...s.modelStatus, ...status };
        // Sync legacy props
        if (status.stage) {
            s.isModelLoading = status.stage !== 'ready' && status.stage !== 'idle';
        }
        if (status.message) {
            s.modelLoadingMessage = status.message;
        }
    }),

    // Legacy Wrapper
    setModelLoading: (loading, message) => set((s) => {
        s.modelStatus = {
            stage: loading ? 'initializing' : 'ready',
            progress: loading ? 50 : 100,
            message: message || (loading ? 'Loading...' : 'Ready')
        };
        // Legacy props
        s.isModelLoading = loading;
        s.modelLoadingMessage = message || null;
    }),

    addNotification: (notification) => set((s) => {
        const id = toNotificationId(Date.now().toString());
        const timestamp = Date.now();

        // Defaults
        const isToast = notification.type === 'error' || notification.isToast === true;
        const priority = notification.priority || (notification.type === 'error' ? 'high' : 'medium');

        const newNotification = {
            id,
            timestamp,
            read: false,
            isToast,
            persistent: false,
            priority,
            ...notification
        };

        // Add & Sort (Priority > Timestamp)
        s.notifications.push(newNotification);

        const getScore = (n: { priority?: string, type?: string }) => {
            if (n.priority === 'high' || n.type === 'error') return 3;
            if (n.priority === 'medium' || n.type === 'warning') return 2;
            return 1;
        };

        s.notifications.sort((a, b) => {
            const scoreA = getScore(a);
            const scoreB = getScore(b);
            if (scoreA !== scoreB) return scoreB - scoreA; // High score first
            return b.timestamp - a.timestamp; // Newest first
        });

        // Cap notifications
        if (s.notifications.length > 50) {
            s.notifications = s.notifications.slice(0, 50);
        }
    }),

    markNotificationAsRead: (id) => set((s) => {
        const n = s.notifications.find(n => n.id === id);
        if (n) {
            n.read = true;
        }
    }),

    dismissNotification: (id) => set((s) => {
        s.notifications = s.notifications.filter(n => n.id !== id);
    }),

    clearAllNotifications: () => set((s) => {
        s.notifications = [];
    }),

    setLayoutMode: (mode) => set((s) => {
        s.layoutMode = mode;
        if (mode === 'zen') {
            s.sidebarOpen = false;
            s.panelsVisibility.guidance = false;
            s.panelsVisibility.timeline = false;
            s.panelsVisibility.insights = false;
            s.panelsVisibility.analytics = false;
        } else if (mode === 'detailed') {
            s.sidebarOpen = true;
            s.panelsVisibility.guidance = true;
            s.panelsVisibility.timeline = true;
            s.panelsVisibility.insights = true;
            s.panelsVisibility.analytics = true;
            s.panelsVisibility.health = true;
            s.panelsVisibility.participants = true; // Fix: Ensure participants panel is visible
        } else if (mode === 'balanced') {
            s.sidebarOpen = true;
            s.panelsVisibility.guidance = true;
            s.panelsVisibility.timeline = true;
            // Reset "heavy" panels
            s.panelsVisibility.insights = false;
            s.panelsVisibility.analytics = false;
            s.panelsVisibility.health = false;
        }
    }),

    setPanelVisibility: (panelId, isVisible) => set((s) => {
        s.panelsVisibility[panelId] = isVisible;
    }),

    togglePanelFocus: (panelId) => set((s) => {
        // Legacy array support
        const index = s.focusedPanels.indexOf(panelId);
        if (index !== -1) {
            s.focusedPanels.splice(index, 1);
        } else {
            s.focusedPanels.push(panelId);
        }

        // New Logic
        s.focusedPanelId = s.focusedPanelId === panelId ? null : panelId;
    }),

    toggleSilentMode: () => set((s) => {
        s.userPreferences.isMuted = !s.userPreferences.isMuted;
        s.isSilentMode = s.userPreferences.isMuted; // Sync legacy
    }),

    toggleZenMode: () => set((s) => {
        s.isZenMode = !s.isZenMode;
        if (s.isZenMode) {
            s.layoutMode = 'zen';
        } else {
            s.layoutMode = 'detailed';
        }
    }),

    setPreference: (key, value) => set((s) => {
        (s.userPreferences as any)[key] = value;
    }),

    setScreenSharing: (isSharing) => set((s) => { s.isScreenSharing = isSharing; }),

    toggleVoiceCommands: () => set((s) => { s.isListening = !s.isListening; }),

    setSearchQuery: (query) => set((s) => { s.searchQuery = query; }),
    toggleShowOnlyHighlights: () => set((s) => { s.showOnlyHighlights = !s.showOnlyHighlights; }),
    setSpeakerFilter: (speakerId) => set((s) => { s.speakerFilter = speakerId; }),
    setFocusedBlockId: (blockId) => set((s) => { s.focusedBlockId = blockId; }),

    setTranscriptViewport: (range) => set((s) => { s.transcriptViewport = range; }),

    // Virtual Getters (Proxies for Legacy Compat)
    // These are initialized state properties, but we ensure they sync in actions.
    isModelLoading: false,
    modelLoadingMessage: null
});
