import { useState, useCallback, useEffect } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { CrossMeetingPattern, RelatedMeetingExcerpt, TimestampMs } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

// Mock Data Generators for "State of the Art" Demo
// Constants removed as they were unused (mock data hardcoded in useEffect)

// DIPLOMATIC_SCRIPTS removed as they were for mock data

export function useIntelligenceEngine() {
    const {
        addDetectedAction
    } = useMeetingStore();

    // Local state for "Time Travel" modal
    const [historicalContext, setHistoricalContext] = useState<{ isOpen: boolean; snippet: RelatedMeetingExcerpt | null; surroundingBlocks: any[] }>({
        isOpen: false,
        snippet: null,
        surroundingBlocks: []
    });

    // --- Actions ---

    const generateActionPlan = useCallback((pattern: CrossMeetingPattern) => {
        // "Feed-Forward" Logic: Convert Cross-Meeting Insight -> Actionable Task
        const actionText = `Review discrepancy: ${pattern.description}`;

        addDetectedAction({
            text: actionText,
            timestamp: toBrand<TimestampMs>(Date.now()),
            // confirmed: false, // Not in type anymore
            confidence: 1.0,
            priority: 'medium',
            // type: 'detected_action' // Removed as it causes lint error
            // In a real app, we might pass more metadata
        });

        return true; // Signal for animation
    }, [addDetectedAction]);

    const resolveInconsistency = useCallback((pattern: CrossMeetingPattern) => {
        // Logic to "resolve" usually means marking it as addressed or generating a specific task
        // For UI, we mostly just return the script, but here we could log the resolution attempt
        console.log(`Resolving inconsistency: ${pattern.id}`);
    }, []);

    const openTimeTravel = useCallback((excerpt: RelatedMeetingExcerpt) => {
        // Mock fetching "surrounding blocks"
        const mockBlocks = [
            { id: '1', speaker: 'Alice', text: "Are we sure about the timeline?", timestamp: excerpt.date - 10000 },
            { id: '2', speaker: 'Bob', text: excerpt.snippet, timestamp: excerpt.date, isHighlight: true },
            { id: '3', speaker: 'Alice', text: "Got it, sticking to that then.", timestamp: excerpt.date + 5000 },
        ];

        setHistoricalContext({
            isOpen: true,
            snippet: excerpt,
            surroundingBlocks: mockBlocks
        });
    }, []);

    const closeTimeTravel = useCallback(() => {
        setHistoricalContext(prev => ({ ...prev, isOpen: false }));
    }, []);

    // --- Simulation Engine (for Demo/Dev) ---
    // In production, this would be a WebSocket listener or periodic polling of an Intelligence Service
    // --- Production Mode ---
    // The engine now relies entirely on WebSocket updates via TranscriptionSocketManager.
    // No local simulation is performed.
    useEffect(() => {
        // Optional: Dispatch an initial fetch or handshake if needed
        // For now, we wait for server-push events
    }, []);

    return {
        generateActionPlan,
        resolveInconsistency,
        openTimeTravel,
        closeTimeTravel,
        historicalContext
    };
}
