
import type { MeetingQualityScore, TimestampMs } from "@/types/slices/intelligence";
import { toBrand } from "@/types/slices/intelligence";

// --- Configuration ---
export const SCORING_WEIGHTS = {
    engagement: 0.25,
    clarity: 0.15,
    efficiency: 0.20,
    participation: 0.25,
    decisionVelocity: 0.15
};

export const THRESHOLDS = {
    monologueWordCount: 50,
    minWordsPerBlock: 5,
    engagementBlockWindow: 120000, // 2 mins
    decisionWindow: 300000, // 5 mins
};

// --- Types needed for calculation ---
// We define a subsets of the state to make it pure and testable without the full store
export interface MeetingDataSnapshot {
    startTime: number;
    transcriptBlocks: Array<{
        timestamp: number;
        text: string;
        speakerId?: string;
    }>;
    participants: Array<any>; // Just need length or ids
    detectedActions: Array<{
        timestamp: number;
    }>;
}

// --- Pure Calculator ---
export const calculateQualityScore = (data: MeetingDataSnapshot, now: number = Date.now()): MeetingQualityScore => {
    // 1. Engagement: Speaking Density
    const recentBlocks = data.transcriptBlocks.filter(b => b.timestamp > now - THRESHOLDS.engagementBlockWindow);
    // Heuristic: More blocks = more interaction density
    const engagementScore = Math.min(100, Math.max(20, recentBlocks.length * 5));

    // 2. Clarity: Average words per block
    const avgWords = recentBlocks.reduce((acc, b) => acc + b.text.split(' ').length, 0) / (recentBlocks.length || 1);
    let clarityScore = 80;
    if (avgWords < THRESHOLDS.minWordsPerBlock) clarityScore = 60; // Too short/noise
    else if (avgWords > THRESHOLDS.monologueWordCount) clarityScore = 70; // Monologue penalty
    else clarityScore = 95; // Sweet spot

    // 3. Efficiency: Rate of topic changes or new blocks (Flow)
    const blocksPerMin = recentBlocks.length / 2; // window is 2 mins
    const efficiencyScore = Math.min(100, Math.max(30, blocksPerMin * 10));

    // 4. Participation: Unique speakers involved
    const uniqueSpeakers = new Set(recentBlocks.map(b => b.speakerId)).size;
    const totalParticipants = data.participants.length || 1;
    const participationRatio = uniqueSpeakers / Math.max(1, totalParticipants);
    const participationScore = Math.min(100, Math.max(40, participationRatio * 100));

    // 5. Decision Velocity: Detected Actions count
    const recentActions = data.detectedActions.filter(a => a.timestamp > now - THRESHOLDS.decisionWindow);
    const decisionVelocity = Math.min(100, 50 + (recentActions.length * 15));

    // Overall Weighted Average
    const overall = Math.round(
        (engagementScore * SCORING_WEIGHTS.engagement) +
        (clarityScore * SCORING_WEIGHTS.clarity) +
        (efficiencyScore * SCORING_WEIGHTS.efficiency) +
        (participationScore * SCORING_WEIGHTS.participation) +
        (decisionVelocity * SCORING_WEIGHTS.decisionVelocity)
    );

    return {
        overall: Math.max(10, Math.min(100, overall)),
        engagement: Math.round(engagementScore),
        clarity: Math.round(clarityScore),
        efficiency: Math.round(efficiencyScore),
        participation: Math.round(participationScore),
        decisionVelocity: Math.round(decisionVelocity),
        lastUpdated: toBrand<TimestampMs>(now)
    };
};
