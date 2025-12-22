import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/api/client';
import { AudioStreamer } from '@/lib/audioUtils';
import { getWebSocketUrl } from '@/config/api';
import { audioServiceApi } from '@/api/client';

export interface TranscriptBlock {
    id: string;
    speaker: string;
    speakerId?: string;
    text: string;
    timestamp: number; // seconds from start
    topic?: string;
    isHighlighted?: boolean;
    isFinal?: boolean; // Whether this is a final or partial transcript
    createdAt: string;
    sentiment?: 'positive' | 'neutral' | 'negative'; // Sentiment analysis
    clusterId?: string; // Topic cluster ID
    traceId?: string; // Voice optimization trace ID
}

export interface DetectedAction {
    id: string;
    text: string;
    timestamp: number;
    confirmed?: boolean;
    taskId?: string;
}

export interface Clarification {
    id: string;
    suggestion: string;
    timestamp: number;
    context?: string;
}

export interface Risk {
    id: string;
    summary: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
    contextId?: string;
}

export interface Participant {
    id: string;
    speakerId: string;
    name?: string;
    contactId?: string;
    isSpeaking?: boolean;
    totalSpeakingTime?: number;
    engagementScore?: number; // 0-100
    contributionCount?: number;
}

export interface MeetingHealth {
    engagement: number; // 0-100
    clarity: number; // 0-100
    progress: number; // 0-100
    participation: number; // 0-100
    overall: number; // average
}

export interface TopicCluster {
    id: string;
    name: string;
    blocks: string[]; // block IDs
    startTime: number;
    endTime: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    keywords: string[]; // Most common keywords
    participantCount: number; // Number of unique participants
}

export interface LiveSummary {
    keyPoints: string[];
    decisions: string[];
    actionItems: string[];
    lastUpdated: number;
}

export interface CoachingInsight {
    id: string;
    type: 'tone' | 'pace' | 'question' | 'interruption' | 'silence' | 'assertiveness';
    severity: 'good' | 'warning' | 'critical';
    message: string;
    suggestion?: string;
    timestamp: number;
}

export interface EmotionState {
    participantId: string;
    emotion: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'engaged' | 'bored';
    confidence: number; // 0-100
    timestamp: number;
}

export interface ConflictDetection {
    id: string;
    participants: string[];
    severity: 'low' | 'medium' | 'high';
    summary: string;
    resolutionSuggestions: string[];
    timestamp: number;
}

export interface PredictiveQuestion {
    id: string;
    question: string;
    context: string;
    priority: 'high' | 'medium' | 'low';
    category: 'risk' | 'clarification' | 'follow-up' | 'strategic';
    timestamp: number;
}

export interface FlowPrediction {
    id: string;
    predictedTopic: string;
    confidence: number; // 0-100
    estimatedTime: number; // seconds until likely
    reason: string;
    timestamp: number;
}

export interface HighlightGroup {
    id: string;
    name: string;
    blockIds: string[];
    category: 'decision' | 'action' | 'risk' | 'insight' | 'question' | 'other';
    createdAt: number;
}

export interface Notification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: number;
    read: boolean;
    actionUrl?: string;
}

export interface MeetingQualityScore {
    overall: number; // 0-100
    engagement: number;
    clarity: number;
    efficiency: number;
    participation: number;
    decisionVelocity: number;
    lastUpdated: number;
}

export interface AutoAction {
    id: string;
    type: 'create_task' | 'send_email' | 'schedule_followup' | 'update_crm' | 'generate_document';
    description: string;
    data: any;
    status: 'pending' | 'approved' | 'executed' | 'rejected';
    timestamp: number;
    preview?: string;
}

export interface CrossMeetingPattern {
    id: string;
    type: 'pattern' | 'contradiction' | 'trend' | 'relationship';
    description: string;
    confidence: number;
    relatedMeetings: string[];
    timestamp: number;
}

export interface RelationshipInsight {
    participant1: string;
    participant2: string;
    relationshipType: 'collaborative' | 'conflict' | 'neutral' | 'influential';
    strength: number; // 0-100
    interactions: number;
    lastInteraction: number;
    patterns: string[];
}

export interface PrepDocument {
    id: string;
    sessionId: string;
    participantInsights: Array<{
        name: string;
        insights: string[];
        likelyQuestions: string[];
    }>;
    likelyTopics: string[];
    suggestedQuestions: string[];
    risks: string[];
    context: string;
    generatedAt: number;
}

interface MeetingState {
    sessionId: string | null;
    isRecording: boolean;
    isPaused: boolean;
    isSilentMode: boolean;
    startTime: number | null;
    elapsedTime: number; // seconds

    // Audio capture status
    microphonePermission: 'granted' | 'denied' | 'prompt' | 'unknown';
    systemAudioPermission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested';
    isAudioCapturing: boolean;
    audioLevel: number; // 0-100 for visual indicator (microphone)
    systemAudioLevel: number; // 0-100 for visual indicator (system audio)

    transcriptBlocks: TranscriptBlock[];
    detectedActions: DetectedAction[];
    clarifications: Clarification[];
    risks: Risk[];
    participants: Participant[];

    // Audio Enhancements
    partialTranscript: TranscriptBlock | null;
    customVocabulary: string[];
    autoStopEnabled: boolean; // Intelligent Auto-Stop
    silenceTimeoutMs: number;
    lastTranscriptTime: number;
    audioGain: number; // Digital Gain (0.0 to 5.0)

    // New differentiators
    meetingHealth: MeetingHealth | null;
    topicClusters: TopicCluster[];
    liveSummary: LiveSummary | null;

    // Collaboration
    activeViewers: Array<{ id: string; name: string; avatar?: string }>;

    // Voice commands
    isListening: boolean;

    // Real-time coaching
    coachingInsights: CoachingInsight[];
    userSpeakingBlocks: TranscriptBlock[]; // Blocks where user is speaking

    // Emotion & engagement
    emotionStates: EmotionState[];

    // Conflict detection
    conflicts: ConflictDetection[];

    // Predictive questions
    predictiveQuestions: PredictiveQuestion[];

    // Layout preferences
    layoutMode: 'minimal' | 'detailed' | 'balanced' | 'custom';
    focusedPanels: string[]; // Panel IDs that are focused

    // Flow prediction
    flowPredictions: FlowPrediction[];

    // Smart highlighting
    highlightGroups: HighlightGroup[];

    // Notifications
    notifications: Notification[];

    // Meeting quality score
    meetingQualityScore: MeetingQualityScore | null;

    // AI Co-Pilot Auto Actions
    autoActions: AutoAction[];
    autoActionsEnabled: boolean;

    // Cross-Meeting Intelligence
    crossMeetingPatterns: CrossMeetingPattern[];
    relationshipInsights: RelationshipInsight[];
    isAnalyzingPatterns: boolean;
    setAnalyzingPatterns: (isAnalyzing: boolean) => void;
    addCrossMeetingPattern: (pattern: CrossMeetingPattern) => void;

    // Predictive Preparation
    prepDocuments: PrepDocument[];

    // Actions
    startSession: (sessionId: string) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    stopSession: () => void;
    resetSession: () => void;
    toggleSilentMode: () => void;
    checkMicrophonePermission: () => Promise<void>;
    requestMicrophonePermission: () => Promise<void>;
    requestSystemAudioPermission: () => Promise<void>;
    selectedSystemAudioDevice: string | null;
    setSelectedSystemAudioDevice: (deviceName: string | null) => void;
    selectedMicrophoneDevice: string | null;
    setSelectedMicrophoneDevice: (deviceName: string | null) => void;
    // C# Audio Service Control
    audioServiceStatus: {
        isCapturing: boolean;
        isAssemblyAIConnected?: boolean;
        isBackendConnected?: boolean;
        isConnected: boolean;
        selectedDeviceId: string | null;
        microphone?: {
            level: number;
            detectingAudio: boolean;
            deviceName: string | null;
            enabled: boolean;
        };
        systemAudio?: {
            level: number;
            detectingAudio: boolean;
            deviceName: string | null;
            enabled: boolean;
        };
    } | null;
    isModelLoading: boolean;
    modelLoadingMessage: string | null;
    setModelLoading: (isLoading: boolean, message?: string) => void;
    audioServiceDevices: { microphones: Array<{ id: string; name: string }>; speakers: Array<{ id: string; name: string }> } | null;
    getAudioServiceStatus: () => Promise<void>;
    startAudioService: (systemDeviceId?: string, microphoneDeviceId?: string) => Promise<void>;
    stopAudioService: () => Promise<void>;
    getAudioServiceDevices: () => Promise<{ microphones: Array<{ id: string; name: string }>; speakers: Array<{ id: string; name: string }> }>;
    setAudioServiceDevice: (deviceId: string) => Promise<void>;
    setAudioCapturing: (isCapturing: boolean) => void;
    setAudioLevel: (level: number) => void;
    setSystemAudioLevel: (level: number) => void;
    setMicrophonePermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown') => void;
    setSystemAudioPermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested') => void;
    picoVoiceStatus: 'unknown' | 'initializing' | 'ready' | 'failed';
    setPicoVoiceStatus: (status: 'unknown' | 'initializing' | 'ready' | 'failed') => void;
    markCriticalMoment: () => void;

    // Audio Enhancement Actions
    setCustomVocabulary: (terms: string[]) => void;
    setAutoStopEnabled: (enabled: boolean) => void;
    setAudioGain: (gain: number) => Promise<void>;
    setPartialTranscript: (block: TranscriptBlock | null) => void;

    addTranscriptBlock: (block: Omit<TranscriptBlock, 'id' | 'createdAt'>) => void;
    toggleHighlight: (blockId: string) => void;
    addDetectedAction: (action: Omit<DetectedAction, 'id'>) => void;
    confirmActionAsTask: (actionId: string) => void;
    addClarification: (clarification: Omit<Clarification, 'id'>) => void;
    addRisk: (risk: Omit<Risk, 'id'>) => void;
    updateParticipant: (speakerId: string, updates: Partial<Participant>) => void;
    updateSpeakerName: (contactId: string, newName: string) => void;
    associateSpeakerToContact: (speakerId: string, contactId: string) => void;

    // New differentiators
    updateMeetingHealth: () => void;
    addTopicCluster: (cluster: Omit<TopicCluster, 'id'>) => void;
    updateLiveSummary: () => void;
    autoClusterTopics: () => void;
    analyzeSentiment: (text: string) => 'positive' | 'neutral' | 'negative';

    // Collaboration
    addViewer: (viewer: { id: string; name: string; avatar?: string }) => void;
    removeViewer: (viewerId: string) => void;

    // Voice commands
    toggleVoiceCommands: () => void;

    // Real-time coaching
    analyzeUserSpeaking: () => void;
    addCoachingInsight: (insight: Omit<CoachingInsight, 'id'>) => void;
    dismissCoachingInsight: (id: string) => void;

    // Emotion & engagement
    updateEmotionState: (participantId: string, emotion: EmotionState['emotion'], confidence: number) => void;

    // Conflict detection
    detectConflicts: () => void;
    addConflict: (conflict: Omit<ConflictDetection, 'id'>) => void;

    // Predictive questions
    generatePredictiveQuestions: () => void;
    addPredictiveQuestion: (question: Omit<PredictiveQuestion, 'id'>) => void;

    // Layout
    setLayoutMode: (mode: 'minimal' | 'detailed' | 'balanced' | 'custom') => void;
    togglePanelFocus: (panelId: string) => void;

    // Flow prediction
    predictNextTopics: () => void;
    addFlowPrediction: (prediction: Omit<FlowPrediction, 'id'>) => void;

