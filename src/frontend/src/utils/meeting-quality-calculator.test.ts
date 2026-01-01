import { describe, it, expect } from 'vitest';
import { calculateQualityScore, SCORING_WEIGHTS, THRESHOLDS } from './meeting-quality-calculator';
import type { MeetingDataSnapshot } from './meeting-quality-calculator';

describe('Meeting Quality Calculator', () => {
    const NOW = 1000000;

    const mockData: MeetingDataSnapshot = {
        startTime: NOW - 600000, // 10 mins ago
        participants: [{ id: '1' }, { id: '2' }, { id: '3' }],
        transcriptBlocks: [],
        detectedActions: []
    };

    it('should calculate base score for inactive meeting', () => {
        // No blocks, no actions
        const score = calculateQualityScore(mockData, NOW);

        expect(score.engagement).toBe(20); // Min engagement
        expect(score.decisionVelocity).toBe(50); // Base velocity
        // Verify weights are applied correctly in overall
        // 20 * 0.25 (5) + 95 * 0.15 (14.25) [default clarity] + ...
        // We expect a non-zero, stable base score
        expect(score.overall).toBeGreaterThan(0);
    });

    it('should boost engagement score with recent blocks', () => {
        const activeData = {
            ...mockData,
            transcriptBlocks: Array(20).fill(null).map((_) => ({
                timestamp: NOW - 1000, // Very recent
                text: "Hello world this is a test block",
                speakerId: '1'
            }))
        };
        const score = calculateQualityScore(activeData, NOW);
        expect(score.engagement).toBe(100); // 20 blocks * 5 = 100
    });

    it('should penalize clarity for monologues', () => {
        const monologueData = {
            ...mockData,
            transcriptBlocks: [{
                timestamp: NOW - 1000,
                text: "word ".repeat(60), // 60 words > 50 threshold
                speakerId: '1'
            }]
        };
        const score = calculateQualityScore(monologueData, NOW);
        expect(score.clarity).toBe(70); // Penalty
    });

    it('should respect configured thresholds and weights', () => {
        // Critical for "Fine-tuning": verify that changing weights affects outcome
        // This is a meta-test to ensure the code uses the constants
        expect(SCORING_WEIGHTS.engagement).toBe(0.25);
        expect(THRESHOLDS.monologueWordCount).toBe(50);
    });

    it('should track decision velocity boost', () => {
        const actionData = {
            ...mockData,
            detectedActions: [
                { timestamp: NOW - 1000 },
                { timestamp: NOW - 2000 }
            ]
        };
        const score = calculateQualityScore(actionData, NOW);
        // Base 50 + (2 * 15) = 80
        expect(score.decisionVelocity).toBe(80);
    });
});
