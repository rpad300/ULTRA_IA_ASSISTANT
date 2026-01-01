export * from '@/types/slices/intelligence';

import type { MeetingSlice, IntelligenceSlice } from '../types';
import { calculateQualityScore } from '@/utils/meeting-quality-calculator';
import type { ActionId, ParticipantId, TimestampMs, BlockId } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';
import { workspaceApi } from '@/api/client';

export const createIntelligenceSlice: MeetingSlice<IntelligenceSlice> = (set, get) => ({
    // Initial State
    crossMeetingPatterns: [],
    isAnalyzingPatterns: false,
    detectedActions: [],
    risks: [],
    clarifications: [],
    autoActions: [],
    autoActionsEnabled: false,
    liveSummary: { keyPoints: [], decisions: [], actionItems: [], lastUpdated: toBrand<TimestampMs>(0) },
    meetingHealth: null,
    meetingQualityScore: null,
    qualityScoreHistory: [],
    topicClusters: [],
    emotionStates: [],
    flowPredictions: [],
    currentTopic: null,
    predictiveQuestions: [],
    coachingInsights: [],
    conflicts: [],
    relationshipInsights: [],
    highlightGroups: [],
    prepDocuments: [],
    lastInsight: null,
    manualGuidance: [],

    // Methods
    setLastInsight: (insight) => set((state) => { state.lastInsight = insight; }),
    setAnalyzingPatterns: (isAnalyzing) => set((state) => { state.isAnalyzingPatterns = isAnalyzing; }),

    addCrossMeetingPattern: (pattern) => {
        set((state) => {
            // Unshift into mutable array. pattern might have readonly tokens but we assume shape is compatible enough or we cast.
            // Using 'as any' safely here because Immer proxies handle the draft and checking recursiveness on readonly readonly arrays is painful.
            state.crossMeetingPatterns.unshift(pattern as any);
            state.isAnalyzingPatterns = false;
        });
    },

    addDetectedAction: (action) => set((state) => {
        state.detectedActions.push({
            ...action,
            id: Date.now().toString(),
            timestamp: toBrand<TimestampMs>(Date.now())
        });
    }),

    confirmActionAsTask: (id, updates) => set((state) => {
        const action = state.detectedActions.find(a => a.id === id);
        if (action) {
            Object.assign(action, updates);
            action.confirmed = true;
        }
    }),

    rejectDetectedAction: (id) => set((state) => {
        state.detectedActions = state.detectedActions.filter(a => a.id !== id);
    }),

    addRisk: (risk) => set((state) => {
        state.risks.push({ ...risk, id: Date.now().toString(), timestamp: toBrand<TimestampMs>(Date.now()) });
    }),

    addClarification: (c) => set((state) => {
        state.clarifications.push({ ...c, id: Date.now().toString(), timestamp: toBrand<TimestampMs>(Date.now()) });
    }),

    updateLiveSummary: (summary = {}) => set((state) => {
        if (!state.liveSummary) {
            state.liveSummary = { keyPoints: [], decisions: [], actionItems: [], lastUpdated: toBrand<TimestampMs>(0), executiveOverview: { context: '', keyPoints: [], conclusion: '' } };
        }
        Object.assign(state.liveSummary, summary);
        state.liveSummary.lastUpdated = toBrand<TimestampMs>(Date.now());
    }),

    updateLiveSummaryItem: (id, updates) => set((state) => {
        if (!state.liveSummary) return;

        // Cast to any[] or mutable array to bypass readonly check on Immer draft
        const updateInList = (list: any[]) => {
            const item = list.find(i => i.id === id);
            if (item) Object.assign(item, updates);
        };

        updateInList(state.liveSummary.keyPoints as any[]);
        updateInList(state.liveSummary.decisions as any[]);
        updateInList(state.liveSummary.actionItems as any[]);
        state.liveSummary.lastUpdated = toBrand<TimestampMs>(Date.now());
    }),

    updateMeetingHealth: (health = {}) => set((state) => {
        if (!state.meetingHealth) {
            state.meetingHealth = { engagement: 0, clarity: 0, progress: 0, participation: 0, overall: 0 };
        }
        Object.assign(state.meetingHealth, health);
    }),

    calculateMeetingQualityScore: () => {
        const state = get();
        // Create snapshot for pure function
        const snapshot = {
            startTime: state.startTime || 0,
            transcriptBlocks: state.transcriptBlocks.map(b => ({
                timestamp: b.timestamp, // Fixed: use timestamp instead of startTime
                text: b.text,
                speakerId: b.speakerId
            })) || [],
            participants: state.participants || [],
            detectedActions: state.detectedActions.map(a => ({
                timestamp: a.timestamp
            })) || []
        };

        const newScore = calculateQualityScore(snapshot);

        set((state) => {
            state.meetingQualityScore = newScore;
            state.qualityScoreHistory.push({ overall: newScore.overall, timestamp: newScore.lastUpdated });
            if (state.qualityScoreHistory.length > 20) {
                state.qualityScoreHistory.shift();
            }
        });
    },

    markCriticalMoment: () => {
        set((state) => {
            state.detectedActions.push({
                id: Date.now().toString(),
                text: "User marked critical moment",
                timestamp: toBrand<TimestampMs>(Date.now()),
                confidence: 1.0,
                confirmed: true
            });
        });
    },

    autoClusterTopics: async () => {
        console.log("[Intelligence] Auto-clustering triggered on backend.");
    },

    analyzeSentiment: (_text) => {
        return 'neutral';
    },

    updateEmotionState: (pid, emotion, confidence, reason) => set((state) => {
        const participantId = toBrand<ParticipantId>(pid);
        const existing = state.emotionStates.find(e => e.participantId === participantId);
        if (existing) {
            existing.emotion = emotion;
            existing.confidence = confidence;
            existing.reasoning = reason; // Fixed: use reasoning
            existing.timestamp = toBrand<TimestampMs>(Date.now());
        } else {
            state.emotionStates.push({
                participantId,
                emotion,
                confidence,
                reasoning: reason, // Fixed: usage reasoning
                timestamp: toBrand<TimestampMs>(Date.now()),
                id: Date.now().toString()
            });
        }
    }),

    predictNextTopics: () => { },
    setCurrentTopic: (topic) => set((state) => { state.currentTopic = topic; }),
    removePrediction: (id) => set((state) => {
        state.flowPredictions = state.flowPredictions.filter(p => p.id !== id);
    }),
    generatePredictiveQuestions: () => { },
    analyzeUserSpeaking: () => { },
    detectConflicts: () => { },
    updateRelationshipInsights: () => { },

    setPredictiveQuestions: (questions) => set((state) => { state.predictiveQuestions = questions; }),
    updatePredictiveQuestion: (id, updates) => set((state) => {
        const q = state.predictiveQuestions.find(q => q.id === id);
        if (q) Object.assign(q, updates);
    }),

    createHighlightGroup: (group) => set((state) => {
        const bIds = (group.blockIds || []) as any[]; // cast to handle readonly
        state.highlightGroups.push({
            ...group,
            blockIds: bIds,
            id: Date.now().toString(),
            createdAt: toBrand<TimestampMs>(Date.now())
        });
    }),

    addBlockToHighlightGroup: (groupId, blockId) => set((state) => {
        const group = state.highlightGroups.find(g => g.id === groupId);
        const bId = toBrand<BlockId>(blockId);
        if (group) {
            // Immer draft arrays are mutable even if type says readonly?
            // Safest to cast to any to push
            (group.blockIds as any[]).push(bId);
        }
    }),

    autoGroupHighlights: () => { },

    updatePrepDocument: (updates) => set((state) => {
        const lastDoc = state.prepDocuments[state.prepDocuments.length - 1];
        if (lastDoc) {
            Object.assign(lastDoc, updates);
            lastDoc.lastUpdated = toBrand<TimestampMs>(Date.now());
        }
    }),

    generatePrepDocument: async (sessionId) => {
        try {
            const data = await workspaceApi.generateSessionPrep(sessionId);

            set((state) => {
                state.prepDocuments.push({
                    ...data,
                    generatedAt: data.generatedAt ? toBrand<TimestampMs>(data.generatedAt) : toBrand<TimestampMs>(Date.now()),
                    lastUpdated: toBrand<TimestampMs>(Date.now())
                });
            });
        } catch (e) {
            console.error("Failed to generate prep document", e);
        }
    },

    enableAutoActions: () => set((state) => { state.autoActionsEnabled = true; }),
    disableAutoActions: () => set((state) => { state.autoActionsEnabled = false; }),
    generateAutoActions: () => { },
    addAutoAction: (action) => set((state) => {
        // Cast to any to avoid readonly complaints on push if action comes from compatible read-only source
        // AutoAction interface might have readonly array props that confuse assignment to WritableDraft
        state.autoActions.push(action as any);
    }),
    approveAutoAction: (id) => set((state) => {
        const action = state.autoActions.find(a => a.id === toBrand<ActionId>(id));
        if (action) action.status = 'approved';
    }),
    rejectAutoAction: (id) => set((state) => {
        const action = state.autoActions.find(a => a.id === toBrand<ActionId>(id));
        if (action) action.status = 'rejected';
    }),
    executeAutoAction: (id) => set((state) => {
        const action = state.autoActions.find(a => a.id === toBrand<ActionId>(id));
        if (action) action.status = 'executed';
    }),

    analyzeCrossMeetingPatterns: () => { },
    detectContradictions: () => { },
    analyzeTrends: () => { },

    dismissCoachingInsight: (id) => set((state) => {
        state.coachingInsights = state.coachingInsights.filter(c => c.id !== id);
    }),

    addCoachingInsight: (insight) => set((state) => {
        if (state.coachingInsights.length >= 50) {
            state.coachingInsights.shift();
        }
        state.coachingInsights.push(insight);
    }),

    addManualGuidance: (insight) => set((state) => {
        state.manualGuidance.unshift(insight);
    }),

    removeManualGuidance: (id) => set((state) => {
        state.manualGuidance = state.manualGuidance.filter(i => i.id !== id);
    }),

    setRelationshipInsights: (insights) => set((state) => {
        // Cast to any to avoid deep readonly mismatch errors
        state.relationshipInsights = insights as any[];
    }),
});
