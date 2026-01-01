
import { useState, useEffect, useCallback } from 'react';
import type { NetworkState, WorkerEvent } from '../types/worker';
import { getWorker, sendWorkerMessage } from '../workers/workerClient';

export function useNetworkWorker(socketId: string, url?: string | null, options?: { token?: string, sessionId?: string }) {
    // We utilize the Singleton Client
    const [connectionStatus, setConnectionStatus] = useState<NetworkState['status']>('disconnected');
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Listen to global status updates (coarse grain for now)
        // Ideally we filter by socketId if the worker supports per-socket status events in main payload
        // The worker sends STATUS_CHANGE with socketId, which we handle in workerClient?
        // Wait, workerClient handles global state updates currently.
        // If we want per-socket status in the hook, we must listen to the RAW worker message event 
        // OR update the client to support distinct socket states.

        // For SOTA robustness, let's keep listening to the raw worker event inside the client 
        // OR add a specialized listener.
        // Actually, the previous hook implementation added its own listener to the worker instance.
        // That is valid. The singleton 'workerInstance' is the same.

        const w = getWorker();
        const handler = (event: MessageEvent<WorkerEvent>) => {
            const data = event.data;
            if (data.type === 'STATUS_CHANGE' && data.socketId === socketId) {
                setConnectionStatus(data.status);
                setIsConnected(data.status === 'connected');
            }
        };

        w.addEventListener('message', handler);
        return () => w.removeEventListener('message', handler);
    }, [socketId]);

    const connect = useCallback((targetUrl: string, token?: string, sessionId?: string) => {
        sendWorkerMessage({ type: 'CONNECT', socketId, url: targetUrl, token, sessionId });
    }, [socketId]);

    const disconnect = useCallback(() => {
        sendWorkerMessage({ type: 'DISCONNECT', socketId });
    }, [socketId]);

    const sendMessage = useCallback((payload: any) => {
        sendWorkerMessage({ type: 'SEND_MESSAGE', socketId, payload });
    }, [socketId]);


    // Auto-connect if URL provided
    useEffect(() => {
        if (url) {
            connect(url, options?.token, options?.sessionId);
        }
        return () => {
            // Optional: Auto-disconnect on unmount? 
            // Often better to keep alive if navigating, but for specific components like Copilot, yes.
            // Let's not auto-disconnect to support persistence across views unless explicitly cleaned up.
        };
    }, [url, connect, options?.token, options?.sessionId]);

    return {
        isConnected,
        status: connectionStatus,
        connect,
        disconnect,
        sendMessage,
        onMessage: (callback: (msg: any) => void) => {
            const w = getWorker();
            const handler = (event: MessageEvent<WorkerEvent>) => {
                if (event.data.type === 'MESSAGE_RECEIVED' && event.data.socketId === socketId) {
                    callback(event.data.payload);
                }
            };
            w.addEventListener('message', handler);
            return () => w.removeEventListener('message', handler);
        }
    };
}
