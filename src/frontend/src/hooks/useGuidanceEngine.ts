
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMeetingStore } from "@/store/meetingStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { GuidanceInsight, GuidanceContext, ExtendedMessage, RuleId } from "@/types/guidance";
import { guidanceRules } from "@/logic/guidanceRules";

// Engine State for Cooldowns & Triggers
interface EngineState {
    lastTriggered: Record<RuleId, number>; // Timestamp
    triggerCount: Record<RuleId, number>;
}

export function useGuidanceEngine() {
    const {
        transcriptBlocks,
        detectedActions,
        risks,
        clarifications,
        participants,
        meetingQualityScore,
        relationshipInsights
    } = useMeetingStore();

    const { selectedThreadId, messages } = useWorkspaceStore();

    const [insights, setInsights] = useState<GuidanceInsight[]>([]);
    const [history, setHistory] = useState<GuidanceInsight[]>([]);
    const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

    // Persistent Engine State (Refs)
    const engineState = useRef<EngineState>({
        lastTriggered: {},
        triggerCount: {}
    });

    const dismissInsight = useCallback((id: string) => {
        setDismissedInsights(prev => new Set([...prev, id]));
        setInsights(current => {
            const insight = current.find(i => i.id === id);
            if (insight) {
                setHistory(prev => [insight, ...prev]);
            }
            return current;
        });
    }, []);

    // 1. Build Deep Context
    const context = useMemo<GuidanceContext | null>(() => {
        if (!transcriptBlocks) return null;

        const now = Date.now();

        // Thread Context
        const threadMessages = selectedThreadId
            ? messages.filter((m) => (m as ExtendedMessage).thread_id === selectedThreadId)
            : [];
        const threadContext = threadMessages.map(m => m.content).join(' ');

        // Recent Window (Last 10 blocks)
        const recentTranscript = transcriptBlocks.slice(-10);

        // Compute NLP Context
        const recentText = recentTranscript.map(b => b.text).join(' ');
        const recentSentiment = recentTranscript.map(b => b.sentiment || 'neutral');

        // Temporal Signals
        // Assuming last decision is the last confirmed action item time or 0
        const lastDecisionTimestamp = detectedActions
            .filter(a => a.confirmed)
            .reduce((max, a) => Math.max(max, a.timestamp), 0);

        return {
            transcriptBlocks, // strictly typed as readonly TranscriptBlock[] in store/types

            // Intelligence Signals
            detectedActions, // strictly typed DetectedAction[]
            recentActions: detectedActions.slice(-5), // Last 5 actions for quick check
            risks,
            clarifications,
            participants,

            // SOTA Enriched Context
            meetingQuality: meetingQualityScore,
            activeRelationshipInsights: relationshipInsights,
            lastDecisionTimestamp,

            messages: threadMessages as ExtendedMessage[],
            selectedThreadId,

            recentText,
            recentSentiment,
            threadContext,
            now
        };
    }, [
        transcriptBlocks,
        detectedActions,
        risks,
        clarifications,
        participants,
        selectedThreadId,
        messages,
        meetingQualityScore,
        relationshipInsights
    ]);

    // 2. Inference Loop (Debounced)
    useEffect(() => {
        if (!context) return;

        const timer = setTimeout(() => {
            const newInsights: GuidanceInsight[] = [];
            const now = Date.now();

            // Execute Rules
            guidanceRules.forEach(rule => {
                // A. Check Max Triggers
                if (rule.maxTriggersPerSession && (engineState.current.triggerCount[rule.id] || 0) >= rule.maxTriggersPerSession) {
                    return;
                }

                // B. Check Cooldown
                const lastRun = engineState.current.lastTriggered[rule.id] || 0;
                const cooldownMs = (rule.cooldownPeriod || 0) * 1000;
                if (now - lastRun < cooldownMs) {
                    return;
                }

                // C. Check Keywords Prefilter (Performance)
                if (rule.matchKeywords && rule.matchKeywords.length > 0) {
                    const hasKeyword = rule.matchKeywords.some(k => context.recentText.toLowerCase().includes(k.toLowerCase()));
                    if (!hasKeyword) return;
                }

                try {
                    // D. Run Inference
                    if (rule.condition(context)) {
                        const result = rule.generate(context);
                        const results = Array.isArray(result) ? result : [result];

                        if (results.length > 0) {
                            // Update Engine State
                            engineState.current.lastTriggered[rule.id] = now;
                            engineState.current.triggerCount[rule.id] = (engineState.current.triggerCount[rule.id] || 0) + 1;
                            newInsights.push(...results);
                        }
                    }
                } catch (e) {
                    console.error(`[GuidanceEngine] Rule ${rule.name} failed:`, e);
                }
            });

            // 3. Strategic Sorting
            // SOTA: Merge manual guidance (Human-in-the-loop overrides AI)
            const { manualGuidance: manualStore } = useMeetingStore.getState();
            const allInsights = [...newInsights, ...(manualStore || [])];

            allInsights.sort((a, b) => {
                const priorityValue = { high: 3, medium: 2, low: 1 };

                // Primary: Priority
                if (a.priority !== b.priority) {
                    return priorityValue[b.priority] - priorityValue[a.priority];
                }

                // Secondary: Impact (Visual Weight)
                if (a.impact !== b.impact) {
                    return priorityValue[b.impact] - priorityValue[a.impact];
                }

                // Tertiary: Recency
                return b.timestamp - a.timestamp;
            });

            // Filter dismissed & Limit to 5 active insights to reduce cognitive load
            setInsights(allInsights.filter(i => !dismissedInsights.has(i.id)).slice(0, 5));

        }, 1000); // 1s Analysis Window

        return () => clearTimeout(timer);
    }, [context, dismissedInsights]); // manualGuidance is pulled from store ref to avoid loops, or add to dep if we want reactiveness

    return {
        insights,
        history,
        dismissInsight,
        dismissedCount: dismissedInsights.size
    };
}
