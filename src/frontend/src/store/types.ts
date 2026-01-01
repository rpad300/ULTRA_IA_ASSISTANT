import type { StateCreator } from 'zustand';
import type { AudioDevice, AudioServiceStatus } from '@/types/slices/audio';
import type { TranscriptBlock } from '@/types/slices/transcript';
export type { TranscriptBlock };

// SOTA UI Types
import type {
    Notification,
    UISliceState,
    PanelId,
    ModelStatus,
    UserPreferences
} from '@/types/slices/ui';

import type {
    CrossMeetingPattern,
    DetectedAction,
    Clarification,
    Risk,
    LiveSummary,
    MeetingHealth,
    MeetingQualityScore,
    ScoreHistoryPoint,
    TopicCluster,
    EmotionState,
    FlowPrediction,
    PredictiveQuestion,
    CoachingInsight,
    ConflictDetection,
    RelationshipInsight,
    PrepDocument,
    HighlightGroup,
    AutoAction,
    OracleInsight,
    LiveSummaryItem
} from '@/types/slices/intelligence';
export type * from '@/types/slices/intelligence';

import type { AgentSlice } from '@/types/slices/agent';
export type { AgentSlice };

// --- Slice Interfaces ---

export interface AudioSlice {
    // Service State
    audioServiceStatus: AudioServiceStatus | null;
    audioServiceDevices: { microphones: AudioDevice[]; speakers: AudioDevice[] };
    isAudioCapturing: boolean;
    audioLevel: number;
    systemAudioLevel: number;
    picoVoiceStatus: 'unknown' | 'initializing' | 'ready' | 'failed';
    microphonePermission: 'granted' | 'denied' | 'prompt' | 'unknown';
    systemAudioPermission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested';
    // Config
    audioGain: number;
    selectedMicrophoneDevice: string | null;
    selectedSystemAudioDevice: string | null;
    customVocabulary: string[];
    autoStopEnabled: boolean;
    silenceTimeoutMs: number;

    // Actions
    startAudioService: (sysId?: string, micId?: string) => Promise<void>;
    stopAudioService: () => Promise<void>;
    getAudioServiceStatus: () => Promise<AudioServiceStatus | null>;
    refreshAudioStatus: () => Promise<void>;
    startNativeStream: (sessionId: string) => Promise<void>;
    stopAllAudio: () => Promise<void>;
    setGain: (gain: number) => Promise<void>;
    setAudioGain: (gain: number) => Promise<void>;
    setCustomVocabulary: (vocab: string[]) => void;
    setAutoStopEnabled: (enabled: boolean) => void;
    checkMicrophonePermission: () => Promise<void>;
    requestMicrophonePermission: () => Promise<void>;
    requestSystemAudioPermission: () => Promise<void>;
    setMicrophonePermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown') => void;
    setSystemAudioPermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested') => void;
    setAudioLevel: (level: number) => void;
    setSystemAudioLevel: (level: number) => void;
    setAudioCapturing: (isCapturing: boolean) => void;
    setPicoVoiceStatus: (status: 'unknown' | 'initializing' | 'ready' | 'failed') => void;
    getAudioServiceDevices: () => Promise<{ microphones: AudioDevice[]; speakers: AudioDevice[] }>;
    setAudioServiceDevice: (deviceId: string) => Promise<void>;
    setSelectedMicrophoneDevice: (deviceId: string | null) => void;
    setSelectedSystemAudioDevice: (deviceId: string | null) => void;
    setSignalStability: (stability: number) => void;
    measureBackendLatency: () => Promise<number>;
}

export interface SessionSlice {
    sessionId: string | null;
    threadId: string | null;
    isRecording: boolean;
    isPaused: boolean;
    startTime: number | null;
    elapsedTime: number; // seconds
    participants: Participant[];
    activeViewers: Array<{ id: string; name: string; avatar?: string }>;

