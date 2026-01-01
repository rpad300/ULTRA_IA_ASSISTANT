import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionLoadingProps {
    message?: string;
    isModelLoading?: boolean;
    onRetry?: () => void;
}

export function SessionLoading({ message = "Loading Session...", isModelLoading = false, onRetry }: SessionLoadingProps) {
    const [displayedMessage, setDisplayedMessage] = useState("");
    const [showTimeout, setShowTimeout] = useState(false);

    // Typewriter Effect
    useEffect(() => {
        let currentIndex = 0;
        setDisplayedMessage("");
        const text = message;

        const interval = setInterval(() => {
            if (currentIndex < text.length) {
                setDisplayedMessage(prev => prev + text[currentIndex]);
                currentIndex++;
            } else {
                clearInterval(interval);
            }
        }, 30); // Speed of typing

        return () => clearInterval(interval);
    }, [message]);

    // Timeout Fallback (10s)
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowTimeout(true);
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-background">
            {/* 1. Mimicked Skeleton Layout (Background Layer) */}
            <div className="absolute inset-0 z-0 flex flex-col p-3 gap-3 opacity-30 select-none pointer-events-none overflow-hidden">
                {/* Header Skeleton */}
                <div className="shrink-0 h-16 w-full bg-muted/20 rounded-xl animate-pulse" />

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
                    {/* Transcript Skeleton (Left - col-span-7) */}
                    <div className="col-span-1 lg:col-span-7 bg-muted/20 rounded-xl animate-pulse flex flex-col p-4 gap-4">
                        <div className="h-8 w-1/3 bg-muted/30 rounded" />
                        <div className="space-y-4 mt-2">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-muted/30 shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-1/4 bg-muted/30 rounded" />
                                        <div className="h-20 w-full bg-muted/30 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel Skeleton (Right - col-span-5) */}
                    <div className="col-span-1 lg:col-span-5 flex flex-col gap-3">
                        {/* Participants Mock */}
                        <div className="flex-1 bg-muted/20 rounded-xl animate-pulse" />
                        {/* Summary Mock */}
                        <div className="flex-1 bg-muted/20 rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>

            {/* 2. Neural Overlay (Foreground Layer) */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">

                {/* Glass Card Container */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative bg-card/10 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl p-12 flex flex-col items-center max-w-lg w-full shadow-2xl overflow-hidden"
                >
                    {/* Mesh Gradient Background (Subtle) */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-blue-500/10 animate-gradient-xy opacity-50" />

                    {/* Neural Pulse Visualization */}
                    <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                        {/* Core Orb */}
                        <motion.div
                            className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 blur-md z-10"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.8, 1, 0.8]
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                        {/* Outer Rings */}
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                className="absolute inset-0 rounded-full border border-indigo-500/30"
                                initial={{ scale: 1, opacity: 1 }}
                                animate={{ scale: 2, opacity: 0 }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.6,
                                    ease: "easeOut"
                                }}
                            />
                        ))}
                    </div>

                    {/* Text Content */}
                    <div className="relative z-20 text-center space-y-4">
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-white">
                            {isModelLoading ? "Initializing Neural Core" : "Establishing Connection"}
                        </h2>

                        <div className="h-6 flex items-center justify-center">
                            <span className="font-mono text-sm text-indigo-200/80 tracking-wider">
                                {displayedMessage}<span className="animate-pulse">_</span>
                            </span>
                        </div>
                    </div>

                    {/* Timeout / Retry Action */}
                    <AnimatePresence>
                        {showTimeout && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 flex flex-col items-center gap-3"
                            >
                                <p className="text-xs text-muted-foreground">Taking longer than usual...</p>
                                <div className="flex items-center gap-3">
                                    {onRetry && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={onRetry}
                                            className="bg-white/5 border-white/10 hover:bg-white/10 text-xs gap-2"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Retry
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => console.log('Diagnostics requested')}
                                        className="text-xs text-muted-foreground hover:text-indigo-300 gap-2"
                                    >
                                        <Activity className="w-3 h-3" />
                                        Diagnostics
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* SR Announcement */}
            <div className="sr-only" role="status" aria-live="polite">
                {message}
            </div>
        </div>
    );
}
