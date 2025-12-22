import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Star, FileText, Loader2, Copy, Check, ThumbsUp, Heart, Lightbulb, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/api/client";
import { toast } from "@/components/ui/toast";
import { MessageSearch } from "./MessageSearch";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatMessageTime } from "@/utils/timeUtils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useWebSocket as useWebSocketHook } from "@/hooks/useWebSocket";
import { getWebSocketUrl } from "@/config/api";

interface ThreadPrepChatProps {
    messages: Message[];
    onSendMessage: (content: string) => Promise<void>;
    isLoading?: boolean;
    isTyping?: boolean; // New: typing indicator
    threadId?: string; // For WebSocket connection
    enableWebSocket?: boolean; // Enable WebSocket
}

interface MessageMetadata {
    isKeyNote?: boolean;
    isCandidateForScript?: boolean;
    copied?: boolean;
    reaction?: 'thumbsup' | 'heart' | 'lightbulb' | null;
}

// Typing Indicator Component
function TypingIndicator() {
    return (
        <div className="flex w-full gap-3 justify-start animate-in fade-in slide-in-from-bottom-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <div className="h-4 w-4 bg-primary rounded-sm" />
            </div>
            <div className="max-w-[80%] flex flex-col gap-1 items-start">
                <div className="bg-card border border-border text-foreground rounded-2xl px-4 py-2.5">
                    <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Auto-resize textarea hook
function useAutoResizeTextarea(textareaRef: React.RefObject<HTMLTextAreaElement | null>, value: string) {
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [value, textareaRef]);
}

export function ThreadPrepChat({ messages, onSendMessage, isLoading = false, isTyping = false, threadId, enableWebSocket = false }: ThreadPrepChatProps) {
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [failedMessages, setFailedMessages] = useState<Set<string>>(new Set());
    const [messageMetadata, setMessageMetadata] = useState<Record<string, MessageMetadata>>({});
    const [localMessages, setLocalMessages] = useState<(Message & { isStreaming?: boolean })[]>(messages);
    const [wsTyping, setWsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { isOnline, wasOffline } = useOnlineStatus();

    useAutoResizeTextarea(textareaRef, input);

    // WebSocket connection for real-time updates
    const wsUrl = enableWebSocket && threadId
        ? getWebSocketUrl(`/api/ws/threads/${threadId}/messages`)
        : null;

    const wsHook = useWebSocketHook(wsUrl, {
        onMessage: (message) => {
            if (message.type === "new_message") {
                const completedMsg = message.message;
                setLocalMessages(prev => {
                    // Check if we have this message already (e.g. from streaming)
                    const exists = prev.find(m => m.id === completedMsg.id);
                    if (exists) {
                        // Update existing (finalize it)
                        return prev.map(m => m.id === completedMsg.id ? { ...completedMsg, isStreaming: false } : m);
                    } else {
                        // Append new
                        return [...prev, completedMsg];
                    }
                });
                setWsTyping(false);
            } else if (message.type === "typing_start") {
                // Initialize placeholder with Real ID
                const msgId = message.message_id;
                if (msgId) {
                    setLocalMessages(prev => {
                        if (prev.find(m => m.id === msgId)) return prev;
                        const placeholder: Message & { isStreaming?: boolean } = {
                            id: msgId,
                            role: 'assistant',
                            content: '',
                            created_at: new Date().toISOString(),
                            isStreaming: true
                        };
                        return [...prev, placeholder];
                    });
                }
                setWsTyping(true);
            } else if (message.type === "token") {
                // Streaming Token - Update specific message by ID if possible
                setWsTyping(true);
                const targetId = message.message_id;
                const text = message.text;

                setLocalMessages(prev => {
                    if (targetId) {
                        // Targeted Update
                        const exists = prev.find(m => m.id === targetId);
                        if (exists) {
                            return prev.map(m => m.id === targetId ? { ...m, content: m.content + text, isStreaming: true } : m);
                        } else {
                            // Recover if typing_start missed? Create on fly with ID
                            const tempMsg: Message & { isStreaming?: boolean } = {
                                id: targetId,
                                role: 'assistant',
                                content: text,
                                created_at: new Date().toISOString(),
                                isStreaming: true
                            };
                            return [...prev, tempMsg];
                        }
                    } else {
                        // Legacy Fallback (Last Message)
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                            return prev.map((msg, idx) =>
                                idx === prev.length - 1 ? { ...msg, content: msg.content + text } : msg
                            );
                        }
                        return prev;
                    }
                });
            } else if (message.type === "initial_messages") {
                setLocalMessages(message.messages);
            } else if (message.type === "error") {
                toast.error(message.message || "WebSocket error");
                setWsTyping(false);
            } else if (message.type === "typing") {
                setWsTyping(true);
            }
        },
        onError: () => {
            setWsTyping(false);
        },
        onOpen: () => { },
        onClose: () => { },
        reconnect: true,
        reconnectInterval: 5000,
    });

    const wsConnected = wsHook?.isConnected ?? false;
    const wsSendMessage = wsHook?.sendMessage;

    // Update local messages when prop changes (fallback for non-WebSocket mode)
    useEffect(() => {
        if (!enableWebSocket) {
            setLocalMessages(messages);
        }
    }, [messages, enableWebSocket]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [localMessages, wsTyping, isTyping]);

    const handleSend = useCallback(async (retryContent?: string) => {
        const contentToSend = retryContent || input.trim();
        if (!contentToSend || isSending) return;

        if (!isOnline) {
            toast.error("You're offline. Please check your connection.");
            return;
        }

        setIsSending(true);
        const tempId = Date.now().toString();
        if (!retryContent) {
            setInput("");
        }

        try {
            // Use WebSocket if available, otherwise fallback to HTTP
            if (enableWebSocket && wsConnected && wsSendMessage) {
                wsSendMessage({
                    type: "send_message",
                    content: contentToSend,
                    role: "user",
                    attachments: attachments // Pass the attachment metadata (uri, mime_type)
                });
                setAttachments([]); // Clear attachments after send
                // Optimistic update
                const optimisticMsg: Message = {
                    id: tempId,
                    role: 'user',
                    content: contentToSend,
                    created_at: new Date().toISOString()
                };
                setLocalMessages(prev => [...prev, optimisticMsg]);
            } else {
                await onSendMessage(contentToSend);
            }

            // Remove from failed messages if it was a retry
            setFailedMessages(prev => {
                const next = new Set(prev);
                next.delete(tempId);
                return next;
            });
        } catch (error) {
            console.error("Failed to send message:", error);
            setFailedMessages(prev => new Set(prev).add(tempId));
            toast.error("Failed to send message. Click to retry.", {
                duration: 5000,
                action: {
                    label: "Retry",
                    onClick: () => {
                        handleSend(contentToSend);
                    }
                }
            });
            // Restore input on failure (only if not a retry)
            if (!retryContent) {
                setInput(contentToSend);
            }
        } finally {
            setIsSending(false);
        }
    }, [input, isSending, onSendMessage, isOnline, enableWebSocket, wsConnected, wsSendMessage]);

    const copyToClipboard = useCallback(async (content: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setMessageMetadata(prev => ({
                ...prev,
                [messageId]: { ...prev[messageId], copied: true }
            }));
            toast.success("Copied to clipboard");
            setTimeout(() => {
                setMessageMetadata(prev => ({
                    ...prev,
                    [messageId]: { ...prev[messageId], copied: false }
                }));
            }, 2000);
        } catch (error) {
            toast.error("Failed to copy");
        }
    }, []);

    const toggleKeyNote = useCallback((messageId: string) => {
        setMessageMetadata(prev => ({
            ...prev,
            [messageId]: {
                ...prev[messageId],
                isKeyNote: !prev[messageId]?.isKeyNote,
            }
        }));
    }, []);

    const toggleCandidateForScript = useCallback((messageId: string) => {
        setMessageMetadata(prev => ({
            ...prev,
            [messageId]: {
                ...prev[messageId],
                isCandidateForScript: !prev[messageId]?.isCandidateForScript,
            }
        }));
    }, []);

    const toggleReaction = useCallback((messageId: string, reaction: 'thumbsup' | 'heart' | 'lightbulb') => {
        setMessageMetadata(prev => {
            const current = prev[messageId] || {};
            const newReaction = current.reaction === reaction ? null : reaction;
            return {
                ...prev,
                [messageId]: { ...current, reaction: newReaction }
            };
        });
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSend();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSend]);

    return (
        <div className="flex flex-col h-full">
            {/* Header with Search */}
            <div className="p-3 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Preparation Chat</h3>
                    {/* Connection Status */}
                    {enableWebSocket && (
                        <div className="flex items-center gap-1.5">
                            {wsHook?.isConnected ? (
                                <div className="flex items-center gap-1 text-xs text-green-500">
                                    <Wifi className="h-3 w-3" />
                                    <span className="hidden sm:inline">Connected</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-xs text-yellow-500">
                                    <WifiOff className="h-3 w-3" />
                                    <span className="hidden sm:inline">Connecting...</span>
                                </div>
                            )}
                        </div>
                    )}
                    {!enableWebSocket && (
                        <div className="flex items-center gap-1.5">
                            {isOnline ? (
                                <div className="flex items-center gap-1 text-xs text-green-500">
                                    <Wifi className="h-3 w-3" />
                                    <span className="hidden sm:inline">Online</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-xs text-red-500">
                                    <WifiOff className="h-3 w-3" />
                                    <span className="hidden sm:inline">Offline</span>
                                </div>
                            )}
                        </div>
                    )}
                    {wasOffline && isOnline && (
                        <div className="text-xs text-green-500 animate-in fade-in">
                            Back online
                        </div>
                    )}
                </div>
                <MessageSearch
                    messages={enableWebSocket ? localMessages : messages}
                    onResultSelect={(messageId) => {
                        const element = document.querySelector(`[data-message-id="${messageId}"]`);
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Highlight briefly
                        element?.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                        setTimeout(() => {
                            element?.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                        }, 2000);
                    }}
                />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {((enableWebSocket ? localMessages : messages).length === 0) && !isTyping && !wsTyping ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground animate-in fade-in duration-500">
                        <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4">
                            <FileText className="h-6 w-6" />
                        </div>
                        <p className="text-sm">Start the conversation to prepare for your meeting</p>
                    </div>
                ) : (
                    <>
                        {(enableWebSocket ? localMessages : messages).map((msg, index) => {
                            const metadata = messageMetadata[msg.id] || {};
                            return (
                                <div
                                    key={msg.id}
                                    data-message-id={msg.id}
                                    className={cn(
                                        "flex w-full gap-3 group animate-in fade-in slide-in-from-bottom-2",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <div className="h-4 w-4 bg-primary rounded-sm" />
                                        </div>
                                    )}
                                    <div className={cn(
                                        "max-w-[80%] flex flex-col gap-1",
                                        msg.role === 'user' ? "items-end" : "items-start"
                                    )}>
                                        <div className={cn(
                                            "text-sm leading-relaxed rounded-2xl px-4 py-2.5 transition-all relative",
                                            msg.role === 'user'
                                                ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                                                : "bg-card border border-border text-foreground hover:shadow-md",
                                            failedMessages.has(msg.id) && "ring-2 ring-red-500/50"
                                        )}>
                                            {msg.role === 'assistant' ? (
                                                <MarkdownRenderer content={msg.content} />
                                            ) : (
                                                msg.content.split('\n').map((line, i) => (
                                                    <p key={i} className="mb-1 last:mb-0">{line}</p>
                                                ))
                                            )}
                                            {failedMessages.has(msg.id) && (
                                                <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
                                                    <AlertCircle className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Timestamp */}
                                        <span className="text-xs text-muted-foreground px-1">
                                            {formatMessageTime(msg.created_at)}
                                        </span>

                                        {/* Message Actions */}
                                        <div className={cn(
                                            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                                            msg.role === 'user' ? "flex-row-reverse" : ""
                                        )}>
                                            {/* Copy Button */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => copyToClipboard(msg.content, msg.id)}
                                                title="Copy message"
                                            >
                                                {metadata.copied ? (
                                                    <Check className="h-3 w-3 mr-1 text-green-500" />
                                                ) : (
                                                    <Copy className="h-3 w-3 mr-1" />
                                                )}
                                            </Button>

                                            {/* Reactions (only for assistant messages) */}
                                            {msg.role === 'assistant' && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-7 px-2 text-xs",
                                                            metadata.reaction === 'thumbsup' && "text-blue-500"
                                                        )}
                                                        onClick={() => toggleReaction(msg.id, 'thumbsup')}
                                                        title="Thumbs up"
                                                    >
                                                        <ThumbsUp className={cn(
                                                            "h-3 w-3",
                                                            metadata.reaction === 'thumbsup' && "fill-current"
                                                        )} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-7 px-2 text-xs",
                                                            metadata.reaction === 'heart' && "text-red-500"
                                                        )}
                                                        onClick={() => toggleReaction(msg.id, 'heart')}
                                                        title="Love it"
                                                    >
                                                        <Heart className={cn(
                                                            "h-3 w-3",
                                                            metadata.reaction === 'heart' && "fill-current"
                                                        )} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-7 px-2 text-xs",
                                                            metadata.reaction === 'lightbulb' && "text-yellow-500"
                                                        )}
                                                        onClick={() => toggleReaction(msg.id, 'lightbulb')}
                                                        title="Great idea"
                                                    >
                                                        <Lightbulb className={cn(
                                                            "h-3 w-3",
                                                            metadata.reaction === 'lightbulb' && "fill-current"
                                                        )} />
                                                    </Button>
                                                </>
                                            )}

                                            {/* Key Note */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "h-7 px-2 text-xs",
                                                    metadata.isKeyNote && "text-yellow-500"
                                                )}
                                                onClick={() => toggleKeyNote(msg.id)}
                                                title="Mark as key note"
                                            >
                                                <Star className={cn(
                                                    "h-3 w-3 mr-1",
                                                    metadata.isKeyNote && "fill-yellow-500 text-yellow-500"
                                                )} />
                                                Key Note
                                            </Button>

                                            {/* Script Candidate */}
                                            {msg.role === 'assistant' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "h-7 px-2 text-xs",
                                                        metadata.isCandidateForScript && "text-primary"
                                                    )}
                                                    onClick={() => toggleCandidateForScript(msg.id)}
                                                    title="Candidate for script"
                                                >
                                                    <FileText className={cn(
                                                        "h-3 w-3 mr-1",
                                                        metadata.isCandidateForScript && "text-primary"
                                                    )} />
                                                    Script
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-medium">
                                            You
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Typing Indicator */}
                        {(isTyping || wsTyping) && <TypingIndicator />}
                    </>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 hover:bg-accent transition-colors"
                        title="Attach file (Images/Audio for Gemini Analysis)"
                        onClick={() => document.getElementById('file-upload-input')?.click()}
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                        type="file"
                        id="file-upload-input"
                        className="hidden"
                        accept="image/*,audio/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                toast.info(`File selected: ${file.name}. (Multimodal upload coming in next backend update)`);
                                // TODO: Implement actual upload to /api/upload -> get path -> send with message
                            }
                        }}
                    />
                    <div className="relative flex-1">
                        <Textarea
                            ref={textareaRef}
                            className="w-full min-h-[50px] max-h-[150px] p-3 pr-12 rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition-all text-sm"
                            placeholder="Type a message to prepare for the meeting... (⌘+Enter to send)"
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={isSending || isLoading}
                        />
                        <Button
                            size="icon"
                            className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg transition-all hover:scale-105"
                            onClick={() => handleSend()}
                            disabled={isSending || !input.trim() || isLoading}
                            title="Send message (⌘+Enter)"
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
