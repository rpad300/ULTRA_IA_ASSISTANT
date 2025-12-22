import type { StateCreator } from 'zustand';
import type { MeetingState } from '../meetingStore';
import type { Notification } from '@/types/slices/ui';

export interface UISlice {
    // State
    isModelLoading: boolean;
    modelLoadingMessage: string | null;
    notifications: Notification[];

    // Layout
    layoutMode: 'minimal' | 'detailed' | 'balanced' | 'custom';
    focusedPanels: string[];
    isSilentMode: boolean;

    // Voice Commands
    isListening: boolean;

    // Actions
    setModelLoading: (loading: boolean, message?: string) => void;

    // Notification Actions
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markNotificationAsRead: (id: string) => void; // Renamed to match usage
    dismissNotification: (id: string) => void;
    clearAllNotifications: () => void;

    // Layout Actions
    setLayoutMode: (mode: 'minimal' | 'detailed' | 'balanced' | 'custom') => void;
    togglePanelFocus: (panelId: string) => void;
    toggleSilentMode: () => void;

    // Voice Command Actions
    toggleVoiceCommands: () => void;
}

export const createUISlice: StateCreator<MeetingState, [], [], UISlice> = (set) => ({
    isModelLoading: false,
    modelLoadingMessage: null,
    notifications: [],
    layoutMode: 'balanced',
    focusedPanels: [],
    isSilentMode: false,
    isListening: false,

    setModelLoading: (loading, message) => {
        set({ isModelLoading: loading, modelLoadingMessage: message || null });
    },

    addNotification: (notification) => {
        const newNotification: Notification = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            read: false,
            ...notification
        };
        set((state) => ({
            notifications: [newNotification, ...state.notifications]
        }));
    },

    markNotificationAsRead: (id) => {
        set((state) => ({
            notifications: state.notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            )
        }));
    },

    dismissNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    },

    clearAllNotifications: () => {
        set({ notifications: [] });
    },

    setLayoutMode: (mode) => set({ layoutMode: mode }),

    togglePanelFocus: (panelId) => set(state => {
        const isFocused = state.focusedPanels.includes(panelId);
        return {
            focusedPanels: isFocused
                ? state.focusedPanels.filter(id => id !== panelId)
                : [...state.focusedPanels, panelId]
        };
    }),

    toggleSilentMode: () => set(state => ({ isSilentMode: !state.isSilentMode })),

    toggleVoiceCommands: () => set(state => ({ isListening: !state.isListening })),
});
