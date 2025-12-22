import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/api/client";

interface MessageSearchProps {
    messages: Message[];
    onResultSelect?: (messageId: string) => void;
}

export function MessageSearch({ messages, onResultSelect }: MessageSearchProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredMessages = messages.filter(msg =>
        msg.content.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                setQuery("");
            }
            if (isOpen && filteredMessages.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, filteredMessages.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredMessages[selectedIndex]) {
                        onResultSelect?.(filteredMessages[selectedIndex].id);
                        setIsOpen(false);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredMessages, selectedIndex, onResultSelect]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                title="Search messages (⌘F)"
            >
                <Search className="h-3 w-3" />
                <span className="hidden sm:inline">Search messages</span>
            </button>
        );
    }

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    placeholder="Search messages... (ESC to close)"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setSelectedIndex(0);
                    }}
                    className="pl-9 pr-9 bg-card"
                />
                <button
                    onClick={() => {
                        setIsOpen(false);
                        setQuery("");
                    }}
                    className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                    {filteredMessages.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                            No messages found
                        </div>
                    ) : (
                        <div className="p-1">
                            {filteredMessages.map((msg, index) => (
                                <button
                                    key={msg.id}
                                    onClick={() => {
                                        onResultSelect?.(msg.id);
                                        setIsOpen(false);
                                        setQuery("");
                                    }}
                                    className={cn(
                                        "w-full text-left p-2 rounded-lg hover:bg-accent transition-colors",
                                        index === selectedIndex && "bg-accent"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {msg.role === 'user' ? 'You' : 'Assistant'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(msg.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm line-clamp-2">{msg.content}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

