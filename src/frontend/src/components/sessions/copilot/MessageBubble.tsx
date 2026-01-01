import { memo } from 'react';
import type { CoPilotMessage } from '@/hooks/useAICoPilotEngine';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Bot, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming button exists

interface MessageBubbleProps {
    message: CoPilotMessage;
    onDeepLinkClick?: (blockId: string) => void;
}

export const MessageBubble = memo(({ message, onDeepLinkClick }: MessageBubbleProps) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    // Deep Linking Render Logic:
    // This is where "Actionable Bubbles" magic happens.
    // If the content mentions a block ID, we could parse it and make it clickable.
    // For now, let's rely on the metadata or quick check for 'deep_link' in content.

    // Example Deep Link Renderer (Manual Injection for SOTA demo)
    const handleContentClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' && target.dataset.blockId) {
            e.preventDefault();
            onDeepLinkClick?.(target.dataset.blockId);
        }
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-1 max-w-[90%] text-sm mb-4 transition-all duration-300",
                isUser ? "ml-auto items-end" : "mr-auto items-start",
                isSystem ? "mx-auto items-center max-w-full" : ""
            )}
        >
            {/* Header / Avatar */}
            {!isUser && !isSystem && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                    <div className={cn(
                        "h-5 w-5 rounded-md flex items-center justify-center shadow-sm",
                        message.type === 'action_request' ? "bg-emerald-500/10 text-emerald-500" :
                            message.type === 'alert' ? "bg-amber-500/10 text-amber-500" :
                                "bg-primary/10 text-primary"
                    )}>
                        {message.type === 'alert' ? <AlertTriangle className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    </div>
                    <span className="text-[10px] font-medium opacity-50">Co-Pilot</span>
                </div>
            )}

            {/* Bubble */}
            <div
                className={cn(
                    "px-4 py-3 shadow-sm relative group",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                        : isSystem
                            ? "bg-muted/50 text-muted-foreground text-xs px-2 py-1 rounded-full border border-border/50"
                            : "bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl rounded-bl-sm",
                    message.isStreaming && "animate-pulse-subtle"
                )}
                onClick={handleContentClick}
            >
                {isSystem ? (
                    <span>{message.content}</span>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                        <MarkdownRenderer content={message.content} />
                    </div>
                )}

                {/* Interactive Action Footer */}
                {message.type === 'action_request' && (
                    <div className="mt-3 pt-2 border-t border-border/10 flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50 transition-colors">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            Criar Tarefa
                        </Button>
                    </div>
                )}
            </div>

            {/* Timestamp */}
            {!isSystem && (
                <span className="text-[10px] text-muted-foreground px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            )}
        </div>
    );
});
