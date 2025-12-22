import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getWebSocketUrl } from "@/config/api";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

export function AICoPilotPanel() {
    const { sessionId, isRecording } = useMeetingStore();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "I'm listening to the meeting. Ask me anything about what's being said, or ask me to capture an action item.",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // WebSocket for Co-Pilot (separate from main thread chat)
    // We reuse the thread/chat infrastructure but potentially with a specific 'copilot' flag or separate endpoint
    // For now, let's assume we map sessionId to a "thread" ID or similar for the agent.
    // In strict architecture, we might need a dedicated EP. Let's send to the same chat EP but use sessionId as threadId for now
    // NOTE: In the backend, we might need to create a temporary thread for this session if one doesn't exist.
    // Assuming sessionId is a valid threadId or capable of being one.

    // Fallback: If sessionId is not a uuid, this might fail. 
    // Let's assume for this "SOTA" implementation we are using the sessionId (which is time-based in current URL)
    // We might need to ensure backend handles this.
    const wsUrl = sessionId ? getWebSocketUrl(`/api/ws/threads/${sessionId}/messages`) : null;

    const { sendMessage } = useWebSocket(wsUrl, {
        onMessage: (msg) => {
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
                            isStreaming: true
                        }];
                    }
                });
            } else if (msg.type === 'new_message') {
                setIsTyping(false);
                setMessages(prev => {
                    // Replace streaming message with final
                    const filtered = prev.filter(m => !m.isStreaming);
                    return [...filtered, {
                        id: msg.message.id,
                        role: msg.message.role,
                        content: msg.message.content,
                        timestamp: new Date(msg.message.created_at)
                    }];
                });
            }
        }
    });

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // Send to WebSocket
        if (sendMessage) {
            sendMessage({
                type: 'send_message',
                content: userMsg.content,
                role: 'user'
            });
        } else {
            // Fallback mock if no connection (for demo robustness)
            setTimeout(() => {
                setIsTyping(false);
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I'm having trouble connecting to the live brain, but I'm here!",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMsg]);
            }, 1000);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    return (
        <Card className="flex flex-col h-full border-border bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="p-3 border-b border-border bg-muted/20 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Active Co-Pilot
                    {isRecording && (
                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse ml-auto" title="Listening to meeting..." />
                    )}
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
                <ScrollArea className="flex-1 p-3">
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col gap-1 max-w-[85%] text-sm",
                                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "px-3 py-2 rounded-2xl",
                                        msg.role === 'user'
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-muted rounded-bl-none"
                                    )}
                                >
                                    <MarkdownRenderer content={msg.content} />
                                </div>
                                <span className="text-[10px] text-muted-foreground px-1">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Co-Pilot is thinking...
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                <div className="p-3 border-t border-border bg-background/50">
                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about the meeting..."
                            className="h-9 text-sm rounded-full"
                        />
                        <Button
                            size="icon"
                            className="h-9 w-9 rounded-full shrink-0"
                            onClick={handleSend}
                            disabled={!input.trim()}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
