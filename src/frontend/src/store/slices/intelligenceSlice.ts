import type { StateCreator } from 'zustand';
import type { MeetingState } from '../meetingStore';
import type { CrossMeetingPattern } from '@/types/slices/intelligence';

// --- Legacy Intelligence Types (Recovered) ---
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

export interface LiveSummary {
    keyPoints: string[];
    decisions: string[];
    actionItems: string[];
    lastUpdated: number;
}

export interface MeetingHealth {
    engagement: number;
    clarity: number;
    progress: number;
    participation: number;
    overall: number;
}

export interface TopicCluster {
    id: string;
    name: string;
    blocks: string[];
    startTime: number;
    endTime: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    keywords: string[];
    participantCount: number;
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

export interface EmotionState {
    participantId: string;
    emotion: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'engaged' | 'bored';
    confidence: number; // 0-100
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

export interface PredictiveQuestion {
    id: string;
    question: string;
    context: string;
    priority: 'high' | 'medium' | 'low';
    category: 'risk' | 'clarification' | 'follow-up' | 'strategic';
    timestamp: number;
}

export interface CoachingInsight {
    id: string;
    type: 'tone' | 'pace' | 'question' | 'interruption' | 'silence' | 'assertiveness';
    severity: 'good' | 'warning' | 'critical';
    message: string;
    suggestion?: string;
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

export interface HighlightGroup {
    id: string;
    name: string;
    blockIds: string[];
    category: 'decision' | 'action' | 'risk' | 'insight' | 'question' | 'other';
    createdAt: number;
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

export interface IntelligenceSlice {
    // Core Intelligence
    crossMeetingPatterns: CrossMeetingPattern[];
    isAnalyzingPatterns: boolean;

    // Actions & Risks
    detectedActions: DetectedAction[];
    risks: Risk[];
    clarifications: Clarification[];
    autoActions: AutoAction[];
    autoActionsEnabled: boolean;

    // Summary & Health
    liveSummary: LiveSummary | null;
    meetingHealth: MeetingHealth | null;
    meetingQualityScore: MeetingQualityScore | null;

    // Topics
    topicClusters: TopicCluster[];

    // Advanced Insights
    emotionStates: EmotionState[];
    flowPredictions: FlowPrediction[];
    predictiveQuestions: PredictiveQuestion[];
    coachingInsights: CoachingInsight[];
    conflicts: ConflictDetection[];
    relationshipInsights: RelationshipInsight[];
    highlightGroups: HighlightGroup[];

    // Prep
    prepDocuments: PrepDocument[];

    // Actions
    setAnalyzingPatterns: (isAnalyzing: boolean) => void;
    addCrossMeetingPattern: (pattern: CrossMeetingPattern) => void;

    addDetectedAction: (action: Omit<DetectedAction, 'id'>) => void;
    confirmActionAsTask: (actionId: string) => void;
    addRisk: (risk: Omit<Risk, 'id'>) => void;
    addClarification: (clarification: Omit<Clarification, 'id'>) => void;

    updateLiveSummary: (summary?: Partial<LiveSummary>) => void; // Optional arg
    updateMeetingHealth: (health?: Partial<MeetingHealth>) => void; // Optional arg
    calculateMeetingQualityScore: () => void;

    // Legacy / Action
    markCriticalMoment: () => void;

    autoClusterTopics: () => void;
    analyzeSentiment: (text: string) => 'positive' | 'neutral' | 'negative';

    updateEmotionState: (participantId: string, emotion: EmotionState['emotion'], confidence: number) => void;

    predictNextTopics: () => void;
    generatePredictiveQuestions: () => void;
    analyzeUserSpeaking: () => void;
    detectConflicts: () => void;
    updateRelationshipInsights: () => void;

    createHighlightGroup: (group: Omit<HighlightGroup, 'id'>) => void;
    addBlockToHighlightGroup: (groupId: string, blockId: string) => void;
    autoGroupHighlights: () => void;

    generatePrepDocument: (sessionId: string) => void;

    // Auto Actions
    enableAutoActions: () => void;
    disableAutoActions: () => void;
    generateAutoActions: () => void;
    addAutoAction: (action: AutoAction) => void;
    approveAutoAction: (actionId: string) => void;
    rejectAutoAction: (actionId: string) => void;
    executeAutoAction: (actionId: string) => void;

    // Cross Meeting
    analyzeCrossMeetingPatterns: () => void;
    detectContradictions: () => void;
    analyzeTrends: () => void;

