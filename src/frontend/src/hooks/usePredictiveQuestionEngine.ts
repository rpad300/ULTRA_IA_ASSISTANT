import { useEffect, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { useAICoPilotEngine } from '@/hooks/useAICoPilotEngine';
import type { PredictiveQuestion, TimestampMs } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

export function usePredictiveQuestionEngine() {
    const {
        isRecording,
        currentTopic,
        participants,
        liveSummary,
        predictiveQuestions,
        setPredictiveQuestions,
        meetingHealth
    } = useMeetingStore();

    const { sendUserMessage } = useAICoPilotEngine();

    // --- SOTA: Logic Decoupling (Intelligence Hook) ---

    // 1. "Facts Already Discussed" Filter
    // Checks if a potential question's topic has already been covered in the live summary
    const isTopicDiscussed = useCallback((topicKeywords: string[]) => {
        if (!liveSummary) return false;

        const summaryText = [
            ...liveSummary.keyPoints.map(k => k.text),
            ...liveSummary.decisions.map(d => d.text)
        ].join(' ').toLowerCase();

        // If any significant keyword is present in summary, we consider it touched upon
        return topicKeywords.some(keyword => summaryText.includes(keyword.toLowerCase()));
    }, [liveSummary]);

    // 2. Generation Logic (Heuristic "AI")
    const generateQuestions = useCallback(() => {
        if (!isRecording) return;

        const newQuestions: PredictiveQuestion[] = [];
        const timestamp = Date.now();
        const baseTopic = currentTopic || 'General Discussion';

        // Helper to add unique question
        const addQuestion = (q: Omit<PredictiveQuestion, 'id' | 'timestamp'>) => {
            // Simple duplication check based on text
            const exists = predictiveQuestions.some(pq => pq.question === q.question);
            if (!exists) {
                newQuestions.push({
                    id: `pq-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: toBrand<TimestampMs>(timestamp),
                    // confidence calculated in generateQuestions but let's allow override if passed or default
                    lineage: undefined,
                    reasoning: 'Heuristic Generation',

                    ...q // Spread last to allow override
                });
            }
        };

        // --- Heuristic Confidence Calculator ---
        const calculateConfidence = (matches: number) => {
            // Base 70% + 5% per keyword match, capped at 99%
            return Math.min(99, 70 + (matches * 10));
        };

        // --- Heuristic 1: Risk Analysis (High Priority) ---
        if (baseTopic.toLowerCase().includes('budget') || baseTopic.toLowerCase().includes('cost') || baseTopic.toLowerCase().includes('timeline')) {
            if (!isTopicDiscussed(['overrun', 'contingency', 'delay'])) {
                addQuestion({
                    question: `Have we allocated contingency for potential ${baseTopic.toLowerCase()} overruns?`,
                    context: `High financial sensitivity detected in "${baseTopic}"`,
                    priority: 'high',
                    category: 'risk',
                    confidence: calculateConfidence(2), // "cost" + "overrun" relevant
                    isPinned: false
                });
            }
        }

        // --- Heuristic 2: Clarification (Medium Priority) ---
        // Trigger if clarity score is low (simulated or real) or randomly for specific topics
        if ((meetingHealth?.clarity || 100) < 70) {
            addQuestion({
                question: "Can we explicitly define the success metrics for this phase?",
                context: "Low clarity detected in recent segment",
                priority: 'medium',
                category: 'clarification',
                confidence: calculateConfidence(1),
                isPinned: false
            });
        }

        // --- Heuristic 3: Strategic Follow-up (Context Aware) ---
        if (participants.length > 0) {
            const speaker = participants[0]; // Assume first is active or relevant
            if (!isTopicDiscussed(['stakeholder', 'sign-off'])) {
                addQuestion({
                    question: `How does this align with ${speaker.name}'s Q3 OKRs?`,
                    context: `Strategic alignment check for ${speaker.name}`,
                    priority: 'medium',
                    category: 'strategic',
                    confidence: calculateConfidence(3), // High relevance to speaker
                    isPinned: false
                });
            }
        }

        // --- Heuristic 4: Silence/Pacing Breaker (Low/Medium) ---
        if (!isTopicDiscussed(['next steps', 'action items'])) {
            addQuestion({
                question: "Should we capture this as a formal Action Item?",
                context: "Closing potential decision point",
                priority: 'low',
                category: 'follow-up',
                confidence: calculateConfidence(2),
                isPinned: false
            });
        }

        // Update Store with Pin Preservation
        if (newQuestions.length > 0) {
            const pinned = predictiveQuestions.filter(q => q.isPinned);
            const unpinned = predictiveQuestions.filter(q => !q.isPinned);

            // Merge: New stuff + existing unpinned
            const flow = [...newQuestions, ...unpinned];

            // Limit flow to (Max - Pinned) to keep total around 4-5
            const maxFlow = 5 - pinned.length;
            const flowsliced = flow.slice(0, Math.max(0, maxFlow));

            // Result: Pins always at top, followed by new/flow
            setPredictiveQuestions([...pinned, ...flowsliced]);
        }

    }, [isRecording, currentTopic, participants, meetingHealth, predictiveQuestions, isTopicDiscussed, setPredictiveQuestions]);

    // 3. Engine Loop
    useEffect(() => {
        if (!isRecording) return;

        // Run immediately on mount/change if empty
        if (predictiveQuestions.length === 0) {
            generateQuestions();
        }

        const interval = setInterval(generateQuestions, 30000);
        return () => clearInterval(interval);
    }, [isRecording, generateQuestions, predictiveQuestions.length]);


    // 4. Co-Pilot Bridge
    const prepareResponse = useCallback((question: PredictiveQuestion) => {
        // "Injetar no Co-Pilot"
        sendUserMessage(`Draft a response for this potential question: "${question.question}". Context: ${question.context}`);
    }, [sendUserMessage]);

    // 5. Pin Functionality (Enhanced)
    const togglePin = useCallback((id: string) => {
        const question = predictiveQuestions.find(q => q.id === id);
        if (question) {
            const isPinnedNew = !question.isPinned;

            // Create updated list
            const updatedList = predictiveQuestions.map(q =>
                q.id === id ? { ...q, isPinned: isPinnedNew } : q
            );

            // Re-sort: Pinned first, then original order (or priority)
            const pinned = updatedList.filter(q => q.isPinned);
            const unpinned = updatedList.filter(q => !q.isPinned);

            setPredictiveQuestions([...pinned, ...unpinned]);
        }
    }, [predictiveQuestions, setPredictiveQuestions]);

    return {
        predictiveQuestions,
        prepareResponse,
        togglePin,
        isRecording
    };
}
