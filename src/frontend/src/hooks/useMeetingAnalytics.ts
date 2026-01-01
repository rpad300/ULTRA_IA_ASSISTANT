import { useMemo } from 'react';
import { useMeetingStore } from '@/store/meetingStore';

export interface ParticipantStats {
    speaker: string;
    wordCount: number;
    talkTimeSeconds: number;
    percentage: number;
    sentimentScore: number; // -1 to 1
    interruptions: number;
}

export interface MeetingAnalytics {
    statsBySpeaker: ParticipantStats[];
    totalBlocks: number;
    totalWords: number;
    uniqueSpeakers: number;
    totalTalkTime: number;

    // Advanced Social Dynamics
    fairnessScore: number; // 0-100 (100 = perfectly equal)
    monopolyScore: {
        isMonopoly: boolean;
        holder: string | null;
        share: number;
    };
    pacing: {
        wpm: number;
        status: 'Slow' | 'Ideal' | 'Fast';
    };
    engagementPulse: number[]; // Array of last N data points for sparkline
    silenceRatio: number; // 0-1 percentage
    interruptionsCount: number;
}

export function useMeetingAnalytics(): MeetingAnalytics {
    const { transcriptBlocks, elapsedTime } = useMeetingStore();

    const analytics = useMemo(() => {
        if (!transcriptBlocks || transcriptBlocks.length === 0) {
            return {
                statsBySpeaker: [],
                totalBlocks: 0,
                totalWords: 0,
                uniqueSpeakers: 0,
                totalTalkTime: 0,
                fairnessScore: 100,
                monopolyScore: { isMonopoly: false, holder: null, share: 0 },
                pacing: { wpm: 0, status: 'Ideal' as const },
                engagementPulse: [],
                silenceRatio: 0,
                interruptionsCount: 0
            };
        }

        const speakerMap = new Map<string, ParticipantStats>();
        let totalWords = 0;

        // Pulse tracking
        // We'll bucket blocks into 5-minute windows or just last N blocks for the "Pulse"
        // For a sparkline, we want roughly 10-20 data points.
        const pulseBuckets = 20;
        const pulseData = new Array(pulseBuckets).fill(0);
        const blockSizeForPulse = Math.ceil(transcriptBlocks.length / pulseBuckets) || 1;

        let interruptionsCount = 0;

        transcriptBlocks.forEach((block, index) => {
            // Basic Stats
            const wordCount = block.text.trim().split(/\s+/).length;
            totalWords += wordCount;

            // Estimated talk time (assuming avg 150 wpm = 2.5 words/sec)
            const estimatedSeconds = wordCount / 2.5;

            const currentStats = speakerMap.get(block.speaker) || {
                speaker: block.speaker,
                wordCount: 0,
                talkTimeSeconds: 0,
                percentage: 0,
                sentimentScore: 0,
                interruptions: 0
            };

            // Sentiment (assuming block.sentiment is 'positive' | 'neutral' | 'negative' or similar)
            let sentimentVal = 0;
            if (block.sentiment === 'positive') sentimentVal = 1;
            if (block.sentiment === 'negative') sentimentVal = -1;

            // Update Speaker Stats
            currentStats.wordCount += wordCount;
            currentStats.talkTimeSeconds += estimatedSeconds;
            currentStats.sentimentScore += sentimentVal; // We'll average later

            // Interruption Detection
            if (index > 0) {
                const prev = transcriptBlocks[index - 1];
                // If speaker changed and time diff is very small (< 2s)
                if (prev.speaker !== block.speaker && (block.timestamp - prev.timestamp) < 2000) {
                    currentStats.interruptions += 1;
                    interruptionsCount += 1;
                }
            }

            speakerMap.set(block.speaker, currentStats);

            // Pulse Calculation (Energy/Sentiment over time)
            const bucketIdx = Math.min(Math.floor(index / blockSizeForPulse), pulseBuckets - 1);
            // Energy metric: Combination of WPM density and Sentiment
            // Simple proxy: 1 base point + sentiment
            pulseData[bucketIdx] += (1 + sentimentVal * 0.5);
        });

        // Finalize Speaker Stats
        const totalTalkTime = Array.from(speakerMap.values()).reduce((acc, s) => acc + s.talkTimeSeconds, 0);
        const statsBySpeaker = Array.from(speakerMap.values()).map(s => ({
            ...s,
            percentage: totalTalkTime > 0 ? (s.talkTimeSeconds / totalTalkTime) * 100 : 0,
            sentimentScore: s.wordCount > 0 ? s.sentimentScore / (s.wordCount / 10) : 0 // Rough avg
        })).sort((a, b) => b.percentage - a.percentage);

        // 1. Monopoly Score
        const topSpeaker = statsBySpeaker[0];
        const monopolyScore = {
            isMonopoly: topSpeaker ? topSpeaker.percentage > 60 : false,
            holder: topSpeaker ? topSpeaker.speaker : null,
            share: topSpeaker ? topSpeaker.percentage : 0
        };

        // 2. Fairness Score (Inverse of Gini Coefficient-ish or standard deviation)
        const numSpeakers = statsBySpeaker.length;
        let fairnessScore = 100;
        if (numSpeakers > 1) {
            const mean = 100 / numSpeakers;
            const dominancePenalty = statsBySpeaker.reduce((acc, s) => acc + Math.pow(s.percentage - mean, 2), 0);
            const stdDev = Math.sqrt(dominancePenalty / numSpeakers);
            // Max std dev roughly for 2 people (one 100%, one 0%) is 50.
            // Fairness = 100 - (stdDev * 2) roughly.
            fairnessScore = Math.max(0, 100 - (stdDev * 1.5));
        } else if (numSpeakers === 1) {
            fairnessScore = 0; // Only one person talking is not "fair" discussion
        }

        // 3. Pacing
        const minutes = elapsedTime / 60;
        const wpm = minutes > 0.5 ? totalWords / minutes : 0;
        let paceStatus: 'Slow' | 'Ideal' | 'Fast' = 'Ideal';
        if (wpm < 120) paceStatus = 'Slow';
        if (wpm > 180) paceStatus = 'Fast';

        // 4. Silence Ratio
        // If totalTalkTime < elapsedTime, the rest is silence
        // Note: This is an estimation. Real silence detection needs VAD.
        // We'll clamp it to ensure it's logical.
        const silenceSeconds = Math.max(0, elapsedTime - totalTalkTime);
        const silenceRatio = elapsedTime > 0 ? silenceSeconds / elapsedTime : 0;

        return {
            statsBySpeaker,
            totalBlocks: transcriptBlocks.length,
            totalWords,
            uniqueSpeakers: speakerMap.size,
            totalTalkTime,
            fairnessScore,
            monopolyScore,
            pacing: { wpm, status: paceStatus },
            engagementPulse: pulseData.map(d => Math.min(d, 10)), // Normalize/Clamp for sparkline
            silenceRatio,
            interruptionsCount
        };
    }, [transcriptBlocks, elapsedTime]); // Re-calculate when blocks or time changes

    return analytics;
}
