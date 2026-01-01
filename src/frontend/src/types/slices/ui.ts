import type { UniversalLineage } from './intelligence';

/**
 * SOTA UI Toolkit Types (2025)
 * ----------------------------
 * Supports Intelligent Event Hub & Layout Orchestrator.
 * Designed for resiliency, scalability and strict typing.
 */

// --- 1. Identity & Primitives ---

export type NotificationId = string & { readonly __brand: unique symbol };

// Panel Union for Autocomplete & Safety
export type PanelId =
    | 'transcript'
    | 'participants'
    | 'summary'
    | 'guidance'
    | 'insights'
    | 'health'
    | 'timeline'
    | 'analytics'
    | 'attachments'
    | 'agent'    // SOTA RAG Agent Panel
    | 'settings' // Common extra
    | 'debug';   // For developer mode

// Helper to cast strings to NotificationId safely
export const toNotificationId = (id: string): NotificationId => id as NotificationId;


// --- 2. Action Schema (Serializable) ---

/**
 * Serializable Action Configuration.
 * Replaces raw functions with IDs + Payload for Zustand Persistence.
 */
export interface ActionConfig {
    label: string;
    actionId: string; // Resolvable by an Action Orchestrator
    payload?: any;    // Context data needed for execution
    icon?: string;    // Lucide Icon Name (e.g. 'AlertTriangle', 'Check')
}


// --- 3. Intelligent Notifications ---

export interface Notification {
    id: NotificationId;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;

    // Semantic Grouping (e.g., "5 Network Errors")
    groupId?: string;

    // Intelligence Context
    metadata?: {
        lineage?: UniversalLineage;
        avatarUrl?: string; // For participant events
        soundTrigger?: 'default' | 'alert' | 'success' | 'none';

        // Error Diagnostics
        errorCode?: string;
        traceId?: string;
    };

    // Lifecycle Controls
    isToast: boolean;      // If true, triggers Sonner/Toast
    duration?: number;     // Custom persistence time
    persistent: boolean;   // Cannot be dismissed automatically (e.g. "Mic Disconnected")
    priority?: 'low' | 'medium' | 'high'; // Sorting hint

    // Contextual Actions (Multi-choice)
    primaryAction?: ActionConfig;
    secondaryAction?: ActionConfig;

    // Legacy support (to be deprecated but kept for transition if needed)
    actionUrl?: string;
}


// --- 4. System & Model Status ---

export interface ModelStatus {
    stage: 'downloading' | 'initializing' | 'optimizing' | 'ready' | 'error' | 'idle';
    progress: number; // 0-100
    message: string;
    error?: string;
}


// --- 5. User Preferences (Ephemeral/Session) ---

export interface UserPreferences {
    isMuted: boolean;
    autoScrollEnabled: boolean;
    highContrastMode: boolean;
    showNotifications: boolean;
    fontSize: 'small' | 'medium' | 'large';
}


// --- 6. Layout Orchestration State ---

export interface UISliceState {
    // Geometry & Layout
    layoutMode: 'minimal' | 'balanced' | 'detailed' | 'zen';
    sidebarOpen: boolean;
    focusedPanelId: PanelId | null;
    panelsVisibility: Record<PanelId, boolean>; // e.g., { transcript: true, debug: false }

    // System Check
    modelStatus: ModelStatus;

    // Event Hub
    notifications: Notification[];

    // Session Preferences
    userPreferences: UserPreferences;
}
