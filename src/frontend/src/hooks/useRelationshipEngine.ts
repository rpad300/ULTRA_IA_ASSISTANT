import { useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { RelationshipInsight, TimestampMs, BlockId, ParticipantId } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

// Helper to generate OKLCH colors
const getRelationshipColor = (type: string) => {
    switch (type) {
        case 'collaborative': return 'oklch(0.65 0.18 150)'; // Green
        case 'conflict': return 'oklch(0.6 0.2 20)'; // Red
        case 'influential': return 'oklch(0.6 0.15 250)'; // Blue
        default: return 'oklch(0.7 0.05 200)'; // Neutral/Grey
    }
};

export function useRelationshipEngine() {
    const {
        transcriptBlocks,
        emotionStates,
        setRelationshipInsights,
        participants
    } = useMeetingStore();

    // Refs to track history for trend analysis
    const prevInsightsRef = useRef<RelationshipInsight[]>([]);

    const analyzeRelationships = useCallback(() => {
        if (transcriptBlocks.length < 2) return;

        const relationships = new Map<string, RelationshipInsight>();
        const participantScores = new Map<string, { support: number, challenge: number }>();

        // Initialize participant scores
        participants.forEach(p => {
            participantScores.set(p.name || p.id, { support: 0, challenge: 0 });
        });

        // Sliding window analysis or full history? 
        // For accurate graph, full history is better, but maybe weight recent interactions more.
        // Let's analyze full transcript for the stable graph.

        for (let i = 1; i < transcriptBlocks.length; i++) {
            const curr = transcriptBlocks[i];
            const prev = transcriptBlocks[i - 1];

            if (curr.speaker === prev.speaker) continue;

            const key = [curr.speaker, prev.speaker].sort().join('-');

            // Get or create relationship
            // Get or create relationship
            // We define a local MUTABLE version of the insight to work with before saving
            let insight: any = relationships.get(key) || {
                id: `rel-${key}`,
                timestamp: toBrand<TimestampMs>(curr.timestamp), // Initial timestamp
                confidence: 1.0,
                participant1: toBrand<ParticipantId>(prev.speakerId || prev.speaker), // Fallback if speakerId missing? Assuming speakerId exists on TranscriptBlock now.
                participant2: toBrand<ParticipantId>(curr.speakerId || curr.speaker),
                relationshipType: 'neutral',
                strength: 0,
                interactions: 0,
                influenceMetrics: {
                    supportCount: 0,
                    challengeCount: 0,
                },
                volatility: 0, // Default stable
                lastInteraction: toBrand<TimestampMs>(0),
                patterns: [],
                color: getRelationshipColor('neutral'),
                trend: 'stable'
            };

            // 1. Analyze Interaction Type
            const text = curr.text.toLowerCase();
            const sentiment = curr.sentiment || 'neutral';

            // Heuristics for SOTA Nodding vs Challenge
            const isAgreement = text.includes('agree') || text.includes('yes') || text.includes('exactly') || text.includes('right') || sentiment === 'positive';
            const isDisagreement = text.includes('but') || text.includes('disagree') || text.includes('however') || text.includes('no') || sentiment === 'negative';

            // Cross-reference with Emotion
            const currEmotion = emotionStates.find(e => e.participantId === curr.speakerId || e.participantId === curr.speaker)?.emotion;

            const isStrongConflict = isDisagreement && (currEmotion === 'frustrated' || currEmotion === 'confused');
            const isStrongSupport = isAgreement && (currEmotion === 'happy' || currEmotion === 'engaged');

            insight.interactions++;
            insight.lastInteraction = toBrand<TimestampMs>(curr.timestamp);

            if (isStrongSupport || isAgreement) {
                insight.influenceMetrics.supportCount++;
                // Add pattern if significant
                if (isStrongSupport && insight.patterns.length < 3) { // Limit stored patterns
                    insight.patterns.push({
                        name: "Strong Alignment",
                        description: `${curr.speaker} strongly supported ${prev.speaker}`,
                        evidenceBlockId: toBrand<BlockId>(curr.id),
                        timestamp: toBrand<TimestampMs>(curr.timestamp)
                    });
                }
            } else if (isStrongConflict || isDisagreement) {
                insight.influenceMetrics.challengeCount++;
                if (isStrongConflict && insight.patterns.length < 3) {
                    insight.patterns.push({
                        name: "Tension Spike",
                        description: `${curr.speaker} challenged ${prev.speaker} with emotion`,
                        evidenceBlockId: toBrand<BlockId>(curr.id),
                        timestamp: toBrand<TimestampMs>(curr.timestamp)
                    });
                }
            }

            // Update Map
            relationships.set(key, insight);

            // Update Individual Scores (Political IQ)
            const prevScore = participantScores.get(prev.speaker) || { support: 0, challenge: 0 };
            if (isAgreement) prevScore.support++;
            if (isDisagreement) prevScore.challenge++;
            participantScores.set(prev.speaker, prevScore);
        }

        // Finalize Insights
        const maxInteractions = Math.max(...Array.from(relationships.values()).map(r => r.interactions), 1);
        const insightsArray = Array.from(relationships.values()).map((rawInsight: any) => {

            // Calculate Strength
            rawInsight.strength = Math.round((rawInsight.interactions / maxInteractions) * 100);

            // Determine Type
            if (rawInsight.influenceMetrics.challengeCount > rawInsight.interactions * 0.3) {
                rawInsight.relationshipType = 'conflict';
            } else if (rawInsight.influenceMetrics.supportCount > rawInsight.interactions * 0.5) {
                rawInsight.relationshipType = 'collaborative';
            } else {
                rawInsight.relationshipType = 'neutral';
            }

            // Trend Detection
            const oldInsight = prevInsightsRef.current.find(r =>
                (r.participant1 === rawInsight.participant1 && r.participant2 === rawInsight.participant2) ||
                (r.participant1 === rawInsight.participant2 && r.participant2 === rawInsight.participant1)
            );

            if (oldInsight) {
                rawInsight.trend = rawInsight.strength > oldInsight.strength ? 'increasing' :
                    rawInsight.strength < oldInsight.strength ? 'decreasing' : 'stable';
            }

            // Color
            rawInsight.color = getRelationshipColor(rawInsight.relationshipType);

            return rawInsight as RelationshipInsight;
        });

        // Identification of Key Influencer (Political IQ)
        // Find participant with most 'support' received
        let maxSupport = 0;
        let influencerName = '';
        participantScores.forEach((score, name) => {
            if (score.support > maxSupport) {
                maxSupport = score.support;
                influencerName = name;
            }
        });

        if (influencerName && maxSupport > 2) {
            // Mark relationships with influencer distinctively? 
            // Or just ensure the graph highlights them. 
            // We can mark 'influential' relationship type if one party is the Influencer and the other supports them.
            insightsArray.forEach(ins => {
                if ((ins.participant1 === influencerName || ins.participant2 === influencerName) && ins.relationshipType === 'collaborative') {
                    ins.relationshipType = 'influential';
                    ins.color = getRelationshipColor('influential');
                }
            });
        }

        // Save history
        prevInsightsRef.current = insightsArray;

        // Dispatch
        setRelationshipInsights(insightsArray);

    }, [transcriptBlocks, emotionStates, participants, setRelationshipInsights]);

    // Periodic Update (30s)
    useEffect(() => {
        // Initial run
        analyzeRelationships();

        const interval = setInterval(analyzeRelationships, 30000);
        return () => clearInterval(interval);
    }, [analyzeRelationships]);

    // Also run on significant new data (optional, but requested 30s period so sticking to that mostly, maybe trigger on new blocks debounce?)
    // The prompt explicitly says "Atualização periódica (30s) via store", so the interval is key.
    // However, for responsiveness ("Animated dotted lines", "Real time interactions"), we might want faster updates for visuals.
    // Leaving it at 30s logic update for now to match spec, but the UI can interpolate.
}
