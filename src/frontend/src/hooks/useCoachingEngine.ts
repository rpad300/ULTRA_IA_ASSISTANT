import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { CoachingInsight, TimestampMs } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

export type HeartbeatState = 'calm' | 'warning' | 'critical';

interface UseCoachingEngineReturn {
    currentWpm: number;
    heartbeatState: HeartbeatState;
    paceProgress: number; // 0-100, where 50 is ideal
}

export function useCoachingEngine(): UseCoachingEngineReturn {
    const {
        transcriptBlocks,
        isRecording,
        addCoachingInsight,
        coachingInsights,
        setLastInsight // To trigger Oracle HUD
    } = useMeetingStore();

    const [currentWpm, setCurrentWpm] = useState(0);
    const [heartbeatState, setHeartbeatState] = useState<HeartbeatState>('calm');
    const [paceProgress, setPaceProgress] = useState(50);

    const lastAnalysisTimeRef = useRef<number>(Date.now());
    const lastWordCountRef = useRef<number>(0);

    // Config constants
    const IDEAL_WPM_MIN = 120;
    const IDEAL_WPM_MAX = 160;
    const CRITICAL_WPM = 190;

    // Helper to calculate total words in transcripts
    const getTotalWords = useCallback(() => {
        return transcriptBlocks.reduce((acc, block) => {
            // Only count actual speech, naive whitespace split
            return acc + (block.text ? block.text.trim().split(/\s+/).length : 0);
        }, 0);
    }, [transcriptBlocks]);

    // 1. Real-time Pace Tracking (WPM)
    useEffect(() => {
        if (!isRecording) {
            setCurrentWpm(0);
            setPaceProgress(50);
            setHeartbeatState('calm');
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const timeDiffMinutes = (now - lastAnalysisTimeRef.current) / 60000;

            if (timeDiffMinutes <= 0) return; // Prevention

            const totalWords = getTotalWords();
            const wordsDiff = totalWords - lastWordCountRef.current;

            // Should be at least 5 seconds since last check to be meaningful, 
            // but we run this interval every 3s for responsiveness.
            // Only update checks if we have legitimate time passage.

            if (timeDiffMinutes > 0.05) { // ~3 seconds
                // Calculate instantaneous WPM
                // If 0 words, we decay the previous WPM to avoid sharp drop to 0? 
                // No, real-time means 0 if silence.
                const instantaneousWpm = Math.round(wordsDiff / timeDiffMinutes);

                // Smoothing: 70% old, 30% new to avoid jitter
                setCurrentWpm(prev => Math.round(prev * 0.7 + instantaneousWpm * 0.3));

                // Update refs
                lastWordCountRef.current = totalWords;
                lastAnalysisTimeRef.current = now;
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isRecording, getTotalWords]);

    // 2. State & Logic Analysis (Derived from WPM + Insights)
    useEffect(() => {
        // --- Calculate Pace Progress (Visual Gauge) ---
        // Scale: 0 = 0 WPM, 50 = 140 WPM (Ideal), 100 = 200+ WPM
        // Using a sigmoid-like mapping or simple linear
        let progress = 0;
        if (currentWpm < IDEAL_WPM_MIN) {
            // 0 -> 120 maps to 0 -> 40
            progress = (currentWpm / IDEAL_WPM_MIN) * 40;
        } else if (currentWpm <= IDEAL_WPM_MAX) {
            // 120 -> 160 maps to 40 -> 60 (The "Green Zone")
            progress = 40 + ((currentWpm - IDEAL_WPM_MIN) / (IDEAL_WPM_MAX - IDEAL_WPM_MIN)) * 20;
        } else {
            // 160 -> 220 goes 60 -> 100
            progress = 60 + ((currentWpm - IDEAL_WPM_MAX) / 60) * 40;
        }
        setPaceProgress(Math.min(100, Math.max(0, progress)));

        // --- Determine Heartbeat State ---
        let newState: HeartbeatState = 'calm';
        if (currentWpm > CRITICAL_WPM) {
            newState = 'warning'; // Fast pulsing
        }

        // Check recent insights for critical flags
        const recentCritical = coachingInsights.slice(-3).some(i => i.severity === 'critical');
        if (recentCritical) newState = 'critical';

        setHeartbeatState(newState);

    }, [currentWpm, coachingInsights]);

    // 3. Insight Generation Engine (Periodic)
    useEffect(() => {
        if (!isRecording) return;

        const analysisInterval = setInterval(() => {
            // Only generate insights if we have data
            if (currentWpm > 0) {
                // Check Pace
                if (currentWpm > CRITICAL_WPM) {
                    const insight: CoachingInsight = {
                        id: Date.now().toString(),
                        type: 'pace',
                        severity: 'critical',
                        message: `Você está falando a ${currentWpm} PPM. Isso reduz a compreensão cognitiva.`,
                        suggestion: "DIGA: [Pausa de 2s] 'Deixe-me reformular isso para garantir clareza.'",
                        timestamp: toBrand<TimestampMs>(Date.now()),
                        confidence: 1.0,
                        lineage: undefined, // Or link to last block?
                        reasoning: "High WPM detected"
                    };
                    addCoachingInsight(insight);

                    // Trigger HUD
                    setLastInsight({
                        id: insight.id,
                        typeString: 'conflict', // Critical coaching fits 'conflict' (red/amber) visual urgency better for "STOP" signals.
                        text: `⚠️ RITMO CRÍTICO DETECTADO: ${currentWpm} PPM. Respire fundo.`,
                        confidence: 0.95,
                        timestamp: toBrand<TimestampMs>(Date.now())
                    });
                } else if (currentWpm < 80 && currentWpm > 10) {
                    // Too slow?
                    const insight: CoachingInsight = {
                        id: Date.now().toString(),
                        type: 'pace',
                        severity: 'warning',
                        message: "Ritmo muito lento pode sugerir insegurança.",
                        suggestion: "Aumente ligeiramente a cadência para transmitir dinamismo.",
                        timestamp: toBrand<TimestampMs>(Date.now()),
                        confidence: 0.8
                    };
                    addCoachingInsight(insight);
                } else if (currentWpm >= 120 && currentWpm <= 150) {
                    // Check if we haven't given a "Good" insight recently
                    const hasRecentGood = coachingInsights.some(i =>
                        i.severity === 'good' &&
                        i.type === 'pace' &&
                        (Date.now() - i.timestamp < 60000)
                    );

                    if (!hasRecentGood) {
                        // Reinforce positive behavior
                        const insight: CoachingInsight = {
                            id: Date.now().toString(),
                            type: 'pace',
                            severity: 'good',
                            message: "Ritmo executivo perfeito. Mantenha essa cadência.",
                            timestamp: toBrand<TimestampMs>(Date.now()),
                            confidence: 0.95
                        };
                        addCoachingInsight(insight);
                    }
                }
            }

            // HEURISTIC: "Fillers" check (simple regex on last block)
            // Real implementation would look at the last N blocks
            const lastBlock = transcriptBlocks[transcriptBlocks.length - 1];
            if (lastBlock?.text) {
                const text = lastBlock.text.toLowerCase();
                const fillers = ['hum', 'eh', 'tipo', 'sabe']; // PT-BR fillers
                const fillerCount = fillers.reduce((acc, filler) => {
                    const regex = new RegExp(`\\b${filler}\\b`, 'g');
                    return acc + (text.match(regex) || []).length;
                }, 0);

                if (fillerCount > 3) {
                    const insight: CoachingInsight = {
                        id: Date.now().toString() + '-filler',
                        type: 'tone',
                        severity: 'warning',
                        message: "Detectado uso excessivo de vícios de linguagem.",
                        suggestion: "DIGA: Faça uma pausa silenciosa em vez de usar 'ééé' ou 'tipo'.",
                        timestamp: toBrand<TimestampMs>(Date.now()),
                        confidence: 0.85
                    };
                    addCoachingInsight(insight);
                }
            }

        }, 10000); // Check for insights every 10s

        return () => clearInterval(analysisInterval);
    }, [isRecording, currentWpm, addCoachingInsight, setLastInsight, transcriptBlocks, coachingInsights]);

    return {
        currentWpm,
        heartbeatState,
        paceProgress
    };
}