    setSessionId: (id: string | null) => void;
    setElapsedTime: (time: number) => void;
    startSession: (sessionId: string) => void;
    stopSession: () => void;
    pauseSession: () => void;
    resumeSession: () => void;
    resetSession: () => void;
    updateParticipant: (speakerId: string, updates: Partial<Participant>) => void;
    updateSpeakerName: (contactId: string, newName: string) => void;
    addViewer: (viewer: { id: string; name: string; avatar?: string }) => void;
    removeViewer: (viewerId: string) => void;
    promoteGuestToContact: (guestId: string, contactId: string) => Promise<void>;
}

export interface Participant {
    id: string;
    speakerId: string;
    name?: string;
    contactId?: string;
    isSpeaking?: boolean;
    totalSpeakingTime?: number;
    engagementScore?: number;
    contributionCount?: number;
    avatar?: string;
}

export interface TranscriptSlice {
    transcriptBlocks: TranscriptBlock[];
    partialBlock: TranscriptBlock | null;
    partialTranscript: TranscriptBlock | null; // Legacy alias

    handleTranscriptEvent: (data: any) => void;
    updateSpeakerByTrace: (traceId: string, contactId: string, name: string) => void;
    assignSpeakerOptimistically: (traceId: string, contactId: string, contactName: string) => void;
    clearTranscript: () => void;
    toggleHighlight: (blockId: string) => void;
    loadTranscripts: (sessionId: string) => Promise<void>;
}

export interface UISlice extends UISliceState {
    // Specific State Overrides or Extras if needed (Inherits from UISliceState)
    // Note: We inherit clean state properties from UISliceState (ui.ts)

    // Legacy / Loosely Typed State
    isModelLoading: boolean;
    modelLoadingMessage: string | null;
    isSilentMode: boolean;
    isZenMode: boolean;
    focusedPanels: string[];
    isScreenSharing: boolean;

    // Actions
    setModelStatus: (status: Partial<ModelStatus>) => void;

    // Legacy Action for backwards compat
    setModelLoading: (loading: boolean, message?: string) => void;

    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'isToast' | 'persistent'> & { isToast?: boolean, persistent?: boolean }) => void;
    markNotificationAsRead: (id: string) => void;
    dismissNotification: (id: string) => void;
    clearAllNotifications: () => void;

    setLayoutMode: (mode: UISliceState['layoutMode']) => void;

    setPanelVisibility: (panelId: PanelId, isVisible: boolean) => void;
    togglePanelFocus: (panelId: PanelId) => void; // Now handles exclusive focus if needed

    // Preferences Actions
    toggleSilentMode: () => void;
    toggleZenMode: () => void;
    setPreference: (key: keyof UserPreferences, value: any) => void;

    setScreenSharing: (isSharing: boolean) => void;
    toggleVoiceCommands: () => void;

    // Search & Filter State (Keep these here if they are not in UISliceState - user request didn't specify checking these into UI type, 
    // but implied "whole user experience state". For now keep them in Slice Interface or move to specific slices if better fit. 
    // Stick to existing structure for these loosely typed fields unless migrated)
    isListening: boolean;
    searchQuery: string;
    showOnlyHighlights: boolean;
    speakerFilter: string | null;
    focusedBlockId: string | null;
    transcriptViewport: { start: number; end: number };

    setSearchQuery: (query: string) => void;
    toggleShowOnlyHighlights: () => void;
    setSpeakerFilter: (speakerId: string | null) => void;
    setFocusedBlockId: (blockId: string | null) => void;
    setTranscriptViewport: (range: { start: number; end: number }) => void;
}

