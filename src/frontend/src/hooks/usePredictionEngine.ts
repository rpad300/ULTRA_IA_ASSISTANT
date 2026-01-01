import { useEffect, useState, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { FlowPrediction } from '@/store/slices/intelligenceSlice';

export function usePredictionEngine() {
    const {
        isRecording,
        predictNextTopics,
        flowPredictions,
        currentTopic,
        setCurrentTopic,
        removePrediction
    } = useMeetingStore();

    const [optimisticTopic, setOptimisticTopic] = useState<string | null>(null);
    const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // Manage local display state to enable smoothing/animations if needed, 
    // but for now we rely on Framer Motion with stable IDs from the store.
    // If store IDs represent the "same" prediction update, animations will work automatically.

    // Prediction Loop
    useEffect(() => {
        if (!isRecording) return;

        // Initial prediction
        predictNextTopics();

        const interval = setInterval(() => {
            predictNextTopics();
        }, 45000); // 45s heartbeat

        return () => clearInterval(interval);
    }, [isRecording, predictNextTopics]);

    // Progressive Countdown for the top prediction
    useEffect(() => {
        if (flowPredictions.length === 0) {
            setTimeLeft(null);
            return;
        }

        const topPrediction = flowPredictions[0];
        // Initialize local countdown based on estimatedTime
        // Note: In a real app, we'd want a target timestamp to avoid drift. 
        // We'll assume estimatedTime is "seconds from now" updated by the store periodically.
        // We can just decremement it locally for smooth UI between store updates.

        setTimeLeft(topPrediction.estimatedTime);

        const timer = setInterval(() => {
            setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [flowPredictions, flowPredictions[0]?.id]); // Reset when top prediction changes

    // Steering Actions
    const handleJumpToTopic = useCallback((prediction: FlowPrediction) => {
        // 1. Optimistic UI
        setOptimisticTopic(prediction.predictedTopic);

        // 2. Dispatch Store Action
        setCurrentTopic(prediction.predictedTopic);

        // 3. Clear optimistic state after a delay (simulating network/transition)
        setTimeout(() => {
            setOptimisticTopic(null);
        }, 1500);

        // Optionally remove the prediction since it's now current
        removePrediction(prediction.id);
    }, [setCurrentTopic, removePrediction]);

    const handleIgnorePrediction = useCallback((id: string) => {
        setIgnoredIds(prev => {
            const newSet = new Set(prev);
            newSet.add(id);
            return newSet;
        });
        removePrediction(id);
    }, [removePrediction]);

    // Filter out ignored locally (although we removed them from store, this adds double safety for rapid re-fetches)
    const visiblePredictions = flowPredictions.filter(p => !ignoredIds.has(p.id));

    return {
        predictions: visiblePredictions,
        currentTopic,
        optimisticTopic,
        topPredictionTimeLeft: timeLeft,
        actions: {
            jumpToTopic: handleJumpToTopic,
            ignorePrediction: handleIgnorePrediction
        }
    };
}
