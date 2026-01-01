import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMeetingStore, type MeetingState } from '@/store/meetingStore';
import { useShallow } from 'zustand/react/shallow';
import { useNetworkWorker } from '@/hooks/useNetworkWorker';
import { getWebSocketUrl } from '@/config/api';

export interface CoPilotMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
    type?: 'text' | 'action_request' | 'alert' | 'system';
    metadata?: any;
}

export interface QuickAction {
    id: string;
    label: string;
    prompt: string;
    icon?: string;
    category?: 'summary' | 'action' | 'analysis';
}

const DEFAULT_SUGGESTIONS: QuickAction[] = [
    { id: 'sum_5', label: 'Resuma os últimos 5 min', prompt: 'Resuma o que foi discutido nos últimos 5 minutos.', category: 'summary' },
    { id: 'next_steps', label: 'Próximos Passos?', prompt: 'Quais são os próximos passos identificados até agora?', category: 'action' },
    { id: 'contradictions', label: 'Verificar Contradições', prompt: 'Verifique se houve alguma contradição no que foi dito.', category: 'analysis' },
];

export function useAICoPilotEngine() {
    // SOTA: Use strict selectors to prevent re-renders
    const { sessionId, threadId } = useMeetingStore(
        useShallow((state: MeetingState) => ({
            sessionId: state.sessionId,
            threadId: state.threadId
        }))
    );

    const [messages, setMessages] = useState<CoPilotMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Olá! Estou a ouvir a reunião. Posso ajudar com resumos, tarefas ou análises.",
            timestamp: new Date(),
            type: 'text'
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [quickActions, setQuickActions] = useState<QuickAction[]>(DEFAULT_SUGGESTIONS);

    // Context Pruning / Memory Summary Logic can stay here or move to backend

    // SOTA: Use Network Worker for Resilience
    const [token, setToken] = useState<string | undefined>(
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') || undefined : undefined
    );

    // DEBUG: Check token & Poll if missing
    useEffect(() => {
        if (!token) {
            const t = localStorage.getItem('auth_token');
            if (t) {
                console.log("[CoPilot] Found auth_token");
                setToken(t);
            }
        }
    }, [token]);

    const wsUrl = threadId ? getWebSocketUrl(`/api/ws/threads/${threadId}/messages`) : null;
    const socketId = `copilot-${threadId || 'pending'}`;

    // Debug: Trace Renders
    console.log('[useAICoPilotEngine] Render', { threadId, sessionId, token: !!token });

    const workerOptions = useMemo(() => {
        console.log('[useAICoPilotEngine] Options Changed', { token: !!token, sessionId });
        return {
            token,
            sessionId: sessionId || undefined
        };
    }, [token, sessionId]);

    const {
        sendMessage,
        isConnected,
        status: workerStatus,
        onMessage
    } = useNetworkWorker(socketId, wsUrl, workerOptions);

    // Effect for handling incoming messages
    useEffect(() => {
        const unsubscribe = onMessage((msg) => {
            handleIncomingMessage(msg);
        });
        return unsubscribe;
    }, [onMessage]);

    const connectionStatus: 'connected' | 'connecting' | 'disconnected' = isConnected
        ? 'connected'
        : workerStatus === 'reconnecting' ? 'connecting' // Reconnecting maps to connecting for UI simplicity or add 'reconnecting' to UI
            : workerStatus === 'connecting' ? 'connecting'
                : 'disconnected';

    // ... (handleIncomingMessage is fine, it takes msg object) ...

    const handleIncomingMessage = (msg: any) => {
        if (msg.type === 'token') {
            setIsTyping(true);
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.isStreaming) {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + msg.text } : m);
                } else {
                    return [...prev, {
                        id: `stream-${Date.now()}`,
                        role: 'assistant',
                        content: msg.text,
                        timestamp: new Date(),
                        isStreaming: true,
                        type: 'text'
                    }];
                }
            });
        } else if (msg.type === 'message_complete' || msg.type === 'new_message') {
            setIsTyping(false);
            setMessages(prev => {
                const filtered = prev.filter(m => !m.isStreaming);
                // Detect if content suggests an action
                const hasAction = msg.message?.content?.includes('[ACTION]') || false;

                return [...filtered, {
                    id: msg.message?.id || Date.now().toString(),
                    role: msg.message?.role || 'assistant',
                    content: msg.message?.content || "",
                    timestamp: new Date(),
                    type: hasAction ? 'action_request' : 'text',
                    metadata: msg.message?.metadata
                }];
            });

            // Dynamic Quick Actions update based on context (Simulated)
            if (Math.random() > 0.7) {
                const newAction: QuickAction = {
                    id: `dyn-${Date.now()}`,
                    label: 'Aprofundar Tópico',
                    prompt: 'Pode detalhar mais sobre o último ponto?',
                    category: 'analysis'
                };
                setQuickActions(prev => [...prev.slice(0, 2), newAction].slice(0, 4));
            }
        }
    };

    const sendUserMessage = useCallback((text: string) => {
        // ... (userMsg setup) ...
        const userMsg: CoPilotMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
            type: 'text'
        };

        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        if (sendMessage && isConnected) {
            sendMessage({
                type: 'chat_message',
                content: text,
                role: 'user',
                session_id: sessionId
            });
        } else {
            // Fallback for demo/offline
            setTimeout(() => {
                setIsTyping(false);
                handleIncomingMessage({
                    type: 'new_message',
                    message: {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "Estou com dificuldade de conexão (Offline Mode), mas registei: " + text,
                    }
                });
            }, 1000);
        }
    }, [sessionId, sendMessage, isConnected]);

    const clearHistory = () => {
        setMessages([{
            id: 'system-reset',
            role: 'assistant',
            content: "Contexto limpo. Estou pronto para começar de novo.",
            timestamp: new Date(),
            type: 'system'
        }]);
    };

    return {
        messages,
        isTyping,
        connectionStatus,
        retryCount: workerStatus === 'reconnecting' ? 1 : 0, // Simplified: Worker handles retries opaquely
        quickActions,
        sendUserMessage,
        clearHistory
    };
}