export interface IntelligenceSlice {
    crossMeetingPatterns: CrossMeetingPattern[];
    isAnalyzingPatterns: boolean;
    detectedActions: DetectedAction[];
    risks: Risk[];
    clarifications: Clarification[];
    autoActions: AutoAction[];
    autoActionsEnabled: boolean;
    liveSummary: LiveSummary | null;
    meetingHealth: MeetingHealth | null;
    meetingQualityScore: MeetingQualityScore | null;
    qualityScoreHistory: ScoreHistoryPoint[];
    topicClusters: TopicCluster[];
    emotionStates: EmotionState[];
    flowPredictions: FlowPrediction[];
    currentTopic: string | null;
    predictiveQuestions: PredictiveQuestion[];
    coachingInsights: CoachingInsight[];
    conflicts: ConflictDetection[];
    relationshipInsights: RelationshipInsight[];
    highlightGroups: HighlightGroup[];
    prepDocuments: PrepDocument[];
    lastInsight: OracleInsight | null;
    manualGuidance: import('@/types/guidance').GuidanceInsight[];

    setLastInsight: (insight: OracleInsight | null) => void;
    setAnalyzingPatterns: (isAnalyzing: boolean) => void;
    addCrossMeetingPattern: (pattern: CrossMeetingPattern) => void;
    addDetectedAction: (action: Omit<DetectedAction, 'id'>) => void;
    confirmActionAsTask: (actionId: string, updates?: Partial<DetectedAction>) => void;
    rejectDetectedAction: (actionId: string) => void;
    addRisk: (risk: Omit<Risk, 'id'>) => void;
    addClarification: (clarification: Omit<Clarification, 'id'>) => void;
    updateLiveSummary: (summary?: Partial<LiveSummary>) => void;
    updateLiveSummaryItem: (id: string, updates: Partial<LiveSummaryItem>) => void;
    updateMeetingHealth: (health?: Partial<MeetingHealth>) => void;
    calculateMeetingQualityScore: () => void;
    markCriticalMoment: () => void;
    autoClusterTopics: () => void;
    analyzeSentiment: (text: string) => 'positive' | 'neutral' | 'negative';
    updateEmotionState: (participantId: string, emotion: EmotionState['emotion'], confidence: number, reason?: string) => void;
    predictNextTopics: () => void;
    setCurrentTopic: (topic: string) => void;
    removePrediction: (id: string) => void;
    generatePredictiveQuestions: () => void;
    analyzeUserSpeaking: () => void;
    detectConflicts: () => void;
    updateRelationshipInsights: () => void;
    setRelationshipInsights: (insights: RelationshipInsight[]) => void;
    setPredictiveQuestions: (questions: PredictiveQuestion[]) => void;
    updatePredictiveQuestion: (id: string, updates: Partial<PredictiveQuestion>) => void;
    createHighlightGroup: (group: Omit<HighlightGroup, 'id'>) => void;
    addBlockToHighlightGroup: (groupId: string, blockId: string) => void;
    autoGroupHighlights: () => void;
    updatePrepDocument: (updates: Partial<PrepDocument>) => void;
    generatePrepDocument: (sessionId: string) => void;
    enableAutoActions: () => void;
    disableAutoActions: () => void;
    generateAutoActions: () => void;
    addAutoAction: (action: AutoAction) => void;
    approveAutoAction: (actionId: string) => void;
    rejectAutoAction: (actionId: string) => void;
    executeAutoAction: (actionId: string) => void;
    analyzeCrossMeetingPatterns: () => void;
    detectContradictions: () => void;
    analyzeTrends: () => void;
    dismissCoachingInsight: (id: string) => void;
    addCoachingInsight: (insight: CoachingInsight) => void;
    addManualGuidance: (insight: import('@/types/guidance').GuidanceInsight) => void;
    removeManualGuidance: (id: string) => void;
}

// --- Main Store Interface ---

export interface MeetingState extends
    AudioSlice,
    SessionSlice,
    TranscriptSlice,
    UISlice, // This now includes UISliceState properties directly
    IntelligenceSlice,
    AgentSlice {
    resetAll: () => void;
}

// --- Middleware & Creator Types ---

export type MeetingSlice<T> = StateCreator<
    MeetingState,
    [['zustand/immer', never]],
    [],
    T
>;
