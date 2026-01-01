import { useState, useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { ConflictDetection, OracleInsight, TimestampMs, ParticipantId } from '@/types/slices/intelligence';
import { toBrand } from '@/types/slices/intelligence';

interface ConflictEngineState {
    conflicts: ConflictDetection[];
    meetingTemperature: number; // 0-100
    isProcessing: boolean;
}

export function useConflictEngine() {
    const {
        transcriptBlocks,
        isRecording,
        emotionStates,
        setLastInsight,
        participants
    } = useMeetingStore();

    const [state, setState] = useState<ConflictEngineState>({
        conflicts: [],
        meetingTemperature: 20, // Start calm
        isProcessing: false
    });

    // Refs for Debounce and tracking
    const potentialConflictsRef = useRef<Map<string, { startTime: number; score: number }>>(new Map());

    // Track last processed block to optimize
    const lastProcessedBlockRef = useRef<number>(0);

    // Helper: Generate CNV (Non-Violent Communication) Script
    const generatePeacekeeperScript = (type: string, _activeParticipantNames: string[], context: string): string => {
        // Names can be used for personalization if needed in future
        // const names = activeParticipantNames.join(', ');

        switch (type) {
            case 'financial':
                return `Notei que os custos geraram preocupação. [SENTIMENTO] Seria útil revermos o orçamento juntos? [NECESSIDADE]`;
            case 'interruption':
                return `Percebo que alguém estava a tentar expor um ponto. [OBSERVAÇÃO] Podemos ouvir até ao fim? [PEDIDO]`;
            case 'tone':
                return `Sinto alguma tensão na sala sobre "${context}". [OBSERVAÇÃO] Vamos fazer uma pausa para respirar/clarificar? [PEDIDO]`;
            default:
                return `Notei que temos perspetivas diferentes sobre ${context}. [OBSERVAÇÃO] Importam-se de reservar 2 minutos para cada lado? [PEDIDO]`;
        }
    };

    // Helper: Root Cause Analysis (Simple Keyword Heuristic)
    const identifyRootCause = (text: string): string => {
        const lower = text.toLowerCase();
        if (lower.includes('dinheiro') || lower.includes('custo') || lower.includes('orçamento') || lower.includes('caro')) return 'Desalinhamento Financeiro';
        if (lower.includes('prazo') || lower.includes('tempo') || lower.includes('atraso')) return 'Pressão de Prazos';
        if (lower.includes('não concordo') || lower.includes('errado') || lower.includes('impossível')) return 'Bloqueio Técnico/Opinativo';
        return 'Falha de Comunicação';
    };

    // Core Logic: Detect Conflicts
    const runConflictDetection = useCallback(() => {
        if (!isRecording) return;

        // Update isProcessing state for UI feedback
        setState(prev => ({ ...prev, isProcessing: true }));

        // Check if there are new blocks to analyze
        if (transcriptBlocks.length > lastProcessedBlockRef.current) {
            lastProcessedBlockRef.current = transcriptBlocks.length;
        }

        // Always analyze the sliding window of last 15 blocks for context
        const recentBlocks = transcriptBlocks.slice(-15);

        let currentTensionScore = 0;
        const activeParticipants = new Set<string>();
        let potentialConflictContext = '';

        recentBlocks.forEach(block => {
            const sentiment = emotionStates.find(e => e.participantId === block.speakerId)?.emotion || 'neutral';

            // Heuristic A: Negative Sentiment + Keywords
            const isNegative = sentiment === 'frustrated' || sentiment === 'confused';
            const hasConflictKeywords = /não|errado|discordo|absurdo|impossível|espera/i.test(block.text);

            if (isNegative && hasConflictKeywords) {
                currentTensionScore += 25;
                // Safe name resolution
                const pName = participants.find(p => p.id === block.speakerId)?.name || block.speaker || 'Participante';
                activeParticipants.add(pName);
                potentialConflictContext = block.text.substring(0, 30) + '...';
            }

            // Heuristic B: Interruptions (Short blocks < 15 chars closely timed with negative sentiment)
            if (block.text.length < 15 && isNegative) {
                currentTensionScore += 10;
            }
        });

        // Smart Debounce: Only report if tension persists or is very high
        const conflictId = 'active-tension';
        const now = Date.now();
        const existing = potentialConflictsRef.current.get(conflictId);

        if (currentTensionScore > 40) {
            // Threshold met
            if (!existing) {
                // Start tracking
                potentialConflictsRef.current.set(conflictId, { startTime: now, score: currentTensionScore });
            } else {
                // Check duration (Debounce: 3 seconds of sustained tension)
                if (now - existing.startTime > 3000) {

                    // CONFIRMED CONFLICT
                    const severity = currentTensionScore > 75 ? 'high' : currentTensionScore > 55 ? 'medium' : 'low';
                    const rootCause = identifyRootCause(potentialConflictContext);
                    const script = generatePeacekeeperScript(rootCause === 'Desalinhamento Financeiro' ? 'financial' : 'general', Array.from(activeParticipants), rootCause);

                    // Create Conflict Object
                    const newConflict: ConflictDetection = {
                        id: Date.now().toString(),
                        participants: Array.from(activeParticipants).map(p => toBrand<ParticipantId>(p)),
                        severity,
                        summary: `Conflito detetado: ${rootCause}`,
                        resolutionSuggestions: [script], // Use script as suggestion
                        timestamp: toBrand<TimestampMs>(now),
                        confidence: 0.9
                    };

                    // Update State
                    setState(prev => ({
                        ...prev,
                        conflicts: [newConflict, ...prev.conflicts].slice(0, 5), // Keep last 5
                        meetingTemperature: Math.min(100, prev.meetingTemperature + 20)
                    }));

                    // Escalation: HUD Intervention for HIGH severity
                    if (severity === 'high') {
                        const insight: OracleInsight = {
                            id: `conflict-${Date.now()}`,
                            typeString: 'conflict',
                            text: script,
                            confidence: 0.95,
                            sourceLink: '#', // TODO: Link to transcript block
                            timestamp: toBrand<TimestampMs>(now)
                        };
                        setLastInsight(insight);
                    }

                    // Reset tracker to avoid spamming same conflict
                    potentialConflictsRef.current.delete(conflictId);
                }
            }
        } else {
            // Cooldown / Decay
            if (existing) {
                potentialConflictsRef.current.delete(conflictId);
            }
            // Cool down temperature slowly
            setState(prev => ({
                ...prev,
                meetingTemperature: Math.max(20, prev.meetingTemperature - 5)
            }));
        }

        // Done processing
        setState(prev => ({ ...prev, isProcessing: false }));

    }, [transcriptBlocks, isRecording, emotionStates, setLastInsight, participants]);

    // Interval Timer
    useEffect(() => {
        if (!isRecording) return;
        const interval = setInterval(runConflictDetection, 2000); // Check every 2s
        return () => clearInterval(interval);
    }, [isRecording, runConflictDetection]);

    return {
        conflicts: state.conflicts,
        meetingTemperature: state.meetingTemperature,
        isProcessing: state.isProcessing
    };
}
