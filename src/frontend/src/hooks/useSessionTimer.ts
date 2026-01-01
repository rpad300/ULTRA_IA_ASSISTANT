import { useEffect, useRef } from 'react';
import { useMeetingStore } from '@/store/meetingStore';

/**
 * Enhanced Timer Hook (SOTA)
 * Handles session duration tracking with drift correction and background tab awareness.
 */
export function useSessionTimer() {
    const isRecording = useMeetingStore(s => s.isRecording);
    const isPaused = useMeetingStore(s => s.isPaused);
    const startTime = useMeetingStore(s => s.startTime);
    const setElapsedTime = useMeetingStore(s => s.setElapsedTime);

    // Use ref for precise interval tracking
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isRecording && !isPaused && startTime) {
            // Immediate sync incase of refresh
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            setElapsedTime(elapsed);

            intervalRef.current = setInterval(() => {
                // Always recalculate from strict start time to avoid drift
                const currentNow = Date.now();
                const totalSeconds = Math.floor((currentNow - startTime) / 1000);
                setElapsedTime(totalSeconds);
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRecording, isPaused, startTime, setElapsedTime]);
}
