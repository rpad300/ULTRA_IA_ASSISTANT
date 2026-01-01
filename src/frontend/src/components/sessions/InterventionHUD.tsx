import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Lightbulb, X, ExternalLink, Pin, Share2, Check } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';
import { toBrand } from '@/types/slices/intelligence';
import type { OracleInsight, LiveSummaryItem } from '@/store/slices/intelligenceSlice';

// Sound placeholder - in a real app, import this or use a hook
const playInterventionSound = () => {
    try {
        // Frequency sweep for a "high-tech" ping
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

export const InterventionHUD: React.FC = () => {
    // Selectors for performance and avoiding lint errors
    const lastInsight = useMeetingStore(s => s.lastInsight);
    const setLastInsight = useMeetingStore(s => s.setLastInsight);
    const liveSummary = useMeetingStore(s => s.liveSummary);
    const updateLiveSummary = useMeetingStore(s => s.updateLiveSummary);

    const [queue, setQueue] = useState<OracleInsight[]>([]);
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(100);
    const [showCopied, setShowCopied] = useState(false);

    const PROGRESS_DURATION = 10000; // 10s

    // Track the current Insight ID to prevent duplicates if store updates repeatedly
    const processedInsightIdRef = useRef<string | null>(null);
    const timerRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number>(0);
    const remainingTimeRef = useRef<number>(PROGRESS_DURATION);

    // 1. Queue Management: Listen for store updates
    useEffect(() => {
        if (lastInsight && lastInsight.id !== processedInsightIdRef.current) {
            processedInsightIdRef.current = lastInsight.id;

            // Add to queue
            setQueue(prev => {
                // Avoid duplicates in queue just in case
                if (prev.some(i => i.id === lastInsight.id)) return prev;
                return [...prev, lastInsight];
            });

            // Trigger sound for conflicts
            if (lastInsight.typeString === 'conflict') {
                playInterventionSound();
            }
        }
    }, [lastInsight]);

    // Active Item is the first in queue
    const activeItem = queue[0];
    const nextItemCount = queue.length - 1;

    // 2. Timer Logic
    useEffect(() => {
        if (!activeItem) {
            setProgress(100);
            remainingTimeRef.current = PROGRESS_DURATION;
            return;
        }

        if (isHovered) {
            // Pause: cancel animation frame but keep state
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
            return;
        }

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTimeRef.current;
            const currentPeriodProgress = Math.max(0, remainingTimeRef.current - elapsed);

            const percentage = (currentPeriodProgress / PROGRESS_DURATION) * 100;
            setProgress(percentage);

            if (currentPeriodProgress <= 0) {
                dismissCurrent();
            } else {
                timerRef.current = requestAnimationFrame(animate);
            }
        };

        // Start or Resume
        startTimeRef.current = Date.now();
        timerRef.current = requestAnimationFrame(animate);

        return () => {
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
            // Save remaining time for resume ONLY if we were running (not hovered)
            if (!isHovered) {
                const elapsed = Date.now() - startTimeRef.current;
                remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
            }
        };
    }, [activeItem, isHovered]);

    const dismissCurrent = useCallback(() => {
        setQueue(prev => prev.slice(1));
        // Reset timer for next item
        remainingTimeRef.current = PROGRESS_DURATION;
        setProgress(100);
        setShowCopied(false);

        if (queue.length <= 1) {
            setLastInsight(null);
            processedInsightIdRef.current = null;
        }
    }, [queue.length, setLastInsight]);

    const handlePinToSummary = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeItem) return;

        const newItem: LiveSummaryItem = {
            id: `pinned-${Date.now()}`,
            text: activeItem.text,
            type: activeItem.typeString === 'conflict' ? 'action_item' : 'key_point',
            timestamp: toBrand<import('@/types/slices/intelligence').TimestampMs>(Date.now()),
            status: 'pending',
            confidence: activeItem.confidence || 0.85,
            isNew: true
        };

        updateLiveSummary({
            keyPoints: activeItem.typeString !== 'conflict' ? [...(liveSummary?.keyPoints || []), newItem] : liveSummary?.keyPoints,
            actionItems: activeItem.typeString === 'conflict' ? [...(liveSummary?.actionItems || []), newItem] : liveSummary?.actionItems
        });

        dismissCurrent();
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeItem) return;

        try {
            await navigator.clipboard.writeText(`${activeItem.typeString === 'conflict' ? '[CONFLICT] ' : '[INSIGHT] '} ${activeItem.text} (Confidence: ${Math.round((activeItem.confidence || 0) * 100)}%)`);
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Helper Styles
    const getStyles = (type: 'conflict' | 'solution') => {
        const isConflict = type === 'conflict';
        return {
            container: isConflict
                ? 'bg-gradient-to-br from-amber-50/95 to-red-50/95 dark:from-amber-950/80 dark:to-red-950/80 border-amber-500/30'
                : 'bg-gradient-to-br from-slate-50/95 to-indigo-50/95 dark:from-slate-950/80 dark:to-indigo-950/80 border-indigo-500/30',
            textAccent: isConflict ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-600 dark:text-cyan-300',
            progressColor: isConflict ? 'bg-amber-500/50' : 'bg-cyan-500/50',
            iconBg: isConflict ? 'bg-amber-100/50 dark:bg-amber-900/30' : 'bg-indigo-100/50 dark:bg-indigo-900/30',
            ariaLive: isConflict ? "assertive" : "polite"
        } as const;
    };

    return (
        <AnimatePresence mode="popLayout">
            {activeItem && (() => {
                const styles = getStyles(activeItem.typeString);
                const isConflict = activeItem.typeString === 'conflict';

                return (
                    <motion.div
                        key={activeItem.id}
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="fixed z-50 w-full max-w-md 
                               top-6 left-1/2 -translate-x-1/2 
                               md:top-6 md:bottom-auto 
                               bottom-6 md:left-1/2 md:-translate-x-1/2
                               px-4 md:px-0"
                        role="alert"
                        aria-live={styles.ariaLive}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        {/* Stack Effect for Queue */}
                        {nextItemCount > 0 && (
                            <div className="absolute top-2 left-2 right-2 h-full bg-white/20 dark:bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 -z-10 scale-95 translate-y-2 shadow-sm transition-all" />
                        )}
                        {nextItemCount > 1 && (
                            <div className="absolute top-4 left-4 right-4 h-full bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl border border-white/5 -z-20 scale-90 translate-y-4 shadow-sm transition-all" />
                        )}

                        {/* Main Card */}
                        <div className={`
                            relative overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl
                            ${styles.container}
                        `}>
                            {/* Glass Reflection */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

                            <div className="relative flex flex-col p-4 gap-3">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 rounded-lg ${styles.iconBg} backdrop-blur-md`}>
                                            {isConflict ? <AlertTriangle size={18} className={styles.textAccent} /> : <Lightbulb size={18} className={styles.textAccent} />}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-bold tracking-tight ${styles.textAccent}`}>
                                                {isConflict ? 'Intervention Required' : 'Oracle Insight'}
                                            </h4>
                                            {/* Confidence Meter */}
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="h-1 w-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${isConflict ? 'bg-amber-500' : 'bg-cyan-500'}`}
                                                        style={{ width: `${(activeItem.confidence || 0) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                                                    {Math.round((activeItem.confidence || 0) * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {/* Queue Counter if multiple */}
                                        {nextItemCount > 0 && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-black/5 dark:bg-white/10 rounded-full text-gray-600 dark:text-gray-300">
                                                +{nextItemCount}
                                            </span>
                                        )}
                                        <button
                                            onClick={dismissCurrent}
                                            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="pl-[2.6rem]">
                                    <p className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-100">
                                        {activeItem.text}
                                    </p>

                                    {activeItem.sourceLink && (
                                        <a
                                            href={activeItem.sourceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold hover:underline ${styles.textAccent}`}
                                        >
                                            <ExternalLink size={10} />
                                            Source Evidence
                                        </a>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="flex items-center justify-end gap-2 mt-1 pl-[2.6rem]">
                                    <button
                                        onClick={handleShare}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg 
                                                 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                    >
                                        {showCopied ? <Check size={12} className="text-green-500" /> : <Share2 size={12} />}
                                        {showCopied ? 'Copied' : 'Share'}
                                    </button>
                                    <button
                                        onClick={handlePinToSummary}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm
                                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700
                                                 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
                                    >
                                        <Pin size={12} />
                                        Pin to Summary
                                    </button>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-200/50 dark:bg-gray-700/50">
                                <motion.div
                                    className={`h-full ${styles.progressColor}`}
                                    style={{ width: `${progress}%` }}
                                    transition={{ ease: "linear", duration: 0 }} // Controlled by state loop
                                />
                            </div>
                        </div>
                    </motion.div>
                );
            })()}
        </AnimatePresence>
    );
};
