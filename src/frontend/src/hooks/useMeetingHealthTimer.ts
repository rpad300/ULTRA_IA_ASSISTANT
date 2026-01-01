import { useEffect } from 'react';
import { useMeetingStore } from '@/store/meetingStore';

export function useMeetingHealthTimer(intervalMs: number = 20000) {
    useEffect(() => {
        // Initial update on mount
        // Guard: Only calculate if recording
        const state = useMeetingStore.getState();
        if (state.isRecording && !state.isPaused) {
            state.calculateMeetingQualityScore();
        }

        // Set up interval for periodic updates
        const intervalId = setInterval(() => {
            const currentState = useMeetingStore.getState();
            if (currentState.isRecording && !currentState.isPaused) {
                currentState.calculateMeetingQualityScore();
            }
        }, intervalMs);

        // Cleanup on unmount to prevent leaks and double-firing
        return () => {
            clearInterval(intervalId);
        };
    }, [intervalMs]);
}
