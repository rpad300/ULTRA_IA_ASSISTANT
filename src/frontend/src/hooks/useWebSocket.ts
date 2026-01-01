import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

interface UseWebSocketOptions {
    onMessage?: (message: WebSocketMessage) => void;
    onError?: (error: Event) => void;
    onOpen?: () => void;
    onClose?: () => void;
    reconnect?: boolean;
    reconnectInterval?: number;
}

export function useWebSocket(url: string | null, options: UseWebSocketOptions = {}) {
    const {
        onMessage,
        onError,
        onOpen,
        onClose,
        reconnect = true,
        reconnectInterval = 3000,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shouldReconnectRef = useRef(true);

    // Store callbacks in refs to avoid recreating connection on every render
    const callbacksRef = useRef({ onMessage, onError, onOpen, onClose });
    useEffect(() => {
        callbacksRef.current = { onMessage, onError, onOpen, onClose };
    }, [onMessage, onError, onOpen, onClose]);

    const connect = useCallback(() => {
        if (!url) return;

        try {
            // URL should already be in ws:// format, but convert if needed
            let wsUrl = url.startsWith('ws://') || url.startsWith('wss://')
                ? url
                : url.replace(/^https?/, url.startsWith('https') ? 'wss' : 'ws');

            // SOTA: Inject Auth Token for Security
            const token = localStorage.getItem('auth_token');
            if (token) {
                const separator = wsUrl.includes('?') ? '&' : '?';
                wsUrl = `${wsUrl}${separator}token=${token}`;
            }
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setIsConnected(true);
                setReconnectAttempts(0);
                callbacksRef.current.onOpen?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    callbacksRef.current.onMessage?.(data);
                } catch (error) {
                    console.error("Failed to parse WebSocket message:", error);
                }
            };

            ws.onerror = (error) => {
                // Only log errors if connection was attempted (not just closed immediately)
                // Code 1006 (abnormal closure) is expected if backend is not available
                if (wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
                    console.error("WebSocket error event:", error);
                }
                callbacksRef.current.onError?.(error);
            };

            ws.onclose = (event) => {
                setIsConnected(false);

                // Code 1006 = Abnormal closure (server not available, network error, etc.)
                // This is expected if backend is not running, so we don't need to log it
                if (event.code !== 1006) {
                    console.log("WebSocket closed:", event.code, event.reason || "No reason provided");
                }

                callbacksRef.current.onClose?.();

                // Only reconnect if it wasn't a normal closure (code 1000) or intentional disconnect
                // Code 1006 (abnormal closure) should still trigger reconnect
                if (shouldReconnectRef.current && reconnect && url && event.code !== 1000) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        setReconnectAttempts(prev => prev + 1);
                        connect();
                    }, reconnectInterval);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error("WebSocket connection error:", error);
        }
    }, [url, reconnect, reconnectInterval]);

    const sendMessage = useCallback((message: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn("WebSocket is not connected");
        }
    }, []);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!url) {
            disconnect();
            return;
        }

        shouldReconnectRef.current = true;

        // Small delay before first connection to allow backend to be ready
        const connectTimeout = setTimeout(() => {
            connect();
        }, 500);

        return () => {
            clearTimeout(connectTimeout);
            shouldReconnectRef.current = false;
            disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    return {
        isConnected,
        sendMessage,
        disconnect,
        reconnectAttempts,
    };
}