    dismissCoachingInsight: (id: string) => void;
}

export const createIntelligenceSlice: StateCreator<MeetingState, [], [], IntelligenceSlice> = (set, _get) => ({
    // Initial State
    crossMeetingPatterns: [],
    isAnalyzingPatterns: false,
    detectedActions: [],
    risks: [],
    clarifications: [],
    autoActions: [],
    autoActionsEnabled: false,
    liveSummary: { keyPoints: [], decisions: [], actionItems: [], lastUpdated: 0 }, // Init with empty for safety
    meetingHealth: null,
    meetingQualityScore: null,
    topicClusters: [],
    emotionStates: [],
    flowPredictions: [],
    predictiveQuestions: [],
    coachingInsights: [],
    conflicts: [],
    relationshipInsights: [],
    highlightGroups: [],
    prepDocuments: [],

    // Methods
    setAnalyzingPatterns: (isAnalyzing) => set({ isAnalyzingPatterns: isAnalyzing }),

    addCrossMeetingPattern: (pattern) => {
        set(state => ({
            crossMeetingPatterns: [pattern, ...state.crossMeetingPatterns],
            isAnalyzingPatterns: false
        }));
    },

    addDetectedAction: (action) => set(state => ({
        detectedActions: [...state.detectedActions, { ...action, id: Date.now().toString() }]
    })),

    confirmActionAsTask: (id) => set(state => ({
        detectedActions: state.detectedActions.map(a => a.id === id ? { ...a, confirmed: true } : a)
    })),

    addRisk: (risk) => set(state => ({
        risks: [...state.risks, { ...risk, id: Date.now().toString() }]
    })),

    addClarification: (c) => set(state => ({
        clarifications: [...state.clarifications, { ...c, id: Date.now().toString() }]
    })),

    updateLiveSummary: (summary = {}) => set(state => ({
        liveSummary: { ...(state.liveSummary || { keyPoints: [], decisions: [], actionItems: [], lastUpdated: 0 }), ...summary, lastUpdated: Date.now() }
    })),

    updateMeetingHealth: (health = {}) => set(state => ({
        meetingHealth: { ...(state.meetingHealth || { engagement: 0, clarity: 0, progress: 0, participation: 0, overall: 0 }), ...health }
    })),

    calculateMeetingQualityScore: () => {
        // Mock logic needed for build
        set({ meetingQualityScore: { overall: 85, engagement: 80, clarity: 90, efficiency: 85, participation: 80, decisionVelocity: 85, lastUpdated: Date.now() } });
    },

    markCriticalMoment: () => {
        // Implementation: Add a marker to the transcript or timeline
        // For now, just a console log or mock effect as it wasn't in the original slice plan
        console.log("Critical Moment Marked");

        // Optionally create a highlight group or detected action
        set(state => ({
            detectedActions: [...state.detectedActions, {
                id: Date.now().toString(),
                text: "User marked critical moment",
                timestamp: Date.now(),
                confirmed: true
            }]
        }));
    },

    autoClusterTopics: () => { /* Mock or Async implementation */ },

    analyzeSentiment: (_text) => 'neutral', // Simple fallback with unused var fix

    updateEmotionState: (pid, emotion, confidence) => set(state => {
        const existing = state.emotionStates.find(e => e.participantId === pid);
        if (existing) {
            return { emotionStates: state.emotionStates.map(e => e.participantId === pid ? { ...e, emotion, confidence, timestamp: Date.now() } : e) };
        }
        return { emotionStates: [...state.emotionStates, { participantId: pid, emotion, confidence, timestamp: Date.now() }] };
    }),

    predictNextTopics: () => { },
    generatePredictiveQuestions: () => { },
    analyzeUserSpeaking: () => { },
    detectConflicts: () => { },
    updateRelationshipInsights: () => { },

    createHighlightGroup: (group) => set(state => ({ highlightGroups: [...state.highlightGroups, { ...group, id: Date.now().toString() }] })),
    addBlockToHighlightGroup: (groupId, blockId) => set(state => ({
        highlightGroups: state.highlightGroups.map(g => g.id === groupId ? { ...g, blockIds: [...g.blockIds, blockId] } : g)
    })),
    autoGroupHighlights: () => { },

    generatePrepDocument: (_sessionId) => { },

    enableAutoActions: () => set({ autoActionsEnabled: true }),
    disableAutoActions: () => set({ autoActionsEnabled: false }),
    generateAutoActions: () => { },
    addAutoAction: (action) => set(state => ({ autoActions: [...state.autoActions, action] })),
    approveAutoAction: (id) => set(state => ({ autoActions: state.autoActions.map(a => a.id === id ? { ...a, status: 'approved' } : a) })),
    rejectAutoAction: (id) => set(state => ({ autoActions: state.autoActions.map(a => a.id === id ? { ...a, status: 'rejected' } : a) })),
    executeAutoAction: (id) => set(state => ({ autoActions: state.autoActions.map(a => a.id === id ? { ...a, status: 'executed' } : a) })),

    analyzeCrossMeetingPatterns: () => { },
    detectContradictions: () => { },
    analyzeTrends: () => { },

    dismissCoachingInsight: (id) => set(state => ({ coachingInsights: state.coachingInsights.filter(c => c.id !== id) }))
});
