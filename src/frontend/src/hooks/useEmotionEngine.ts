import { useEffect, useCallback, useRef, useState } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { analyzeSentimentDetailed, detectMeetingMood, detectConflictRisks } from '../utils/emotionEngine';
import type { MeetingMood } from '../utils/emotionEngine';

export function useEmotionEngine() {
    const {
        transcriptBlocks,
        isRecording,
        updateEmotionState,
        participants,
        emotionStates
    } = useMeetingStore();

    const [meetingMood, setMeetingMood] = useState<MeetingMood>({
        state: 'Neutral',
        color: 'oklch(0.6 0.05 240)',
        intensity: 0.3
    });

    const [conflictRisks, setConflictRisks] = useState<string[]>([]);

    // Accessibility: Announcement string for aria-live
    const [a11yAnnouncement, setA11yAnnouncement] = useState<string>('');

    // Trends: Track previous states to calculate trends
    // Map<ParticipantId, { confidence: number, timestamp: number }>
    const previousStatesRef = useRef<Map<string, { confidence: number, timestamp: number }>>(new Map());
    const [trends, setTrends] = useState<Record<string, 'rising' | 'falling' | 'stable'>>({});

    // Ref to track the last processed block index to avoid re-analyzing everything
    const lastProcessedIndexRef = useRef<number>(0);

    // Track previous mood to announce changes
    const prevMoodStateRef = useRef<string>('Neutral');

    const runAnalysis = useCallback(() => {
        // Performance Check: Only run if there are new blocks
        if (transcriptBlocks.length <= lastProcessedIndexRef.current) return;

        lastProcessedIndexRef.current = transcriptBlocks.length;

        // Group recent blocks by participant (last 15 blocks generally)
        const recentBlocks = transcriptBlocks.slice(-15);
        const participantMap = new Map<string, string[]>();

        recentBlocks.forEach(block => {
            const id = block.speakerId || block.speaker;
            const text = block.text;
            if (!participantMap.has(id)) {
                participantMap.set(id, []);
            }
            participantMap.get(id)!.push(text);
        });

        // Store current emotion states as "previous" before updating
        // This is a simplification; ideally we snapshop before the update call.
        // Actually, we can just compare against the `emotionStates` from the store *before* logic if we did it differently,
        // but here we are inside the effect loop. 
        // Better strategy: When we get the NEW result, we compare it with our `previousStatesRef`.

        const newTrends: Record<string, 'rising' | 'falling' | 'stable'> = {};

        participantMap.forEach((texts, participantId) => {
            const fullText = texts.join(' ');
            const analysis = analyzeSentimentDetailed(fullText);

            // Calculate Trend
            const prev = previousStatesRef.current.get(participantId);
            if (prev) {
                const diff = analysis.confidence - prev.confidence;
                if (diff > 5) newTrends[participantId] = 'rising';
                else if (diff < -5) newTrends[participantId] = 'falling';
                else newTrends[participantId] = 'stable';
            } else {
                newTrends[participantId] = 'stable';
            }

            // Update Previous Ref
            previousStatesRef.current.set(participantId, {
                confidence: analysis.confidence,
                timestamp: Date.now()
            });

            // Update store with new state (including reason)
            updateEmotionState(participantId, analysis.emotion, analysis.confidence, analysis.reason);
        });

        setTrends(prev => ({ ...prev, ...newTrends }));

    }, [transcriptBlocks, updateEmotionState]);

    // Derived state calculations (Mood & Conflicts)
    // These run whenever emotionStates change
    useEffect(() => {
        if (emotionStates.length === 0) return;

        // 1. Detect Meeting Mood
        const mood = detectMeetingMood(emotionStates);
        setMeetingMood(mood);

        // A11y Announcement for Mood Change
        if (mood.state !== prevMoodStateRef.current) {
            const msg = `O clima da reunião mudou para ${mood.state}.`;
            setA11yAnnouncement(msg);

            // Clear message after 3s so it doesn't stick
            setTimeout(() => setA11yAnnouncement(''), 3000);

            prevMoodStateRef.current = mood.state;
        }

        // 2. Detect Conflicts
        const risks = detectConflictRisks(emotionStates);
        setConflictRisks(risks);

    }, [emotionStates]);

    // Main Analysis Loop
    useEffect(() => {
        if (!isRecording) return;

        // Initial run
        runAnalysis();

        // Loop
        const interval = setInterval(runAnalysis, 5000); // 5s interval for responsiveness

        return () => clearInterval(interval);
    }, [isRecording, runAnalysis]);

    return {
        emotionStates,
        meetingMood,
        conflictRisks,
        participants,
        trends,
        a11yAnnouncement
    };
}