    // Smart highlighting
    createHighlightGroup: (group: Omit<HighlightGroup, 'id'>) => void;
    addBlockToHighlightGroup: (groupId: string, blockId: string) => void;
    autoGroupHighlights: () => void;

    // Notifications
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    markNotificationAsRead: (id: string) => void;
    dismissNotification: (id: string) => void;
    clearAllNotifications: () => void;

    // Meeting quality score
    calculateMeetingQualityScore: () => void;

    // AI Co-Pilot Auto Actions
    enableAutoActions: () => void;
    disableAutoActions: () => void;
    generateAutoActions: () => void;
    addAutoAction: (action: AutoAction) => void;
    approveAutoAction: (actionId: string) => void;
    rejectAutoAction: (actionId: string) => void;
    executeAutoAction: (actionId: string) => void;

    // Cross-Meeting Intelligence
    analyzeCrossMeetingPatterns: () => void;
    detectContradictions: () => void;
    analyzeTrends: () => void;
    updateRelationshipInsights: () => void;

    // Predictive Preparation
    generatePrepDocument: (sessionId: string) => void;
    getParticipantInsights: (participantId: string) => string[];

    // Persistence
    loadTranscripts: (sessionId: string) => Promise<void>;
}

// Timer reference for cleanup
let timerInterval: ReturnType<typeof setInterval> | null = null;

// AudioStreamer instance
let audioStreamer: AudioStreamer | null = null;

