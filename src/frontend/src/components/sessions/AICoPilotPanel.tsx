import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Maximize2, Eraser, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore, type MeetingState } from "@/store/meetingStore";
import { useAICoPilotEngine } from "@/hooks/useAICoPilotEngine";
import { MessageBubble } from "./copilot/MessageBubble";
import { QuickActions } from "./copilot/QuickActions";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AICoPilotPanel() {
    // Strict Selectors (SOTA: Separate Action/State)
    const isRecording = useMeetingStore((state: MeetingState) => state.isRecording);
    const setFocusedBlockId = useMeetingStore((state: MeetingState) => state.setFocusedBlockId);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        messages,
        isTyping,
        connectionStatus,
        retryCount,
        quickActions,
        sendUserMessage,
        clearHistory
    } = useAICoPilotEngine();

    const handleSend = (text: string) => {
        if (!text.trim()) return;
        sendUserMessage(text);
        if (inputRef.current) inputRef.current.value = "";
    };

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Keyboard shortcut to focus input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <Card className="flex flex-col h-auto border-border bg-card/40 backdrop-blur-xl overflow-visible shadow-sm transition-all duration-500 hover:shadow-md hover:bg-card/50">
            {/* SOTA Header */}
            <CardHeader className="p-3 border-b border-border/40 bg-muted/10 shrink-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/10 shadow-inner">
                        <Bot className={cn(
                            "h-4 w-4 text-indigo-500 transition-all duration-1000",
                            isTyping && "animate-pulse delay-75",
                            isRecording && "text-emerald-500" // "Alive" state
                        )} />
                        {isTyping && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent font-bold tracking-tight">
                            Proactive Hub
                        </span>
                        <div className="flex items-center gap-1.5 h-3">
                            <div className={cn(
                                "h-1.5 w-1.5 rounded-full transition-colors duration-500",
                                connectionStatus === 'connected' ? "bg-emerald-500" :
                                    connectionStatus === 'connecting' ? "bg-amber-500 animate-pulse" : "bg-red-500"
                            )} />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                {connectionStatus === 'connected' ? 'Online' : connectionStatus}
                            </span>
                        </div>
                    </div>
                </CardTitle>

                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-background/50" onClick={clearHistory}>
                                    <Eraser className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Clear Context</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-background/50">
                                    <Maximize2 className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Focus Mode</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>

            {/* Conversation Area */}
            <CardContent className="h-auto flex flex-col p-0 overflow-visible relative">
                {/* Connection Alert Overlay */}
                <AnimatePresence>
                    {connectionStatus === 'disconnected' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-destructive/10 border-b border-destructive/20 flex items-center justify-center gap-2 p-1 text-[10px] text-destructive font-medium"
                        >
                            <WifiOff className="h-3 w-3" /> Connection lost. Retrying ({retryCount})...
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-4">
                    <div className="flex flex-col min-h-full justify-end">
                        {/* Empty State / Welcome */}
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center flex-1 opacity-20 select-none pb-12">
                                <Bot className="h-16 w-16 mb-2" />
                                <p className="font-medium text-sm">AI Co-Pilot Ready</p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                                <MessageBubble
                                    message={msg}
                                    onDeepLinkClick={(id) => setFocusedBlockId(id)}
                                />
                            </motion.div>
                        ))}

                        {isTyping && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 text-muted-foreground text-xs p-2 ml-1"
                            >
                                <div className="flex gap-1">
                                    <span className="animate-bounce delay-0 h-1.5 w-1.5 bg-primary/40 rounded-full" />
                                    <span className="animate-bounce delay-150 h-1.5 w-1.5 bg-primary/40 rounded-full" />
                                    <span className="animate-bounce delay-300 h-1.5 w-1.5 bg-primary/40 rounded-full" />
                                </div>
                                <span className="text-[10px] font-medium opacity-70">Processing context...</span>
                            </motion.div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </div>

                {/* Interactive Input Area */}
                <div className="p-3 border-t border-border/40 bg-gradient-to-t from-background/80 to-background/20 backdrop-blur-md">

                    {/* Quick Suggestion Chips */}
                    <div className="mb-3">
                        <QuickActions
                            actions={quickActions}
                            onActionSelect={handleSend}
                            disabled={isTyping || connectionStatus !== 'connected'}
                        />
                    </div>

                    <div className="relative group">
                        <Input
                            ref={inputRef}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend(e.currentTarget.value)}
                            placeholder={connectionStatus === 'connected' ? "Ask AI Co-Pilot... (⌘K)" : "Connecting..."}
                            disabled={connectionStatus !== 'connected'}
                            className="pr-12 h-11 py-3 text-sm rounded-2xl border-white/10 bg-white/5 shadow-inner focus:bg-background/60 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
                        />
                        <Button
                            size="icon"
                            className="absolute right-1 top-1 h-9 w-9 rounded-xl shrink-0 transition-transform active:scale-95"
                            onClick={() => inputRef.current && handleSend(inputRef.current.value)}
                            disabled={connectionStatus !== 'connected'}
                        >
                            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

