
import { describe, it, expect } from 'vitest';
import { guidanceRules } from '../guidanceRules';
import type { GuidanceContext } from '@/types/guidance';

// Mock minimal context helper
const createMockContext = (overrides: Partial<GuidanceContext> = {}): GuidanceContext => ({
    transcriptBlocks: [],
    detectedActions: [],
    recentActions: [],
    risks: [],
    clarifications: [],
    participants: [],
    activeRelationshipInsights: [],
    meetingQuality: null,
    lastDecisionTimestamp: 0,
    messages: [],
    selectedThreadId: null,
    recentText: '',
    recentSentiment: [],
    threadContext: '',
    now: Date.now(),
    ...overrides
});

describe('Guidance Rules Engine', () => {

    it('should detect Budget discussions based on thread context', () => {
        const rule = guidanceRules.find(r => r.id === 'check-budget');
        expect(rule).toBeDefined();

        // Scenario: Mentioned in thread, NOT in recent text -> Trigger
        const contextTrigger = createMockContext({
            threadContext: 'Precisamos discutir o budget do projeto.',
            recentText: 'Bom dia a todos, vamos começar.'
        });
        expect(rule!.condition(contextTrigger)).toBe(true);

        // Scenario: Mentioned in thread AND recently -> No Trigger
        const contextNoTrigger = createMockContext({
            threadContext: 'Precisamos discutir o budget.',
            recentText: 'O budget já está aprovado.'
        });
        expect(rule!.condition(contextNoTrigger)).toBe(false);
    });

    it('should detect Negative Sentiment spike', () => {
        const rule = guidanceRules.find(r => r.id === 'check-sentiment');

        const contextTrigger = createMockContext({
            transcriptBlocks: [
                { id: '1', text: 'Bad', speaker: 'A', timestamp: 1, sentiment: 'negative', isFinal: true, updatedAt: 1 },
                { id: '2', text: 'Worse', speaker: 'B', timestamp: 2, sentiment: 'negative', isFinal: true, updatedAt: 2 },
                { id: '3', text: 'Terrible', speaker: 'A', timestamp: 3, sentiment: 'negative', isFinal: true, updatedAt: 3 },
                { id: '4', text: 'Ok', speaker: 'C', timestamp: 4, sentiment: 'neutral', isFinal: true, updatedAt: 4 }
            ],
            recentSentiment: ['negative', 'negative', 'negative', 'neutral']
        });

        expect(rule!.condition(contextTrigger)).toBe(true);
    });

    it('should suggest Action Confirmation when action is unconfirmed', () => {
        const rule = guidanceRules.find(r => r.id === 'check-actions');

        const contextTrigger = createMockContext({
            detectedActions: [
                { id: '1', text: 'Send email', assignee: 'John', due: 'Tomorrow', confirmed: false }
            ]
        });
        expect(rule!.condition(contextTrigger)).toBe(true);

        const contextNoTrigger = createMockContext({
            detectedActions: [
                { id: '1', text: 'Send email', assignee: 'John', due: 'Tomorrow', confirmed: true }
            ]
        });
        expect(rule!.condition(contextNoTrigger)).toBe(false);
    });
});