export const useMeetingStore = create<MeetingState>()(
    persist(
        (set, get) => {
            // Load selected devices from localStorage on init
            const savedDevice = typeof window !== 'undefined' ? localStorage.getItem('selectedSystemAudioDevice') : null;
            const savedMicDevice = typeof window !== 'undefined' ? localStorage.getItem('selectedMicrophoneDevice') : null;

            return {
                sessionId: null,
                isRecording: false,
                isPaused: false,
                isSilentMode: false,
                microphonePermission: 'unknown',
                systemAudioPermission: 'not_requested',
                selectedSystemAudioDevice: savedDevice,
                selectedMicrophoneDevice: savedMicDevice,
                isAudioCapturing: false,
                audioLevel: 0,
                systemAudioLevel: 0,
                startTime: null,
                elapsedTime: 0,

                transcriptBlocks: [],
                detectedActions: [],
                clarifications: [],
                risks: [],
                participants: [],

                // Audio Enhancements
                partialTranscript: null,
                customVocabulary: [],
                autoStopEnabled: false,
                silenceTimeoutMs: 30000, // 30 seconds default
                lastTranscriptTime: 0,
                audioGain: 1.0,

                // New differentiators
                meetingHealth: null,
                topicClusters: [],
                liveSummary: null,

                // Collaboration
                activeViewers: [],

                // Voice commands
                isListening: false,

                // Real-time coaching
                coachingInsights: [],
                userSpeakingBlocks: [],

                // Emotion & engagement
                emotionStates: [],

                // Conflict detection
                conflicts: [],

                // Predictive questions
                predictiveQuestions: [],

                // Layout preferences
                layoutMode: 'balanced',
                focusedPanels: [],

                // Flow prediction
                flowPredictions: [],

                // Smart highlighting
                highlightGroups: [],

                // Notifications
                notifications: [],

                // Meeting quality score
                meetingQualityScore: null,

                isModelLoading: false,
                modelLoadingMessage: null,
                setModelLoading: (isLoading: boolean, message?: string) => set({ isModelLoading: isLoading, modelLoadingMessage: message || null }),

                // AI Co-Pilot Auto Actions
                autoActions: [],
                autoActionsEnabled: false,

                // Cross-Meeting Intelligence
                crossMeetingPatterns: [],
                relationshipInsights: [],
                isAnalyzingPatterns: false,

                setAnalyzingPatterns: (isAnalyzing: boolean) => set({ isAnalyzingPatterns: isAnalyzing }),

                addCrossMeetingPattern: (pattern: CrossMeetingPattern) => {
                    set(state => ({
                        crossMeetingPatterns: [pattern, ...state.crossMeetingPatterns],
                        isAnalyzingPatterns: false // Stop analyzing when we receive a pattern
                    }));
                },

                // Predictive Preparation
                prepDocuments: [],

                audioServiceStatus: null,
                audioServiceDevices: null,
                picoVoiceStatus: 'unknown',

                setPicoVoiceStatus: (status: 'unknown' | 'initializing' | 'ready' | 'failed') => set({ picoVoiceStatus: status }),

                resetSession: () => {
                    set({
                        sessionId: null,
                        isRecording: false,
                        isPaused: false,
                        startTime: null,
                        elapsedTime: 0,
                        transcriptBlocks: [],
                        partialTranscript: null,
                        participants: [],
                        detectedActions: [],
                        clarifications: [],
                        risks: [],
                        meetingHealth: null,
                        topicClusters: [],
                        liveSummary: null,
                        coachingInsights: [],
                        emotionStates: [],
                        conflicts: [],
                        predictiveQuestions: [],
                        flowPredictions: [],
                        highlightGroups: [],
                        notifications: [],
                        meetingQualityScore: null,
                        autoActions: [],

                        crossMeetingPatterns: [],
                        isAnalyzingPatterns: false,
                        relationshipInsights: [],
                        prepDocuments: [],
                        // Don't reset permissions or devices
                    });
                },

                startSession: async (sessionId: string) => {
                    // Clear any existing timer and audio streamer
                    if (timerInterval) {
                        clearInterval(timerInterval);
                    }
                    if (audioStreamer) {
                        audioStreamer.stop();
                        audioStreamer = null;
                    }

                    const startTime = Date.now();
                    set({
                        sessionId,
                        isRecording: true,
                        isPaused: false,
                        startTime,
                        elapsedTime: 0,
                        transcriptBlocks: [], // Clear previous transcript
                    });


                    // Request system audio permission if not already granted
                    const state = get();
                    if (state.systemAudioPermission === 'not_requested' || state.systemAudioPermission === 'prompt') {
                        // Automatically request system audio when starting session
                        get().requestSystemAudioPermission().catch((e) => {
                            console.warn('Failed to request system audio permission:', e);
                        });
                    }

                    // Start timer
                    const autoStopCheckInterval = 1000;
                    timerInterval = setInterval(() => {
                        const state = get();

                        // Update elapsed time
                        if (state.isRecording && !state.isPaused && state.startTime) {
                            set({ elapsedTime: Math.floor((Date.now() - state.startTime) / 1000) });
                        }

                        // Auto-Stop Check
                        if (state.isRecording && state.autoStopEnabled && state.lastTranscriptTime > 0) {
                            const silenceDuration = Date.now() - state.lastTranscriptTime;
                            if (silenceDuration > state.silenceTimeoutMs) {
                                console.warn('[Auto-Stop] Stopping session due to silence. Duration:', silenceDuration, 'Timeout:', state.silenceTimeoutMs);
                                get().stopSession();
                                get().addNotification({
                                    type: 'info',
                                    title: 'Session Auto-Stopped',
                                    message: 'Session stopped automatically due to inactivity.',
                                    timestamp: Date.now(),
                                    priority: 'medium',
                                    read: false
                                });
                            }
                        }
                    }, autoStopCheckInterval);

                    // Initialize lastTranscriptTime to prevent immediate auto-stop if persisting
                    set({ lastTranscriptTime: Date.now() });

                    // Priority 1: Try to use C# Audio Service (Native Performance)
                    try {
                        // Check status first if not known
                        if (!state.audioServiceStatus) {
                            await get().getAudioServiceStatus();
                        }

                        const freshState = get();
                        // If service is reachable (status not null), use it!
                        if (freshState.audioServiceStatus) {
                            console.log('Starting C# Audio Service (Native Mode)...');
                            await get().startAudioService(
                                freshState.selectedSystemAudioDevice || undefined,
                                freshState.selectedMicrophoneDevice || undefined
                            );
                            return; // Exit, letting startAudioService handle the rest
                        }
                    } catch (e) {
                        console.warn('Failed to start C# Audio Service, falling back to Browser Audio:', e);
                    }

                    // Priority 2: Fallback to Browser Audio (AudioStreamer)
                    console.log('Starting Browser Audio Streamer (Fallback Mode)...');

                    // Start audio streaming and transcription
                    // Backend WebSocket endpoint is at /api/ws/transcription
                    const savedPrefBrowser = localStorage.getItem('transcription_preference');
                    const useAssemblyAIParam = savedPrefBrowser !== 'whisper';
                    const wsUrl = getWebSocketUrl(`/api/ws/transcription?useAssemblyAI=${useAssemblyAIParam}`);
                    console.log('=== Audio Streamer Debug ===');
                    console.log('API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api');
                    console.log('WS_BASE_URL calculated:', import.meta.env.VITE_WS_BASE_URL || 'auto');
                    console.log('WebSocket URL:', wsUrl);
                    console.log('Expected URL: ws://localhost:8000/api/ws/transcription');
                    console.log('URLs match?', wsUrl === 'ws://localhost:8000/api/ws/transcription');
                    console.log('===========================');

                    // Set selected device in global scope for AudioStreamer to access
                    const currentState = get();
                    if (currentState.selectedSystemAudioDevice) {
                        (window as any).__selectedSystemAudioDevice = currentState.selectedSystemAudioDevice;
                    } else {
                        delete (window as any).__selectedSystemAudioDevice;
                    }

                    // Create AudioStreamer with system audio capture enabled
                    audioStreamer = new AudioStreamer(
                        (data) => {
                            // Handle transcript data from WebSocket
                            const state = get();

                            // Check pause state - ignore transcripts if paused
                            if (state.isPaused) {
                                return;
                            }

                            if (data.type === 'transcript' && data.text) {
                                // Add transcript block
                                const newBlock: TranscriptBlock = {
                                    id: Date.now().toString() + Math.random().toString(36).substring(7),
                                    speaker: data.speaker || 'Speaker A',
                                    speakerId: data.speaker_id,
                                    text: data.text,
                                    timestamp: state.elapsedTime,
                                    isFinal: data.is_final,
                                    createdAt: new Date().toISOString(),
                                    traceId: data.trace_id,
                                };

                                if (data.is_final) {
                                    // Final transcript - add as new block
                                    get().addTranscriptBlock(newBlock);
                                } else {
                                    // Partial transcript - update last block or add new
                                    const currentBlocks = state.transcriptBlocks;
                                    if (currentBlocks.length > 0 && !currentBlocks[currentBlocks.length - 1].isFinal) {
                                        // Update last partial block
                                        set({
                                            transcriptBlocks: currentBlocks.map((block, index) =>
                                                index === currentBlocks.length - 1
                                                    ? { ...block, text: data.text, isFinal: false }
                                                    : block
                                            )
                                        });
                                    } else {
                                        // Add new partial block
                                        get().addTranscriptBlock(newBlock);
                                    }
                                }
                            } else if (data.type === 'status') {
                                console.log('Transcription status:', data.status);
                                if (data.status === 'connected') {
                                    console.log('AssemblyAI connected, session ID:', data.session_id);
                                } else if (data.status === 'model_loading') {
                                    get().setModelLoading(true, data.message || 'Model is loading...');
                                    get().addNotification({
                                        type: 'info',
                                        title: 'AI Model Loading',
                                        message: data.message || 'Initializing local AI model on GPU...',
                                        priority: 'low',
                                        timestamp: Date.now(),
                                        read: false
                                    });
                                } else if (data.status === 'model_loaded' || data.status === 'ready') {
                                    get().setModelLoading(false);
                                }
                            } else if (data.type === 'speaker_update' && data.trace_id && data.speaker) {
                                // Retroactive UPDATE
                                // console.log('[Speaker Update]', data.trace_id, data.speaker);
                                const state = get();
                                const currentBlocks = state.transcriptBlocks;

                                // Find block by trace_id
                                const blockIndex = currentBlocks.findIndex(b => b.traceId === data.trace_id);

                                if (blockIndex !== -1) {
                                    set({
                                        transcriptBlocks: currentBlocks.map((block, index) =>
                                            index === blockIndex
                                                ? { ...block, speaker: data.speaker, speakerId: data.speaker_id || data.contact_id }
                                                : block
                                        )
                                    });
                                }

                            } else if (data.type === 'error') {
                                console.error('Transcription error:', data.message);
                                get().addNotification({
                                    type: 'error',
                                    title: 'Transcription Error',
                                    message: `Transcription error: ${data.message}`,
                                    timestamp: Date.now(),
                                    priority: 'high',
                                    read: false,
                                });
                            } else if (data.type === 'voice_identification' && data.contact_id) {
                                // Voice Identification Event
                                console.log('[VoiceID] Identified:', data.contact_id, data.score, data.is_auto_created ? '(auto-created)' : '');
                                const state = get();

                                (async () => {
                                    try {
                                        // If this is an auto-created contact, show notification
                                        if (data.is_auto_created) {
                                            const contactName = data.contact_name || 'Novo Contacto';

                                            get().addNotification({
                                                type: 'success',
                                                title: 'Novo Contacto Criado',
                                                message: `Foi criado automaticamente um novo contacto: "${contactName}". Pode editá-lo na página de Contactos.`,
                                                priority: 'medium',
                                                timestamp: Date.now(),
                                                read: false,
                                                actionUrl: `/contacts/${data.contact_id}`
                                            });
                                        }

                                        // Simple optimization: check if we already have this speaker mapped in participants
                                        let participant = state.participants.find(p => p.contactId === data.contact_id);
                                        let speakerName = participant?.name;

                                        if (!speakerName) {
                                            // Fetch from API
                                            try {
                                                // We need to import workspaceApi dynamically or just use api directly to avoid circular deps if any
                                                const { workspaceApi } = await import('@/api/client');
                                                const contact = await workspaceApi.getContact(data.contact_id);
                                                speakerName = contact.name;
                                            } catch (e) {
                                                console.warn('Failed to resolve contact name:', e);
                                                speakerName = data.contact_name || 'Unknown Contact';
                                            }
                                        }

                                        if (speakerName) {
                                            const currentBlocks = get().transcriptBlocks;
                                            if (currentBlocks.length > 0) {
                                                // Only update if it's the last block (most likely the one currently being spoken)
                                                set({
                                                    transcriptBlocks: currentBlocks.map((block, index) => {
                                                        if (index === currentBlocks.length - 1) {
                                                            return { ...block, speaker: speakerName!, speakerId: data.contact_id };
                                                        }
                                                        return block;
                                                    })
                                                });
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Error handling voice ID async:', e);
                                    }
                                })();

                            } else if (data.type === 'voice_identification_status') {
                                // PicoVoice Status Update
                                console.log('[PicoVoice] Status:', data.status, data.message || '');
                                get().setPicoVoiceStatus(data.status);
                                if (data.status === 'failed') {
                                    get().addNotification({
                                        type: 'warning',
                                        title: 'PicoVoice Identification Logic Failed',
                                        message: `Speaker ID unavailable: ${data.message}`,
                                        timestamp: Date.now(),
                                        priority: 'low',
                                        read: false
                                    });
                                }
                            } else if (data.type === 'heartbeat') {
                                // Keep-alive heartbeat - no action needed
                            }
                        },
                        (error) => {
                            console.error('AudioStreamer error:', error);
                            get().addNotification({
                                type: 'error',
                                title: 'Audio Streaming Error',
                                message: `Audio streaming error: ${error}`,
                                timestamp: Date.now(),
                                priority: 'high',
                                read: false,
                            });
                        },
                        true, // Enable system audio capture
                        (status) => {
                            // Update status in store
                            get().setAudioCapturing(status.isCapturing);
                            get().setMicrophonePermission(status.permission);
                            get().setAudioLevel(status.audioLevel);
                            get().setSystemAudioLevel(status.systemAudioLevel);
                            get().setSystemAudioPermission(status.systemPermission);
                        }
                    );


                    audioStreamer.start(wsUrl).catch((error) => {
                        console.error('Failed to start audio streamer:', error);
                        get().addNotification({
                            type: 'error',
                            title: 'Capture Error',
                            message: `Failed to start audio capture: ${error}`,
                            timestamp: Date.now(),
                            priority: 'high',
                            read: false,
                        });
                    });
                },

                pauseSession: async () => {
                    set({ isPaused: true });

                    // Actually stop the audio service to pause capture
                    try {
                        const state = get();
                        if (state.audioServiceStatus?.isCapturing) {
                            await get().stopAudioService();
                        } else if (audioStreamer) {
                            audioStreamer.stop();
                        }
                    } catch (e) {
                        console.warn('Error pausing audio service:', e);
                    }
                },

                resumeSession: async () => {
                    const state = get();

                    // Resume/Restart the audio service
                    try {
                        if (state.selectedMicrophoneDevice || state.selectedSystemAudioDevice) {
                            await get().startAudioService(
                                state.selectedSystemAudioDevice || undefined,
                                state.selectedMicrophoneDevice || undefined
                            );
                        } else {
                            // Fallback/Default restart logic handled by startAudioService internally or start session flow
                            // If we are native mode, we try native start
                            await get().startAudioService();
                        }
                    } catch (e) {
                        console.error('Error resuming audio service:', e);
                    }

                    if (state.startTime) {
                        // Adjust start time to account for pause
                        const pausedDuration = Date.now() - (state.startTime + state.elapsedTime * 1000);
                        set({
                            isPaused: false,
                            startTime: state.startTime + pausedDuration
                        });
                    } else {
                        set({ isPaused: false });
                    }
                },

                stopSession: () => {
                    console.group('[meetingStore] stopSession called');
                    console.trace('Who called stopSession?');
                    console.groupEnd();

                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                    if (audioStreamer) {
                        audioStreamer.stop();
                        audioStreamer = null;
                    }

                    // Also stop C# Audio Service if running
                    // Also stop C# Audio Service if running
                    try {
                        // Aggressively attempt to stop without checking status (status might be stale)
                        console.log('Stopping C# Audio Service...');
                        get().stopAudioService().catch(e => console.warn('Failed to stop C# service:', e));
                    } catch (e) {
                        console.warn('Error stopping audio service:', e);
                    }

                    set({
                        isRecording: false,
                        isPaused: false,
                        startTime: null,
                        isAudioCapturing: false,
                        audioLevel: 0,
                    });
                },

                toggleSilentMode: () => {
                    set(state => ({ isSilentMode: !state.isSilentMode }));
                },

                checkMicrophonePermission: async () => {
                    try {
                        if (!navigator.permissions) {
                            // Fallback for browsers without Permissions API
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                stream.getTracks().forEach(track => track.stop());
                                set({ microphonePermission: 'granted' });
                            } catch (e: any) {
                                if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                                    set({ microphonePermission: 'denied' });
                                } else {
                                    set({ microphonePermission: 'prompt' });
                                }
                            }
                            return;
                        }

                        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                        set({ microphonePermission: result.state as 'granted' | 'denied' | 'prompt' });

                        // Listen for permission changes
                        result.onchange = () => {
                            set({ microphonePermission: result.state as 'granted' | 'denied' | 'prompt' });
                        };
                    } catch (e) {
                        console.error('Error checking microphone permission:', e);
                        set({ microphonePermission: 'unknown' });
                    }
                },

                setMicrophonePermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown') => {
                    set({ microphonePermission: permission });
                },

                setSystemAudioPermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested') => {
                    set({ systemAudioPermission: permission });
                },

                requestMicrophonePermission: async () => {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(track => track.stop());
                        set({ microphonePermission: 'granted' });
                    } catch (e: any) {
                        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                            set({ microphonePermission: 'denied' });
                        } else {
                            set({ microphonePermission: 'prompt' });
                        }
                    }
                },

                requestSystemAudioPermission: async () => {
                    try {
                        // Check if C# Audio Service is available
                        console.log('Checking C# Audio Service availability...');
                        set({ systemAudioPermission: 'prompt' });

                        try {
                            await get().getAudioServiceStatus();
                            // If we can get status, the service is available
                            set({ systemAudioPermission: 'granted' });
                            console.log('C# Audio Service is available');
                        } catch (error) {
                            // Service might not be running
                            set({ systemAudioPermission: 'denied' });
                            console.log('C# Audio Service is not available');
                        }
                        return;

                        // Browser fallback: use getDisplayMedia (only captures tab/window audio, not system audio)
                        // NOTE: For browser, we need to request permission now, but we'll stop the stream
                        // and re-request it when startSession() is called
                        console.log('Requesting system audio permission via browser (getDisplayMedia)...');
                        set({ systemAudioPermission: 'prompt' });

                        // Check if getDisplayMedia is available
                        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                            throw new Error('getDisplayMedia is not supported in this browser. Please use Electron for system audio capture.');
                        }

                        // Note: Most browsers require video to be requested even if we only need audio
                        // We'll request both but stop video tracks immediately
                        const stream = await navigator.mediaDevices.getDisplayMedia({
                            audio: {
                                echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false,
                            },
                            video: true // Required by most browsers - we'll stop video tracks immediately
                        });

                        // Immediately stop all video tracks - we only want audio
                        const videoTracks = stream.getVideoTracks();
                        videoTracks.forEach(track => {
                            track.stop();
                            console.log('Stopped video track immediately (audio-only mode)');
                        });

                        console.log('getDisplayMedia stream obtained:', stream);
                        const audioTracks = stream.getAudioTracks();

                        console.log('Audio tracks:', audioTracks.length);
                        console.log('Video tracks (stopped):', videoTracks.length);

                        if (audioTracks.length > 0) {
                            console.log('System audio permission granted (browser method - tab/window audio only)');
                            set({ systemAudioPermission: 'granted' });
                            // IMPORTANT: Stop the stream here - we only wanted to verify permission
                            // The AudioStreamer will request a new stream when startSession() is called
                            stream.getTracks().forEach(track => track.stop());
                            console.log('Stopped permission test stream - will start capture when transcription begins');
                        } else {
                            console.warn('No audio track in system audio stream');
                            stream.getTracks().forEach(track => track.stop());
                            set({ systemAudioPermission: 'denied' });
                        }
                    } catch (e: any) {
                        console.error('Error requesting system audio permission:', e);
                        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                            set({ systemAudioPermission: 'denied' });
                        } else if (e.name === 'AbortError' || e.name === 'NotReadableError') {
                            set({ systemAudioPermission: 'denied' });
                        } else if (e.name === 'NotSupportedError' || e.message?.includes('Not supported') || e.message?.includes('video must be requested')) {
                            // Browser doesn't support getDisplayMedia
                            set({ systemAudioPermission: 'denied' });
                            const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
                            if (!isElectron) {
                                console.warn('getDisplayMedia not supported in this browser. Please use Electron for true system audio capture.');
                                // Could show a notification to the user here
                            }
                        } else {
                            set({ systemAudioPermission: 'not_requested' });
                        }
                    }
                },


                setSelectedSystemAudioDevice: (deviceName: string | null) => {
                    set({ selectedSystemAudioDevice: deviceName });
                    // Save to localStorage
                    if (deviceName) {
                        localStorage.setItem('selectedSystemAudioDevice', deviceName);
                    } else {
                        localStorage.removeItem('selectedSystemAudioDevice');
                    }
                },

                setSelectedMicrophoneDevice: (deviceName: string | null) => {
                    set({ selectedMicrophoneDevice: deviceName });
                    // Save to localStorage
                    if (deviceName) {
                        localStorage.setItem('selectedMicrophoneDevice', deviceName);
                    } else {
                        localStorage.removeItem('selectedMicrophoneDevice');
                    }
                },

                setAudioCapturing: (isCapturing: boolean) => {
                    set({ isAudioCapturing: isCapturing });
                },

                setAudioLevel: (level: number) => {
                    set({ audioLevel: Math.min(100, Math.max(0, level)) });
                },

                setSystemAudioLevel: (level: number) => {
                    set({ systemAudioLevel: Math.min(100, Math.max(0, level)) });
                },

                // C# Audio Service Control Functions
                getAudioServiceStatus: async () => {
                    try {
                        const status = await audioServiceApi.getStatus();
                        set({ audioServiceStatus: status });
                    } catch (error: any) {
                        // 503 (Service Unavailable) is expected when the service is not running
                        // Don't log it as an error, just set status to null
                        if (error?.response?.status === 503) {
                            set({ audioServiceStatus: null });
                        } else {
                            console.error('Error getting audio service status:', error);
                            set({ audioServiceStatus: null });
                        }
                    }
                },

                startAudioService: async (systemDeviceId?: string, microphoneDeviceId?: string) => {
                    try {
                        const state = get();
                        const keyterms = state.customVocabulary;
                        console.log('Starting Audio Service...');
                        console.log('  - Session ID:', state.sessionId);
                        console.log('  - Mic Device:', microphoneDeviceId);
                        console.log('  - Sys Device:', systemDeviceId);
                        console.log('  - Keyterms:', keyterms);

                        // Determinar preferência de transcrição
                        const savedPref = localStorage.getItem('transcription_preference');
                        const useAssemblyAI = savedPref !== 'whisper'; // Default true, se for 'whisper' fica false

                        console.log('  - useAssemblyAI:', useAssemblyAI);

                        await audioServiceApi.startStreaming(systemDeviceId, microphoneDeviceId, keyterms, state.sessionId || undefined, useAssemblyAI);
                        // Refresh status after starting
                        const status = await audioServiceApi.getStatus();
                        set({ audioServiceStatus: status });

                        // Connect to WebSocket to receive native transcriptions
                        const wsUrl = getWebSocketUrl(`/api/ws/transcription?mode=native&session_id=${state.sessionId}`);
                        console.log('[Native Transcription] Connecting to WebSocket:', wsUrl);

                        // Close existing connection if any
                        if ((window as any).__nativeTranscriptionWs) {
                            (window as any).__nativeTranscriptionWs.close();
                        }

                        const ws = new WebSocket(wsUrl);
                        (window as any).__nativeTranscriptionWs = ws;

                        ws.onopen = () => {
                            console.log('[Native Transcription] WebSocket connected');
                            set({ isRecording: true, isAudioCapturing: true });
                        };

                        ws.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                console.log('[Native Transcription] Received:', data.type || 'unknown');

                                // Handle different message types from AssemblyAI via C# service
                                if (data.type === 'Begin' || data.type === 'status') {
                                    console.log('[Native Transcription] Session started:', data);
                                } else if (data.type === 'Turn' || data.type === 'transcript') {
                                    // Check pause state - ignore transcripts if paused
                                    if (get().isPaused) {
                                        return;
                                    }

                                    // AssemblyAI Turn message contains transcription
                                    const text = data.transcript || data.text || '';
                                    const isFinal = data.end_of_turn === true || data.is_final === true;

                                    if (text && text.trim()) {
                                        const state = get();

                                        // DEDUPLICATION LOGIC
                                        // Use provided turn_id or fallback to generated ID
                                        // If turn_id exists, check if block already exists
                                        const turnId = data.turn_id || null;
                                        let existingBlockIndex = -1;

                                        if (turnId) {
                                            existingBlockIndex = state.transcriptBlocks.findIndex(b => b.id === turnId);
                                        }

                                        if (existingBlockIndex !== -1) {
                                            // UPDATE EXISTING BLOCK
                                            const existingBlock = state.transcriptBlocks[existingBlockIndex];
                                            console.log('[Native Transcription] Updating Block:', turnId);

                                            const updatedBlock = {
                                                ...existingBlock,
                                                text: text.trim(), // Update text (e.g. formatted version)
                                                isFinal: isFinal || existingBlock.isFinal, // Only upgrade to final
                                                // PRESERVE SPEAKER if existing block has one (e.g. from Voice ID) but new one doesn't
                                                speaker: (existingBlock.speaker !== 'Speaker' && existingBlock.speaker !== 'Speaking...')
                                                    ? existingBlock.speaker
                                                    : (data.speaker || existingBlock.speaker)
                                            };

                                            const newBlocks = [...state.transcriptBlocks];
                                            newBlocks[existingBlockIndex] = updatedBlock;

                                            set({
                                                transcriptBlocks: newBlocks,
                                                lastTranscriptTime: Date.now()
                                            });
                                        } else {
                                            // CREATE NEW BLOCK
                                            const newBlock: TranscriptBlock = {
                                                id: turnId || (Date.now().toString() + Math.random().toString(36).substring(7)),
                                                speaker: data.speaker || 'Speaker',
                                                speakerId: data.speaker_id,
                                                text: text.trim(),
                                                timestamp: state.elapsedTime,
                                                isFinal: isFinal,
                                                createdAt: new Date().toISOString(),
                                                traceId: data.trace_id
                                            };

                                            if (isFinal) {
                                                set({
                                                    transcriptBlocks: [...state.transcriptBlocks, newBlock],
                                                    partialTranscript: null,
                                                    lastTranscriptTime: Date.now()
                                                });
                                                console.log('[Native Transcription] Final Block:', text.substring(0, 50) + '...');
                                            } else {
                                                set({
                                                    partialTranscript: {
                                                        ...newBlock,
                                                        id: 'partial',
                                                        isFinal: false
                                                    },
                                                    lastTranscriptTime: Date.now()
                                                });
                                            }
                                        }
                                    }

                                } else if (data.type === 'speaker_update') {
                                    // HANDLE SPEAKER ASSIGNMENT UPDATE
                                    // This comes from the backend when we manually assign a contact to a speaker/trace
                                    console.log('[Native Transcription] Speaker Assignment Update:', data);

                                    const { trace_id, contact_id, speaker, old_speaker_name } = data;
                                    const newName = speaker || 'Unknown';

                                    set(state => {
                                        // 1. Update Participants List directly
                                        const updatedParticipants = state.participants.map(p => {
                                            // Match by trace_id (if we tracked it) or just update if we can find the old temporary participant
                                            // In this case, we might need to find the participant that was "Guest X"
                                            // But for now, let's look for matching contactId or just update if we have a match

                                            // If we have a participant with the OLD name (trace_id might be used as ID temporarily)
                                            if (p.id === trace_id || p.name === trace_id || p.name === old_speaker_name) {
                                                return { ...p, name: newName, contactId: contact_id };
                                            }
                                            return p;
                                        });

                                        // 2. Update Transcript Blocks (Retroactive Update)
                                        // We want to replace "Guest X", "Speaker A", or "Novo Contacto X" with the new name
                                        const updatedBlocks = state.transcriptBlocks.map(block => {
                                            const isMatch =
                                                // 1. Direct ID Match (Best)
                                                (block.speakerId && block.speakerId === trace_id) ||
                                                // 2. Direct Name Match (Fallback)
                                                (block.speaker === trace_id) ||
                                                // 3. Special Case: Speaker A/B... logic
                                                (trace_id.startsWith('Speaker') && block.speaker === trace_id) ||
                                                // 4. Checking if trace_id was actually the name
                                                (trace_id === block.speaker);

                                            if (isMatch) {
                                                console.log(`[Store] Retroactively updating block ${block.id}: ${block.speaker} -> ${newName}`);
                                                return {
                                                    ...block,
                                                    speaker: newName,
                                                    speakerId: contact_id,
                                                    // Add a flag to force re-render if needed
                                                    updatedAt: Date.now()
                                                };
                                            }
                                            return block;
                                        });

                                        return {
                                            participants: updatedParticipants,
                                            transcriptBlocks: updatedBlocks
                                        };
                                    });

                                } else if (data.type === 'voice_identification' && data.contact_id) {

                                    // HANDLE VOICE IDENTIFICATION
                                    console.log('[VoiceID Native] Identified:', data.contact_id, data.score);

                                    // 1. Resolve Speaker Name
                                    // Start with text from payload, fallback to searching participants, then API
                                    let speakerName = data.contact_name;
                                    const traceId = data.trace_id; // e.g. "Novo Contacto 1"

                                    // Helper to fetch name asynchronously if needed
                                    const resolveName = async () => {
                                        if (speakerName) return speakerName;

                                        const p = get().participants.find(p => p.contactId === data.contact_id);
                                        if (p && p.name) return p.name;

                                        try {
                                            const { workspaceApi } = await import('@/api/client');
                                            const contact = await workspaceApi.getContact(data.contact_id);
                                            return contact.name;
                                        } catch {
                                            return 'Unknown Contact';
                                        }
                                    };

                                    resolveName().then(resolvedName => {
                                        speakerName = resolvedName;

                                        set(state => {
                                            const now = Date.now();

                                            // 2. Update Transcript Blocks (The Source of Truth for "Current Speakers")
                                            // We want to unify all blocks that belong to this person under one speakerId (UUID).
                                            // This prevents duplicates in the Participants list.
                                            let updatedBlocks = state.transcriptBlocks.map(block => {
                                                const isMatch =
                                                    (traceId && block.traceId === traceId) ||
                                                    (traceId && block.speaker === traceId) || // Catch "Novo Contacto 1" blocks by name
                                                    (block.speaker === speakerName);

                                                if (isMatch) {
                                                    return {
                                                        ...block,
                                                        speaker: speakerName,
                                                        speakerId: data.contact_id, // Unify ID
                                                        traceId: traceId || block.traceId,
                                                        updatedAt: now
                                                    };
                                                }

                                                // 4. Heuristic: recent blocks without ID
                                                const isRecent = (now - new Date(block.createdAt).getTime()) < 5000;
                                                if (isRecent && !block.speakerId && !block.traceId) {
                                                    return {
                                                        ...block,
                                                        speaker: speakerName,
                                                        speakerId: data.contact_id,
                                                        traceId: traceId || block.traceId,
                                                        updatedAt: now
                                                    };
                                                }

                                                return block;
                                            });

                                            // 3. Update Participants List (The Source for "Edit" capability)
                                            // Ensure we have a participant entry with this speakerId AND contactId.
                                            let updatedParticipants = [...state.participants];
                                            const existingPartIndex = updatedParticipants.findIndex(p => p.contactId === data.contact_id || p.speakerId === data.contact_id);

                                            // Also find by temp name if needed
                                            const tempPartIndex = updatedParticipants.findIndex(p => p.name === traceId || p.speakerId === traceId);

                                            if (existingPartIndex !== -1) {
                                                // Update existing
                                                updatedParticipants[existingPartIndex] = {
                                                    ...updatedParticipants[existingPartIndex],
                                                    name: speakerName,
                                                    contactId: data.contact_id,
                                                    speakerId: data.contact_id // Ensure UUID is primary ID
                                                };
                                                // If we found a separate temp entry, remove it (merge)
                                                if (tempPartIndex !== -1 && tempPartIndex !== existingPartIndex) {
                                                    updatedParticipants = updatedParticipants.filter((_, idx) => idx !== tempPartIndex);
                                                }
                                            } else if (tempPartIndex !== -1) {
                                                // Upgrading temp participant
                                                updatedParticipants[tempPartIndex] = {
                                                    ...updatedParticipants[tempPartIndex],
                                                    name: speakerName,
                                                    contactId: data.contact_id,
                                                    speakerId: data.contact_id
                                                };
                                            } else {
                                                // Create new if strictly needed (usually ParticipantsPane derives from blocks, but having it here helps State retention)
                                                updatedParticipants.push({
                                                    id: data.contact_id,
                                                    speakerId: data.contact_id,
                                                    name: speakerName,
                                                    contactId: data.contact_id,
                                                    isSpeaking: false
                                                } as Participant);
                                            }

                                            return {
                                                transcriptBlocks: updatedBlocks,
                                                participants: updatedParticipants
                                            };
                                        });

                                        // 4. Notifications (Side Effects)
                                        if (data.is_auto_created) {
                                            import('@/store/workspaceStore').then(({ useWorkspaceStore }) => {
                                                useWorkspaceStore.getState().fetchContacts();
                                            });
                                            get().addNotification({
                                                type: 'success',
                                                title: 'Novo Contacto Criado',
                                                message: `Foi criado automaticamente um novo contacto: "${speakerName}".`,
                                                priority: 'medium',
                                                timestamp: Date.now(),
                                                read: false,
                                                actionUrl: `/contacts/${data.contact_id}`
                                            });
                                        }
                                    });

                                } else if (data.type === 'cross_meeting_patterns' || data.type === 'intelligence_update') {
                                    // Handle Server-Push Intelligence
                                    console.log('[Native Transcription] Intelligence Update:', data);
                                    if (data.patterns && Array.isArray(data.patterns)) {
                                        set({
                                            crossMeetingPatterns: data.patterns, // Replace or append? Usually replace full list or append new ones. Let's replace for now or append if distinct.
                                            isAnalyzingPatterns: false
                                        });
                                    }
                                } else if (data.type === 'analyzing_started') {
                                    console.log('[Native Transcription] AI is thinking...');
                                    set({ isAnalyzingPatterns: true });

                                } else if (data.type === 'Termination' || data.type === 'End') {
                                    console.log('[Native Transcription] Session ended');
                                }
                            } catch (e) {
                                console.error('[Native Transcription] Failed to parse message:', e);
                            }
                        };

                        ws.onerror = (e) => {
                            console.error('[Native Transcription] WebSocket error:', e);
                        };

                        ws.onclose = (event) => {
                            console.log('[Native Transcription] WebSocket closed:', event.code, event.reason);
                            (window as any).__nativeTranscriptionWs = null;
                        };

                    } catch (error) {
                        console.error('Error starting audio service:', error);
                        throw error;
                    }
                },

                stopAudioService: async () => {
                    try {
                        await audioServiceApi.stopStreaming();
                        // Refresh status after stopping
                        const status = await audioServiceApi.getStatus();
                        set({ audioServiceStatus: status, isRecording: false, isAudioCapturing: false });

                        // Close WebSocket connection
                        if ((window as any).__nativeTranscriptionWs) {
                            (window as any).__nativeTranscriptionWs.close();
                            (window as any).__nativeTranscriptionWs = null;
                        }
                    } catch (error: any) {
                        console.warn('[stopAudioService] Failed to stop service gracefully (likely 503 or offline). Forcing local cleanup.', error);

                        // Force reset state even if API failed
                        set({
                            audioServiceStatus: {
                                isConnected: false,
                                isCapturing: false,
                                isAssemblyAIConnected: false,
                                isBackendConnected: false,
                                selectedDeviceId: null,
                                microphone: { deviceName: '', level: 0, detectingAudio: false, enabled: false },
                                systemAudio: { deviceName: '', level: 0, detectingAudio: false, enabled: false }
                            }, // Reset to default disconnected state
                            isRecording: false,
                            isAudioCapturing: false
                        });

                        // Do not rethrow - allows UI to return to "Ready" state
                    }
                },

                getAudioServiceDevices: async () => {
                    try {
                        const response = await audioServiceApi.getDevices();
                        // response is { devices: { microphones: [], speakers: [] } }
                        const devices = response.devices;
                        set({ audioServiceDevices: devices });
                        return devices;
                    } catch (error) {
                        console.error('Failed to get audio service devices:', error);
                        set({ audioServiceDevices: null });
                        return { microphones: [], speakers: [] };
                    }
                },

                setAudioServiceDevice: async (deviceId: string) => {
                    try {
                        await audioServiceApi.setDevice(deviceId);
                        // Refresh status after setting device
                        const status = await audioServiceApi.getStatus();
                        set({ audioServiceStatus: status });
                    } catch (error) {
                        console.error('Error setting audio service device:', error);
                        throw error;
                    }
                },

                markCriticalMoment: () => {
                    const state = get();
                    // const currentTime = state.elapsedTime;
                    // Add a highlight to the most recent transcript block
                    if (state.transcriptBlocks.length > 0) {
                        const lastBlock = state.transcriptBlocks[state.transcriptBlocks.length - 1];
                        set({
                            transcriptBlocks: state.transcriptBlocks.map(block =>
                                block.id === lastBlock.id
                                    ? { ...block, isHighlighted: true, topic: 'Critical Moment' }
                                    : block
                            )
                        });
                    }
                },

                addTranscriptBlock: (block) => {
                    const newBlock: TranscriptBlock = {
                        ...block,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                        createdAt: new Date().toISOString(),
                    };
                    set(state => ({
                        transcriptBlocks: [...state.transcriptBlocks, newBlock]
                    }));
                },

                toggleHighlight: (blockId: string) => {
                    set(state => ({
                        transcriptBlocks: state.transcriptBlocks.map(block =>
                            block.id === blockId
                                ? { ...block, isHighlighted: !block.isHighlighted }
                                : block
                        )
                    }));
                },

                setCustomVocabulary: (terms: string[]) => {
                    set({ customVocabulary: terms });
                },

                setAutoStopEnabled: (enabled: boolean) => {
                    set({ autoStopEnabled: enabled });
                },

                setAudioGain: async (gain: number) => {
                    try {
                        // Determine if we need to call the API (if service is running)
                        const state = get();
                        if (state.audioServiceStatus?.isConnected) {
                            await audioServiceApi.setGain(gain);
                        }
                        set({ audioGain: gain });
                    } catch (e) {
                        console.error('Failed to set gain:', e);
                        // Still update local state
                        set({ audioGain: gain });
                    }
                },

                setPartialTranscript: (block: TranscriptBlock | null) => {
                    set({ partialTranscript: block });
                },

                addDetectedAction: (action) => {
                    const newAction: DetectedAction = {
                        ...action,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        detectedActions: [...state.detectedActions, newAction]
                    }));
                },

                confirmActionAsTask: (actionId: string) => {
                    set(state => ({
                        detectedActions: state.detectedActions.map(action =>
                            action.id === actionId
                                ? { ...action, confirmed: true }
                                : action
                        )
                    }));
                },

                addClarification: (clarification) => {
                    const newClarification: Clarification = {
                        ...clarification,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        clarifications: [...state.clarifications, newClarification]
                    }));
                },

                addRisk: (risk) => {
                    const newRisk: Risk = {
                        ...risk,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        risks: [...state.risks, newRisk]
                    }));
                },

                updateParticipant: (speakerId: string, updates: Partial<Participant>) => {
                    set(state => {
                        const existing = state.participants.find(p => p.speakerId === speakerId);
                        if (existing) {
                            return {
                                participants: state.participants.map(p =>
                                    p.speakerId === speakerId ? { ...p, ...updates } : p
                                )
                            };
                        } else {
                            return {
                                participants: [...state.participants, {
                                    id: speakerId,
                                    speakerId,
                                    ...updates
                                } as Participant]
                            };
                        }
                    });
                },

                updateSpeakerName: (contactId: string, newName: string) => {
                    set(state => {
                        // 1. Update Participants List
                        const updatedParticipants = state.participants.map(p =>
                            p.contactId === contactId ? { ...p, name: newName } : p
                        );

                        // 2. Update Transcript Blocks
                        const updatedBlocks = state.transcriptBlocks.map(block =>
                            block.speakerId === contactId ? { ...block, speaker: newName, updatedAt: Date.now() } : block
                        );

                        console.log(`[Store] Updated speaker name for contact ${contactId} to ${newName}`);
                        return {
                            participants: updatedParticipants,
                            transcriptBlocks: updatedBlocks
                        };
                    });
                },

                associateSpeakerToContact: (speakerId: string, contactId: string) => {
                    // 1. Find contact name (optimistic)

                    // We assume the verified contact name is available later, but for now we need something to show
                    // checking if we can get it from participants or we might need to pass it? 
                    // For now, let's look it up or wait for the WS confirmation.
                    // Actually, let's broadcast the ID change and let the UI resolve the name if possible, 
                    // or just send the command and let the backend broadcast back the full update.

                    // BUT, to be "instant" as requested, we should verify we have the contact name.
                    // The UI calling this (ParticipantsPane) has the contact list, but we don't have it here easily
                    // unless we fetch it.

                    // Let's just send the command and update the Participant record. 
                    // The TranscriptPane should ideally look up names from Participants list, but it uses block.speaker string.

                    // SEND WS COMMAND
                    if (audioStreamer) {
                        audioStreamer.sendData({
                            type: 'assign_speaker',
                            speaker_id: speakerId,
                            contact_id: contactId
                        });
                    }

                    // Optimistic Update of Participant
                    get().updateParticipant(speakerId, { contactId });

                    // NOTE: We rely on the backend sending back a 'speaker_update' or 'voice_identification' event
                    // to update all the transcript blocks with the correct associated name. 
                    // Doing it purely client-side without the name (which we don't have here easily) is risky.
                    // However, we can improve this if we pass the contactName to this function too.
                },

                // Analyze sentiment of text
                analyzeSentiment: (text: string) => {
                    const lowerText = text.toLowerCase();

                    // Positive keywords
                    const positiveWords = [
                        'great', 'excellent', 'good', 'perfect', 'amazing', 'wonderful', 'fantastic',
                        'agree', 'yes', 'definitely', 'absolutely', 'sure', 'happy', 'pleased',
                        'success', 'progress', 'improve', 'better', 'best', 'love', 'like',
                        'thanks', 'thank you', 'appreciate', 'grateful', 'excited', 'optimistic'
                    ];

                    // Negative keywords
                    const negativeWords = [
                        'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike',
                        'problem', 'issue', 'error', 'fail', 'failure', 'wrong', 'incorrect',
                        'disagree', 'no', 'never', 'can\'t', 'cannot', 'unable', 'difficult',
                        'concern', 'worry', 'anxious', 'frustrated', 'angry', 'disappointed',
                        'risk', 'danger', 'threat', 'critical', 'urgent', 'delay', 'late'
                    ];

                    // Count positive and negative words
                    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
                    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

                    // Determine sentiment
                    if (positiveCount > negativeCount) {
                        return 'positive' as const;
                    } else if (negativeCount > positiveCount) {
                        return 'negative' as const;
                    } else {
                        return 'neutral' as const;
                    }
                },

                // Calculate meeting health score
                updateMeetingHealth: () => {
                    const state = get();
                    const blocks = state.transcriptBlocks;
                    const participants = state.participants;

                    if (blocks.length === 0) {
                        set({ meetingHealth: null });
                        return;
                    }

                    // Engagement: based on number of interactions
                    const engagement = Math.min(100, (blocks.length / 10) * 20);

                    // Clarity: based on average block length (shorter = clearer)
                    const avgLength = blocks.reduce((sum, b) => sum + b.text.length, 0) / blocks.length;
                    const clarity = Math.max(0, 100 - (avgLength / 20));

                    // Progress: based on decisions and actions
                    const progress = Math.min(100, (state.detectedActions.length * 20 + blocks.filter(b => b.topic === 'Decision').length * 15));

                    // Participation: based on unique speakers
                    const uniqueSpeakers = new Set(blocks.map(b => b.speaker)).size;
                    const participation = Math.min(100, (uniqueSpeakers / participants.length || 1) * 100);

                    const overall = (engagement + clarity + progress + participation) / 4;

                    set({
                        meetingHealth: {
                            engagement: Math.round(engagement),
                            clarity: Math.round(clarity),
                            progress: Math.round(progress),
                            participation: Math.round(participation),
                            overall: Math.round(overall),
                        }
                    });
                },

                // Auto-cluster topics from transcript blocks
                autoClusterTopics: () => {
                    const state = get();
                    const blocks = state.transcriptBlocks;

                    if (blocks.length === 0) {
                        return;
                    }

                    // Group blocks by topic
                    const topicMap = new Map<string, TranscriptBlock[]>();

                    blocks.forEach(block => {
                        const topic = block.topic || 'General Discussion';
                        if (!topicMap.has(topic)) {
                            topicMap.set(topic, []);
                        }
                        topicMap.get(topic)!.push(block);
                    });

                    // Create clusters from topic groups
                    const newClusters: TopicCluster[] = [];

                    topicMap.forEach((topicBlocks, topicName) => {
                        if (topicBlocks.length < 2) {
                            return; // Skip topics with only one block
                        }

                        // Check if cluster already exists for this topic
                        const existingCluster = state.topicClusters.find(
                            c => c.name === topicName &&
                                c.blocks.length === topicBlocks.length &&
                                c.blocks.every((id, idx) => id === topicBlocks[idx].id)
                        );

                        if (existingCluster) {
                            return; // Cluster already exists, skip
                        }

                        // Calculate sentiment for the cluster
                        const sentiments = topicBlocks.map(b => b.sentiment || 'neutral');
                        const positiveCount = sentiments.filter(s => s === 'positive').length;
                        const negativeCount = sentiments.filter(s => s === 'negative').length;
                        let clusterSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
                        if (positiveCount > negativeCount) {
                            clusterSentiment = 'positive';
                        } else if (negativeCount > positiveCount) {
                            clusterSentiment = 'negative';
                        }

                        // Extract keywords (most common words, excluding common stop words)
                        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);
                        const words = topicBlocks
                            .flatMap(b => b.text.toLowerCase().split(/\W+/))
                            .filter(w => w.length > 3 && !stopWords.has(w));

                        const wordCount = new Map<string, number>();
                        words.forEach(word => {
                            wordCount.set(word, (wordCount.get(word) || 0) + 1);
                        });

                        const keywords = Array.from(wordCount.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([word]) => word);

                        // Get unique participants
                        const uniqueParticipants = new Set(topicBlocks.map(b => b.speaker));

                        // Create cluster
                        const cluster: TopicCluster = {
                            id: Date.now().toString() + Math.random().toString(36).substring(7),
                            name: topicName,
                            blocks: topicBlocks.map(b => b.id),
                            startTime: Math.min(...topicBlocks.map(b => b.timestamp)),
                            endTime: Math.max(...topicBlocks.map(b => b.timestamp)),
                            sentiment: clusterSentiment,
                            keywords,
                            participantCount: uniqueParticipants.size,
                        };

                        newClusters.push(cluster);
                    });

                    // Add new clusters (avoid duplicates)
                    if (newClusters.length > 0) {
                        set(state => {
                            const existingClusterNames = new Set(state.topicClusters.map(c => c.name));
                            const clustersToAdd = newClusters.filter(c => !existingClusterNames.has(c.name));

                            if (clustersToAdd.length > 0) {
                                return {
                                    topicClusters: [...state.topicClusters, ...clustersToAdd]
                                };
                            }
                            return state;
                        });
                    }
                },

                // Add topic cluster
                addTopicCluster: (cluster) => {
                    const newCluster: TopicCluster = {
                        ...cluster,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        topicClusters: [...state.topicClusters, newCluster]
                    }));
                },

                // Update live summary
                updateLiveSummary: () => {
                    const state = get();
                    const blocks = state.transcriptBlocks;

                    if (blocks.length === 0) {
                        set({ liveSummary: null });
                        return;
                    }

                    // Extract key points (blocks with topics)
                    const keyPoints = blocks
                        .filter(b => b.topic)
                        .slice(-5)
                        .map(b => `${b.speaker}: ${b.text.substring(0, 100)}...`);

                    // Extract decisions (blocks with "Decision" topic or highlighted)
                    const decisions = blocks
                        .filter(b => b.topic === 'Decision' || b.isHighlighted)
                        .slice(-3)
                        .map(b => b.text.substring(0, 150));

                    // Extract action items
                    const actionItems = state.detectedActions
                        .slice(-5)
                        .map(a => a.text);

                    set({
                        liveSummary: {
                            keyPoints: keyPoints.length > 0 ? keyPoints : ['Meeting in progress...'],
                            decisions: decisions.length > 0 ? decisions : [],
                            actionItems: actionItems.length > 0 ? actionItems : [],
                            lastUpdated: Date.now(),
                        }
                    });
                },

                // Collaboration
                addViewer: (viewer) => {
                    set(state => ({
                        activeViewers: state.activeViewers.some(v => v.id === viewer.id)
                            ? state.activeViewers
                            : [...state.activeViewers, viewer]
                    }));
                },

                removeViewer: (viewerId) => {
                    set(state => ({
                        activeViewers: state.activeViewers.filter(v => v.id !== viewerId)
                    }));
                },

                // Voice commands
                toggleVoiceCommands: () => {
                    set(state => ({ isListening: !state.isListening }));
                },

                // Real-time coaching
                analyzeUserSpeaking: () => {
                    const state = get();
                    const userBlocks = state.transcriptBlocks.filter(b =>
                        b.speaker === 'You' || b.speaker.toLowerCase().includes('you')
                    );

                    if (userBlocks.length === 0) return;

                    const recentBlocks = userBlocks.slice(-5);
                    const insights: CoachingInsight[] = [];
                    const now = Date.now();

                    // Analyze tone (aggressive, passive, assertive)
                    const aggressiveWords = ['must', 'have to', 'need to', 'should', 'wrong', 'bad', 'never', 'always'];
                    const passiveWords = ['maybe', 'perhaps', 'might', 'could', 'if possible', 'if you want'];
                    const assertiveWords = ['I believe', 'I think', 'I suggest', 'let\'s', 'we should'];

                    const recentText = recentBlocks.map(b => b.text.toLowerCase()).join(' ');
                    const aggressiveCount = aggressiveWords.filter(w => recentText.includes(w)).length;
                    const passiveCount = passiveWords.filter(w => recentText.includes(w)).length;
                    const assertiveCount = assertiveWords.filter(w => recentText.includes(w)).length;

                    if (aggressiveCount > 2) {
                        insights.push({
                            id: `coaching-${now}-tone`,
                            type: 'tone',
                            severity: 'warning',
                            message: 'Tom pode estar muito direto ou agressivo',
                            suggestion: 'Considere usar linguagem mais colaborativa: "Sugiro que..." em vez de "Você deve..."',
                            timestamp: now
                        });
                    } else if (passiveCount > 3 && assertiveCount === 0) {
                        insights.push({
                            id: `coaching-${now}-tone2`,
                            type: 'tone',
                            severity: 'warning',
                            message: 'Tom pode estar muito passivo',
                            suggestion: 'Seja mais assertivo: "Acredito que..." em vez de "Talvez..."',
                            timestamp: now
                        });
                    } else if (assertiveCount >= 2) {
                        insights.push({
                            id: `coaching-${now}-tone3`,
                            type: 'tone',
                            severity: 'good',
                            message: 'Tom assertivo e colaborativo',
                            timestamp: now
                        });
                    }

                    // Analyze speaking pace (words per minute estimate)
                    const totalWords = recentBlocks.reduce((sum, b) => sum + b.text.split(' ').length, 0);
                    const timeSpan = recentBlocks.length > 1
                        ? recentBlocks[recentBlocks.length - 1].timestamp - recentBlocks[0].timestamp
                        : 30; // Assume 30 seconds if only one block
                    const wordsPerMinute = timeSpan > 0 ? (totalWords / timeSpan) * 60 : 0;

                    if (wordsPerMinute > 180) {
                        insights.push({
                            id: `coaching-${now}-pace`,
                            type: 'pace',
                            severity: 'warning',
                            message: 'Você está falando muito rápido',
                            suggestion: 'Diminua um pouco o ritmo para melhor compreensão',
                            timestamp: now
                        });
                    } else if (wordsPerMinute < 100 && recentBlocks.length > 2) {
                        insights.push({
                            id: `coaching-${now}-pace2`,
                            type: 'pace',
                            severity: 'warning',
                            message: 'Ritmo de fala pode estar muito lento',
                            suggestion: 'Considere acelerar um pouco para manter o engajamento',
                            timestamp: now
                        });
                    }

                    // Analyze question quality
                    const questions = recentBlocks.filter(b => b.text.includes('?'));
                    if (questions.length > 0) {
                        const lastQuestion = questions[questions.length - 1].text;
                        const isOpenEnded = ['como', 'por que', 'o que', 'qual', 'quando', 'onde', 'who', 'what', 'why', 'how', 'when', 'where'].some(w =>
                            lastQuestion.toLowerCase().includes(w)
                        );
                        const isClosed = ['você', 'vocês', 'eles', 'você pode', 'você vai', 'you can', 'you will', 'are you', 'do you'].some(w =>
                            lastQuestion.toLowerCase().includes(w)
                        );

                        if (isClosed && !isOpenEnded) {
                            insights.push({
                                id: `coaching-${now}-question`,
                                type: 'question',
                                severity: 'warning',
                                message: 'Pergunta fechada detectada',
                                suggestion: 'Perguntas abertas geram mais insights. Tente: "Como você vê isso?" em vez de "Você concorda?"',
                                timestamp: now
                            });
                        } else if (isOpenEnded) {
                            insights.push({
                                id: `coaching-${now}-question2`,
                                type: 'question',
                                severity: 'good',
                                message: 'Excelente pergunta aberta',
                                timestamp: now
                            });
                        }
                    }

                    // Check for interruptions (user speaking right after someone else)
                    if (recentBlocks.length > 1) {
                        const allBlocks = state.transcriptBlocks;
                        const userBlock = recentBlocks[recentBlocks.length - 1];
                        const previousBlock = allBlocks.find(b => b.timestamp < userBlock.timestamp && b.speaker !== userBlock.speaker);

                        if (previousBlock && (userBlock.timestamp - previousBlock.timestamp) < 2) {
                            insights.push({
                                id: `coaching-${now}-interruption`,
                                type: 'interruption',
                                severity: 'warning',
                                message: 'Possível interrupção detectada',
                                suggestion: 'Considere esperar a pessoa terminar antes de falar',
                                timestamp: now
                            });
                        }
                    }

                    // Check for long silences from user
                    if (recentBlocks.length > 0) {
                        const lastUserBlock = recentBlocks[recentBlocks.length - 1];
                        const timeSinceLastUserBlock = state.elapsedTime - lastUserBlock.timestamp;

                        if (timeSinceLastUserBlock > 60 && state.elapsedTime > 120) {
                            insights.push({
                                id: `coaching-${now}-silence`,
                                type: 'silence',
                                severity: 'warning',
                                message: 'Você não fala há mais de 1 minuto',
                                suggestion: 'Considere fazer uma pergunta ou dar feedback para manter o engajamento',
                                timestamp: now
                            });
                        }
                    }

                    // Update user speaking blocks
                    set({ userSpeakingBlocks: recentBlocks });

                    // Add insights (limit to 3 most recent)
                    insights.forEach(insight => {
                        get().addCoachingInsight(insight);
                    });
                },

                addCoachingInsight: (insight) => {
                    const newInsight: CoachingInsight = {
                        ...insight,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        coachingInsights: [...state.coachingInsights, newInsight].slice(-10) // Keep last 10
                    }));
                },

                dismissCoachingInsight: (id: string) => {
                    set(state => ({
                        coachingInsights: state.coachingInsights.filter(i => i.id !== id)
                    }));
                },

                // Emotion & engagement
                updateEmotionState: (participantId: string, emotion: EmotionState['emotion'], confidence: number) => {
                    set(state => {
                        const existing = state.emotionStates.find(e => e.participantId === participantId);
                        const newState: EmotionState = {
                            participantId,
                            emotion,
                            confidence,
                            timestamp: Date.now()
                        };

                        if (existing) {
                            return {
                                emotionStates: state.emotionStates.map(e =>
                                    e.participantId === participantId ? newState : e
                                )
                            };
                        } else {
                            return {
                                emotionStates: [...state.emotionStates, newState]
                            };
                        }
                    });
                },

                // Conflict detection
                detectConflicts: () => {
                    const state = get();
                    const recentBlocks = state.transcriptBlocks.slice(-10);

                    if (recentBlocks.length < 3) return;

                    // Look for disagreement patterns
                    const disagreementIndicators = ['não', 'discordo', 'não concordo', 'mas', 'porém', 'no', 'disagree', 'but', 'however', 'actually'];
                    const agreementIndicators = ['sim', 'concordo', 'exato', 'correto', 'yes', 'agree', 'exactly', 'correct', 'right'];

                    const recentText = recentBlocks.map(b => b.text.toLowerCase()).join(' ');
                    const disagreementCount = disagreementIndicators.filter(ind => recentText.includes(ind)).length;
                    const agreementCount = agreementIndicators.filter(ind => recentText.includes(ind)).length;

                    // Check for negative sentiment spikes
                    const negativeBlocks = recentBlocks.filter(b => b.sentiment === 'negative');
                    const negativeRatio = negativeBlocks.length / recentBlocks.length;

                    if ((disagreementCount > agreementCount && disagreementCount > 2) || negativeRatio > 0.5) {
                        const participants = Array.from(new Set(recentBlocks.map(b => b.speaker)));
                        if (participants.length >= 2) {
                            const existingConflict = state.conflicts.find(c =>
                                c.participants.every(p => participants.includes(p)) &&
                                (Date.now() - c.timestamp) < 30000 // Within last 30 seconds
                            );

                            if (!existingConflict) {
                                get().addConflict({
                                    participants,
                                    severity: negativeRatio > 0.7 ? 'high' : disagreementCount > 3 ? 'medium' : 'low',
                                    summary: 'Desacordo ou tensão detectada na conversa',
                                    resolutionSuggestions: [
                                        'Reconheça o ponto de vista: "Entendo sua preocupação..."',
                                        'Busque pontos em comum: "Ambos queremos..."',
                                        'Faça uma pergunta de esclarecimento: "Pode me ajudar a entender melhor?"',
                                        'Sugira uma pausa: "Podemos fazer uma pausa e retomar este ponto?"'
                                    ],
                                    timestamp: Date.now()
                                });
                            }
                        }
                    }
                },

                addConflict: (conflict) => {
                    const newConflict: ConflictDetection = {
                        ...conflict,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        conflicts: [...state.conflicts, newConflict].slice(-5) // Keep last 5
                    }));
                },

                // Predictive questions
                generatePredictiveQuestions: () => {
                    const state = get();
                    const recentBlocks = state.transcriptBlocks.slice(-10);
                    const threadContext = 'Project Context'; // TODO: Get from workspace store

                    if (recentBlocks.length === 0) return;

                    const questions: PredictiveQuestion[] = [];
                    const now = Date.now();
                    const recentText = recentBlocks.map(b => b.text).join(' ').toLowerCase();

                    // Risk-based questions
                    if (recentText.includes('risco') || recentText.includes('risk') || recentText.includes('problema') || recentText.includes('problem')) {
                        questions.push({
                            id: `pq-${now}-1`,
                            question: 'Quais são os principais riscos que precisamos considerar? Como vamos mitigá-los?',
                            context: 'Riscos foram mencionados mas não foram detalhados',
                            priority: 'high',
                            category: 'risk',
                            timestamp: now
                        });
                    }

                    // Budget questions
                    if ((recentText.includes('orçamento') || recentText.includes('budget')) && !recentText.includes('confirm')) {
                        questions.push({
                            id: `pq-${now}-2`,
                            question: 'Podemos confirmar o status do orçamento? Há alguma preocupação que precisamos abordar?',
                            context: 'Orçamento foi mencionado mas não foi confirmado',
                            priority: 'high',
                            category: 'clarification',
                            timestamp: now
                        });
                    }

                    // Timeline questions
                    if ((recentText.includes('prazo') || recentText.includes('deadline') || recentText.includes('timeline')) && !recentText.includes('confirm')) {
                        questions.push({
                            id: `pq-${now}-3`,
                            question: 'O cronograma ainda está viável? Precisamos ajustar algum prazo?',
                            context: 'Prazo foi mencionado mas não foi confirmado',
                            priority: 'high',
                            category: 'clarification',
                            timestamp: now
                        });
                    }

                    // Follow-up questions based on statements
                    const statements = recentBlocks.filter(b => !b.text.includes('?') && b.speaker !== 'You');
                    if (statements.length > 0) {
                        const lastStatement = statements[statements.length - 1];
                        questions.push({
                            id: `pq-${now}-4`,
                            question: `Pode me ajudar a entender melhor: "${lastStatement.text.substring(0, 50)}..."?`,
                            context: 'Seguimento natural da última declaração',
                            priority: 'medium',
                            category: 'follow-up',
                            timestamp: now
                        });
                    }

                    // Strategic questions based on thread context
                    if (threadContext) {
                        const contextLower = threadContext.toLowerCase();
                        if (contextLower.includes('objetivo') || contextLower.includes('goal')) {
                            questions.push({
                                id: `pq-${now}-5`,
                                question: 'Como este tópico se alinha com nossos objetivos principais?',
                                context: 'Objetivos foram mencionados na preparação',
                                priority: 'medium',
                                category: 'strategic',
                                timestamp: now
                            });
                        }
                    }

                    // Add questions (limit to 5)
                    questions.slice(0, 5).forEach(q => {
                        get().addPredictiveQuestion(q);
                    });
                },

                addPredictiveQuestion: (question) => {
                    const newQuestion: PredictiveQuestion = {
                        ...question,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        predictiveQuestions: [...state.predictiveQuestions, newQuestion].slice(-8) // Keep last 8
                    }));
                },

                // Layout
                setLayoutMode: (mode) => {
                    set({ layoutMode: mode });
                },

                togglePanelFocus: (panelId: string) => {
                    set(state => {
                        const isFocused = state.focusedPanels.includes(panelId);
                        return {
                            focusedPanels: isFocused
                                ? state.focusedPanels.filter(id => id !== panelId)
                                : [...state.focusedPanels, panelId]
                        };
                    });
                },

                // Flow prediction
                // Flow prediction
                predictNextTopics: async () => {
                    const state = get();
                    const sessionId = state.sessionId;
                    const blocks = state.transcriptBlocks;
                    if (!sessionId || blocks.length === 0) return;

                    // Get recent transcript text
                    const recentText = blocks.slice(-20).map(b => b.text).join(' ');

                    try {
                        const response = await api.post('/intelligence/flow-prediction', {
                            session_id: sessionId,
                            current_transcript: recentText
                        });

                        const predictions: FlowPrediction[] = response.data;
                        set({ flowPredictions: predictions });
                    } catch (error) {
                        console.error("Failed to predict flow:", error);
                    }
                },

                addFlowPrediction: (prediction) => {
                    const newPrediction: FlowPrediction = {
                        ...prediction,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        flowPredictions: [...state.flowPredictions, newPrediction].slice(-5) // Keep last 5
                    }));
                },

                // Smart highlighting
                createHighlightGroup: (group) => {
                    const newGroup: HighlightGroup = {
                        ...group,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                    };
                    set(state => ({
                        highlightGroups: [...state.highlightGroups, newGroup]
                    }));
                },

                addBlockToHighlightGroup: (groupId: string, blockId: string) => {
                    set(state => ({
                        highlightGroups: state.highlightGroups.map(g =>
                            g.id === groupId
                                ? { ...g, blockIds: [...g.blockIds, blockId] }
                                : g
                        )
                    }));
                },

                autoGroupHighlights: () => {
                    const state = get();
                    const highlightedBlocks = state.transcriptBlocks.filter(b => b.isHighlighted);

                    if (highlightedBlocks.length === 0) return;

                    // Group by category based on content
                    const groups = new Map<string, string[]>();

                    highlightedBlocks.forEach(block => {
                        const text = block.text.toLowerCase();
                        let category: HighlightGroup['category'] = 'other';

                        if (text.includes('decisão') || text.includes('decidir') || text.includes('decision') || text.includes('decide')) {
                            category = 'decision';
                        } else if (text.includes('fazer') || text.includes('vou') || text.includes('action') || text.includes('task')) {
                            category = 'action';
                        } else if (text.includes('risco') || text.includes('problema') || text.includes('risk') || text.includes('problem')) {
                            category = 'risk';
                        } else if (text.includes('insight') || text.includes('importante') || text.includes('important')) {
                            category = 'insight';
                        } else if (text.includes('?') || text.includes('pergunta') || text.includes('question')) {
                            category = 'question';
                        }

                        const groupKey = category;
                        if (!groups.has(groupKey)) {
                            groups.set(groupKey, []);
                        }
                        groups.get(groupKey)!.push(block.id);
                    });

                    // Create groups
                    groups.forEach((blockIds, category) => {
                        const existingGroup = state.highlightGroups.find(g =>
                            g.category === category &&
                            g.blockIds.some(id => blockIds.includes(id))
                        );

                        if (!existingGroup && blockIds.length > 0) {
                            get().createHighlightGroup({
                                name: `${category.charAt(0).toUpperCase() + category.slice(1)} Highlights`,
                                blockIds,
                                category: category as HighlightGroup['category'],
                                createdAt: Date.now()
                            });
                        }
                    });
                },

                // Notifications
                addNotification: (notification) => {
                    const newNotification: Notification = {
                        ...notification,
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                        read: false,
                    };
                    set(state => ({
                        notifications: [newNotification, ...state.notifications].slice(0, 50) // Keep last 50
                    }));
                },

                markNotificationAsRead: (id: string) => {
                    set(state => ({
                        notifications: state.notifications.map(n =>
                            n.id === id ? { ...n, read: true } : n
                        )
                    }));
                },

                dismissNotification: (id: string) => {
                    set(state => ({
                        notifications: state.notifications.filter(n => n.id !== id)
                    }));
                },

                clearAllNotifications: () => {
                    set({ notifications: [] });
                },

                // Meeting quality score
                calculateMeetingQualityScore: () => {
                    const state = get();
                    const blocks = state.transcriptBlocks;
                    const participants = state.participants;

                    if (blocks.length === 0) return;

                    // Calculate engagement (based on participation and interaction)
                    const uniqueSpeakers = new Set(blocks.map(b => b.speaker));
                    const participationScore = Math.min(100, (uniqueSpeakers.size / Math.max(1, participants.length)) * 100);

                    // Calculate clarity (based on sentiment and question/answer ratio)
                    const positiveBlocks = blocks.filter(b => b.sentiment === 'positive').length;
                    const totalBlocks = blocks.length;
                    const clarityScore = totalBlocks > 0 ? (positiveBlocks / totalBlocks) * 100 : 50;

                    // Calculate efficiency (based on time vs content)
                    const avgWordsPerBlock = blocks.reduce((sum, b) => sum + b.text.split(' ').length, 0) / blocks.length;
                    const efficiencyScore = Math.min(100, (avgWordsPerBlock / 20) * 100); // Target: 20 words per block

                    // Calculate participation balance
                    const speakingTimes = participants.map(p => p.totalSpeakingTime || 0);
                    const maxSpeakingTime = Math.max(...speakingTimes, 1);
                    const minSpeakingTime = Math.min(...speakingTimes.filter(t => t > 0), maxSpeakingTime);
                    const balanceScore = speakingTimes.length > 1
                        ? (minSpeakingTime / maxSpeakingTime) * 100
                        : 50;

                    // Calculate decision velocity (decisions per minute)
                    const decisionKeywords = ['decisão', 'decidir', 'decidimos', 'decision', 'decide', 'decided'];
                    const decisionBlocks = blocks.filter(b =>
                        decisionKeywords.some(kw => b.text.toLowerCase().includes(kw))
                    );
                    const meetingDurationMinutes = state.elapsedTime / 60;
                    const decisionVelocity = meetingDurationMinutes > 0
                        ? Math.min(100, (decisionBlocks.length / meetingDurationMinutes) * 10)
                        : 0;

                    // Overall score (weighted average)
                    const overall = (
                        participationScore * 0.2 +
                        clarityScore * 0.25 +
                        efficiencyScore * 0.15 +
                        balanceScore * 0.2 +
                        decisionVelocity * 0.2
                    );

                    set({
                        meetingQualityScore: {
                            overall: Math.round(overall),
                            engagement: Math.round(participationScore),
                            clarity: Math.round(clarityScore),
                            efficiency: Math.round(efficiencyScore),
                            participation: Math.round(balanceScore),
                            decisionVelocity: Math.round(decisionVelocity),
                            lastUpdated: Date.now()
                        }
                    });
                },

                // AI Co-Pilot Auto Actions
                enableAutoActions: () => {
                    set({ autoActionsEnabled: true });
                },

                disableAutoActions: () => {
                    set({ autoActionsEnabled: false });
                },

                generateAutoActions: () => {
                    const state = get();
                    if (!state.autoActionsEnabled) return;

                    const actions: AutoAction[] = [];
                    const now = Date.now();

                    // Detect actions that need to be created
                    const unconfirmedActions = state.detectedActions.filter(a => !a.confirmed);
                    unconfirmedActions.forEach(action => {
                        actions.push({
                            id: `auto-${now}-${action.id}`,
                            type: 'create_task',
                            description: `Criar task: "${action.text}"`,
                            data: { actionId: action.id, text: action.text },
                            status: 'pending',
                            timestamp: now,
                            preview: `Task será criada com título: "${action.text}"`
                        });
                    });

                    // Detect if follow-up email should be sent
                    if (state.transcriptBlocks.length > 20 && state.elapsedTime > 1800) {
                        actions.push({
                            id: `auto-${now}-email`,
                            type: 'send_email',
                            description: 'Enviar email de follow-up após reunião',
                            data: {
                                recipients: state.participants.map(p => p.name || p.speakerId),
                                subject: `Follow-up: Reunião ${new Date().toLocaleDateString()}`
                            },
                            status: 'pending',
                            timestamp: now,
                            preview: `Email será enviado para ${state.participants.length} participantes`
                        });
                    }

                    // Detect if follow-up meeting should be scheduled
                    const followUpKeywords = ['seguir', 'follow-up', 'próxima reunião', 'next meeting'];
                    const hasFollowUp = state.transcriptBlocks.some(b =>
                        followUpKeywords.some(kw => b.text.toLowerCase().includes(kw))
                    );
                    if (hasFollowUp) {
                        actions.push({
                            id: `auto-${now}-schedule`,
                            type: 'schedule_followup',
                            description: 'Agendar reunião de follow-up',
                            data: { suggestedDate: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // 7 days
                            status: 'pending',
                            timestamp: now,
                            preview: 'Reunião será agendada para daqui a 7 dias'
                        });
                    }

                    // Add actions
                    actions.forEach(action => {
                        get().addAutoAction(action);
                    });
                },

                addAutoAction: (action: AutoAction) => {
                    set(state => ({
                        autoActions: [...state.autoActions, action].slice(-20) // Keep last 20
                    }));
                },

                approveAutoAction: (actionId: string) => {
                    set(state => ({
                        autoActions: state.autoActions.map(a =>
                            a.id === actionId ? { ...a, status: 'approved' } : a
                        )
                    }));
                    // Auto-execute if approved
                    get().executeAutoAction(actionId);
                },

                rejectAutoAction: (actionId: string) => {
                    set(state => ({
                        autoActions: state.autoActions.map(a =>
                            a.id === actionId ? { ...a, status: 'rejected' } : a
                        )
                    }));
                },

                executeAutoAction: (actionId: string) => {
                    const state = get();
                    const action = state.autoActions.find(a => a.id === actionId);
                    if (!action || action.status !== 'approved') return;

                    // TODO: Actually execute the action (API call)
                    // For now, just mark as executed
                    set(state => ({
                        autoActions: state.autoActions.map(a =>
                            a.id === actionId ? { ...a, status: 'executed' } : a
                        )
                    }));
                },

                // Cross-Meeting Intelligence
                analyzeCrossMeetingPatterns: async () => {
                    try {
                        const response = await api.get('/intelligence/patterns');
                        set({ crossMeetingPatterns: response.data });
                    } catch (error) {
                        console.error("Failed to analyze patterns:", error);
                    }
                },

                detectContradictions: () => {
                    // TODO: Detect contradictions across meetings
                    const contradictions: CrossMeetingPattern[] = [];
                    set(state => ({
                        crossMeetingPatterns: [...state.crossMeetingPatterns, ...contradictions].slice(-10)
                    }));
                },

                analyzeTrends: () => {
                    // TODO: Analyze trends across meetings
                },

                updateRelationshipInsights: () => {
                    const state = get();
                    const participants = state.participants;
                    const blocks = state.transcriptBlocks;

                    if (participants.length < 2) return;

                    const insights: RelationshipInsight[] = [];

                    // Analyze interactions between participants
                    for (let i = 0; i < participants.length; i++) {
                        for (let j = i + 1; j < participants.length; j++) {
                            const p1 = participants[i];
                            const p2 = participants[j];

                            // Count interactions (blocks where they speak close to each other)
                            const p1Blocks = blocks.filter(b => b.speakerId === p1.speakerId);
                            const p2Blocks = blocks.filter(b => b.speakerId === p2.speakerId);

                            let interactions = 0;
                            p1Blocks.forEach(b1 => {
                                p2Blocks.forEach(b2 => {
                                    if (Math.abs(b1.timestamp - b2.timestamp) < 5) {
                                        interactions++;
                                    }
                                });
                            });

                            if (interactions > 0) {
                                // Determine relationship type
                                const disagreements = blocks.filter(b =>
                                    (b.speakerId === p1.speakerId || b.speakerId === p2.speakerId) &&
                                    b.sentiment === 'negative'
                                ).length;

                                const relationshipType = disagreements > interactions * 0.3
                                    ? 'conflict'
                                    : interactions > 10
                                        ? 'collaborative'
                                        : 'neutral';

                                insights.push({
                                    participant1: p1.name || p1.speakerId,
                                    participant2: p2.name || p2.speakerId,
                                    relationshipType,
                                    strength: Math.min(100, interactions * 10),
                                    interactions,
                                    lastInteraction: Date.now(),
                                    patterns: relationshipType === 'conflict' ? ['Frequent disagreements'] : ['Good collaboration']
                                });
                            }
                        }
                    }

                    set({ relationshipInsights: insights });
                },

                // Predictive Preparation
                generatePrepDocument: async (sessionId: string) => {
                    const state = get();
                    const participants = state.participants;

                    try {
                        const response = await api.post('/intelligence/prep-doc', {
                            session_id: sessionId,
                            participants: participants.map(p => p.name || p.speakerId || 'Unknown')
                        });

                        const docData = response.data;

                        const prepDoc: PrepDocument = {
                            id: `prep-${Date.now()}`,
                            sessionId,
                            participantInsights: docData.participantInsights || [],
                            likelyTopics: docData.likelyTopics || [],
                            suggestedQuestions: docData.suggestedQuestions || [],
                            risks: docData.risks || [],
                            context: docData.context || 'Contexto gerado por IA.',
                            generatedAt: Date.now()
                        };

                        set(state => ({
                            prepDocuments: [...state.prepDocuments, prepDoc].slice(-10)
                        }));
                    } catch (error) {
                        console.error("Failed to generate prep doc:", error);
                    }
                },

                getParticipantInsights: (participantId: string) => {
                    const state = get();
                    const participant = state.participants.find(p => p.speakerId === participantId);
                    if (!participant) return [];

                    return [
                        `Fala ${participant.totalSpeakingTime || 0}% do tempo`,
                        `Contribuiu ${participant.contributionCount || 0} vezes`,
                        `Engajamento: ${participant.engagementScore || 50}%`
                    ];
                },

                loadTranscripts: async (sessionId: string) => {
                    try {
                        // Using generic api.get rather than workspaceApi specific wrapper safely
                        // The endpoint returns { id, text, speaker, timestamp, ... }
                        const res = await api.get(`/sessions/${sessionId}/transcripts`);
                        const data = res.data;

                        if (data && Array.isArray(data)) {
                            const blocks: TranscriptBlock[] = data.map((t: any) => ({
                                id: t.id || Date.now().toString() + Math.random().toString(),
                                speaker: t.speaker || 'Unknown',
                                speakerId: t.speaker_id,
                                text: t.text,
                                timestamp: t.timestamp || 0,
                                createdAt: t.created_at || new Date().toISOString(),
                                isFinal: t.is_final,
                                sentiment: 'neutral' // Default
                            }));
                            set({ transcriptBlocks: blocks });
                        }
                    } catch (error) {
                        console.error("Failed to load transcripts:", error);
                    }
                }
            };
        },
        {
            name: 'meeting-storage',
            partialize: (state) => ({
                sessionId: state.sessionId,
                transcriptBlocks: state.transcriptBlocks,
                participants: state.participants,
                selectedSystemAudioDevice: state.selectedSystemAudioDevice,
                selectedMicrophoneDevice: state.selectedMicrophoneDevice,
                startTime: state.startTime,
                elapsedTime: state.elapsedTime,
                isRecording: state.isRecording
            })
        }
    )
);

