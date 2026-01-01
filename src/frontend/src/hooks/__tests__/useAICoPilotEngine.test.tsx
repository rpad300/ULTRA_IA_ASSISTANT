import { renderHook, act } from '@testing-library/react';
import { useAICoPilotEngine } from '../useAICoPilotEngine';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMeetingStore } from '@/store/meetingStore';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('@/hooks/useWebSocket');
vi.mock('@/store/meetingStore');
vi.mock('@/config/api', () => ({
    getWebSocketUrl: (path: string) => `ws://mock${path}`,
}));

describe('useAICoPilotEngine', () => {
    const mockSendMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock user store
        (useMeetingStore as any).mockReturnValue({
            sessionId: 'test-session-123',
        });

        // Mock WebSocket hook
        (useWebSocket as any).mockReturnValue({
            sendMessage: mockSendMessage,
            isConnected: true,
            reconnectAttempts: 0,
        });
    });

    it('should initialize with welcome message', () => {
        const { result } = renderHook(() => useAICoPilotEngine());

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].id).toBe('welcome');
        expect(result.current.messages[0].role).toBe('assistant');
    });

    it('should send user message and update local state', () => {
        const { result } = renderHook(() => useAICoPilotEngine());

        act(() => {
            result.current.sendUserMessage('Hello AI');
        });

        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[1].content).toBe('Hello AI');
        expect(result.current.messages[1].role).toBe('user');
        expect(result.current.isTyping).toBe(true);

        expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'chat_message',
            content: 'Hello AI',
            role: 'user',
            session_id: 'test-session-123',
        }));
    });

    it('should handle incoming token streaming', () => {
        // Setup callback capture
        let onMessageCallback: (msg: any) => void = () => { };
        (useWebSocket as any).mockImplementation((_url: string, options: any) => {
            onMessageCallback = options.onMessage;
            return { sendMessage: mockSendMessage, isConnected: true, reconnectAttempts: 0 };
        });

        const { result } = renderHook(() => useAICoPilotEngine());

        act(() => {
            onMessageCallback({ type: 'token', text: 'Hello' });
        });

        // First token creates streaming message
        expect(result.current.messages).toHaveLength(2); // Welcome + Stream
        expect(result.current.messages[1].content).toBe('Hello');
        expect(result.current.messages[1].isStreaming).toBe(true);
        expect(result.current.isTyping).toBe(true);

        act(() => {
            onMessageCallback({ type: 'token', text: ' World' });
        });

        // Second token appends to existing streaming message
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[1].content).toBe('Hello World');
    });

    it('should finalize message handling on completion', () => {
        let onMessageCallback: (msg: any) => void = () => { };
        (useWebSocket as any).mockImplementation((_url: string, options: any) => {
            onMessageCallback = options.onMessage;
            return { sendMessage: mockSendMessage, isConnected: true, reconnectAttempts: 0 };
        });

        const { result } = renderHook(() => useAICoPilotEngine());

        // Start stream
        act(() => {
            onMessageCallback({ type: 'token', text: 'Final Answer' });
        });

        // Complete message
        act(() => {
            onMessageCallback({
                type: 'message_complete',
                message: {
                    id: 'final-1',
                    role: 'assistant',
                    content: 'Final Answer',
                    metadata: { confidence: 0.9 }
                }
            });
        });

        expect(result.current.isTyping).toBe(false);
        const lastMsg = result.current.messages[result.current.messages.length - 1];
        expect(lastMsg.id).toBe('final-1');
        expect(lastMsg.isStreaming).toBeUndefined(); // Filtered out or updated
        expect(lastMsg.content).toBe('Final Answer');
    });

    it('should detect action requests in content', () => {
        let onMessageCallback: (msg: any) => void = () => { };
        (useWebSocket as any).mockImplementation((_url: string, options: any) => {
            onMessageCallback = options.onMessage;
            return { sendMessage: mockSendMessage, isConnected: true, reconnectAttempts: 0 };
        });

        const { result } = renderHook(() => useAICoPilotEngine());

        act(() => {
            onMessageCallback({
                type: 'new_message',
                message: {
                    id: 'action-1',
                    role: 'assistant',
                    content: 'Please review this. [ACTION]'
                }
            });
        });

        const lastMsg = result.current.messages[result.current.messages.length - 1];
        expect(lastMsg.type).toBe('action_request');
    });
});
