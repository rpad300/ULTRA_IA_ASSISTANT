import { useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl } from '@/config/api';
import { useNetworkWorker } from './useNetworkWorker';

export type TranscriptionStatus = 'idle' | 'connecting' | 'connected' | 'model_loading' | 'error' | 'disconnected';

export interface TranscriptSegment {
    id: string;
    text: string;
    speaker: string;
    isFinal: boolean;
    timestamp: string;
}

interface UseTranscriptionSocketProps {
    sessionId?: string;
    onTranscript?: (segment: TranscriptSegment) => void;
    onStatusChange?: (status: TranscriptionStatus) => void;
}

export function useTranscriptionSocket({ sessionId, onTranscript, onStatusChange }: UseTranscriptionSocketProps) {

    // const reconnectAttemptsRef = useRef(0); // Managed by worker now


    // Use the Network Worker with a specific Socket ID
    const socketId = `transcription-${sessionId || 'default'}`;
    const {
        connect: workerConnect,
        disconnect: workerDisconnect,
        status: workerStatus,
        onMessage,
        sendMessage: workerSendMessage
    } = useNetworkWorker(socketId);

    // Keep latest callbacks
    const onTranscriptRef = useRef(onTranscript);
    const onStatusChangeRef = useRef(onStatusChange);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onStatusChangeRef.current = onStatusChange;
    }, [onTranscript, onStatusChange]);

    // Map Worker Status to Transcription Status
    useEffect(() => {
        let status: TranscriptionStatus = 'idle';
        if (workerStatus === 'connected') status = 'connected';
        else if (workerStatus === 'connecting') status = 'connecting';
        else if (workerStatus === 'disconnected') status = 'disconnected';
        else if (workerStatus === 'reconnecting') status = 'connecting';

        // Notify parent
        if (onStatusChangeRef.current) {
            onStatusChangeRef.current(status);
        }
    }, [workerStatus]);

    // Handle Incoming Messages
    useEffect(() => {
        return onMessage((data) => {
            // Handle Status Messages
            if (data.type === 'status') {
                if (data.status === 'model_loading') {
                    onStatusChangeRef.current?.('model_loading');
                } else if (data.status === 'ready') {
                    onStatusChangeRef.current?.('connected');
                }
            }

            // Handle Transcripts
            if (data.type === 'transcript' || data.type === 'Turn') {
                const segment: TranscriptSegment = {
                    id: crypto.randomUUID(),
                    text: data.text || data.transcript,
                    speaker: data.speaker || "?",
                    isFinal: data.is_final,
                    timestamp: new Date().toISOString()
                };

                if (onTranscriptRef.current) {
                    onTranscriptRef.current(segment);
                }
            }
        });
    }, [onMessage]);

    const connect = useCallback((specificSessionId?: string) => {
        const targetSessionId = specificSessionId || sessionId;
        if (!targetSessionId) return;

        const wsUrl = getWebSocketUrl(`/api/ws/transcription?mode=native&session_id=${targetSessionId}`);
        // Worker handles auth injection if we pass token in params, but getWebSocketUrl might not.
        // The worker `connect` accepts (socketId, url, token).
        // Let's assume URL includes basic params.
        const token = localStorage.getItem('auth_token') || undefined;

        workerConnect(wsUrl, token, targetSessionId);
    }, [workerConnect, sessionId]);

    const disconnect = useCallback(() => {
        workerDisconnect();
    }, [workerDisconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []);

    // Helper to send data (e.g. Audio Chunks)
    const sendData = useCallback((data: any) => {
        // worker sendMessage needs socketId? No, the hook `useNetworkWorker` returns a bounded `sendMessage`.
        // Let's verify `useNetworkWorker` implementation.
        // Yes: `const sendMessage = useCallback((payload: any) => ... postMessage({ socketId ... })`
        // So we just pass it through.
        workerSendMessage(data);
    }, [workerSendMessage]);

    return {
        status: workerStatus as TranscriptionStatus,
        connect,
        disconnect,
        isConnected: workerStatus === 'connected',
        sendMessage: sendData
    };
}
