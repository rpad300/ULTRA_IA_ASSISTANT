import { useState, useEffect, useRef } from 'react';
import { useMeetingStore } from '@/store/meetingStore';

export interface SentimentDataPoint {
    id: string;
    timestamp: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number; // -1 to 1 for generic graphing
    cumulative: number;
    speaker: string;
    text: string;
}

export interface ClimateStats {
    positive: number;
    neutral: number;
    negative: number;
    overall: 'positive' | 'neutral' | 'negative';
    volatility: number;
    trend: SentimentDataPoint[];
    vibe: string;
    criticalMoment: { determined: boolean; type: 'upturn' | 'downturn' | 'stable' };
}

// Helper to determine sentiment score if not present
const getSentimentScore = (sentiment: string): number => {
    switch (sentiment) {
        case 'positive': return 1;
        case 'negative': return -1;
        default: return 0;
    }
};

export function useEmotionalClimate() {
    const { transcriptBlocks, analyzeSentiment } = useMeetingStore();

    // Cache analyzed results to avoid re-processing strings
    // Key: block.id
    const analysisCache = useRef<Map<string, { sentiment: 'positive' | 'negative' | 'neutral', score: number }>>(new Map());
    const lastBlockCount = useRef(0);

    const [climateStats, setClimateStats] = useState<ClimateStats>({
        positive: 0,
        neutral: 0,
        negative: 0,
        overall: 'neutral',
        volatility: 0,
        trend: [],
        vibe: 'Neutral',
        criticalMoment: { determined: false, type: 'stable' }
    });

    useEffect(() => {
        // Optimization: Only run if blocks changed
        if (transcriptBlocks.length === lastBlockCount.current) return;

        // 1. Process new blocks incrementally
        transcriptBlocks.forEach(block => {
            if (!analysisCache.current.has(block.id)) {
                // Use store's sentiment or analyze it locally
                // We assume 'sentiment' might exist on block, if not we analyze
                const sentiment = (block as any).sentiment || analyzeSentiment(block.text);
                const score = getSentimentScore(sentiment);

                analysisCache.current.set(block.id, { sentiment, score });
            }
        });

        lastBlockCount.current = transcriptBlocks.length;

        // 2. Aggregate Data from Cache (Must reconstruct array to maintain order)
        // We iterate transcriptBlocks to ensure correct time order
        const processedData: SentimentDataPoint[] = [];
        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        let cumulativeScore = 0;

        transcriptBlocks.forEach(block => {
            const cached = analysisCache.current.get(block.id);
            if (cached) {
                if (cached.sentiment === 'positive') positiveCount++;
                else if (cached.sentiment === 'negative') negativeCount++;
                else neutralCount++;

                cumulativeScore += cached.score;

                processedData.push({
                    id: block.id,
                    timestamp: block.timestamp,
                    sentiment: cached.sentiment,
                    score: cached.score,
                    cumulative: cumulativeScore,
                    speaker: block.speaker,
                    text: block.text
                });
            }
        });

        // 3. Calculate Derived Metrics
        const total = processedData.length;
        const recentWindow = processedData.slice(-20); // Last 20 blocks for trend/vibe

        // Percentages
        const showPos = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
        const showNeu = total > 0 ? Math.round((neutralCount / total) * 100) : 0;
        const showNeg = total > 0 ? Math.round((negativeCount / total) * 100) : 0;

        // Overall Sentiment
        let overallObs: 'positive' | 'neutral' | 'negative' = 'neutral';
        if (showPos > showNeg && showPos > showNeu) overallObs = 'positive';
        else if (showNeg > showPos && showNeg > showNeu) overallObs = 'negative';

        // Vibe Detection Heuristics
        let vibe = "Awkward Silence";
        if (total > 0) {
            if (overallObs === 'positive') vibe = "Collaborative Harmony";
            if (overallObs === 'negative') vibe = "Tension Detected";
            if (overallObs === 'neutral') vibe = "Balanced Discussion";

            // Refine based on recent window volatility
            // Calculate flips (Pos -> Neg or Neg -> Pos)
            let flips = 0;
            for (let i = 1; i < recentWindow.length; i++) {
                if (recentWindow[i].sentiment !== recentWindow[i - 1].sentiment) flips++;
            }

            if (flips > 5) vibe = "High Volatility";
            if (showPos > 70) vibe = "Peak Optimism";
            if (showNeg > 40) vibe = "Critical Friction";
        }

        // Critical Moment Detection (Shift in last 5 blocks)
        const veryRecent = processedData.slice(-5);
        let criticalType: 'upturn' | 'downturn' | 'stable' = 'stable';
        if (veryRecent.length >= 5) {
            const startScore = veryRecent[0].cumulative;
            const endScore = veryRecent[veryRecent.length - 1].cumulative;
            const delta = endScore - startScore;

            if (delta >= 3) criticalType = 'upturn';
            else if (delta <= -3) criticalType = 'downturn';
        }

        setClimateStats({
            positive: showPos,
            neutral: showNeu,
            negative: showNeg,
            overall: overallObs,
            volatility: 0,
            trend: processedData.slice(-30),
            vibe,
            criticalMoment: { determined: true, type: criticalType }
        });

    }, [transcriptBlocks, analyzeSentiment]);

    return climateStats;
}
