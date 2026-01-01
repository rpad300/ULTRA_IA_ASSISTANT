import { useSessionController } from '@/hooks/useSessionController';
import { LiveSessionLayout } from '@/components/sessions/LiveSessionLayout';
import { SessionReviewLayout } from '@/components/sessions/SessionReviewLayout';
import { useMemo } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { SessionLoading } from '@/components/sessions/SessionLoading';
import { AnimatePresence, motion } from 'framer-motion';

interface SessionLiveViewProps {
    readOnly?: boolean;
}

export function SessionLiveView({ readOnly = false }: SessionLiveViewProps) {
    const {
        isLoading,
        session,
        projectId
    } = useSessionController(readOnly);

    const { isModelLoading, modelLoadingMessage } = useMeetingStore();

    // Determine State
    // 1. Initial Load: Controller is loading or (ReadOnly mode + no session data yet)
    // 2. Model Warming: Store flags model loading (Live only usually)
    // 3. Ready: Everything loaded

    // We determine the key for AnimatePresence to trigger transitions
    const viewState = useMemo(() => {
        if (isLoading || (readOnly && !session)) return 'loading';
        if (isModelLoading) return 'model-warming';
        if (readOnly && session) return 'review';
        return 'live';
    }, [isLoading, readOnly, isModelLoading, session]);

    console.log('[SessionLiveView] viewState:', viewState, { isLoading, readOnly, isModelLoading });

    return (
        <div
            className="relative w-full min-h-screen bg-background"
        >
            <AnimatePresence mode="wait">
                {viewState === 'loading' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute inset-0 z-50"
                    >
                        <SessionLoading
                            message="Restoring Neural Session..."
                            isModelLoading={false}
                            onRetry={() => window.location.reload()}
                        />
                    </motion.div>
                )}

                {viewState === 'model-warming' && (
                    <motion.div
                        key="model-warming"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="absolute inset-0 z-50"
                    >
                        <SessionLoading
                            message={modelLoadingMessage || "Initializing Models..."}
                            isModelLoading={true}
                        />
                    </motion.div>
                )}

                {viewState === 'review' && session && (
                    <motion.div
                        key="review"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "circOut" }}
                        className="absolute inset-0 h-full w-full"
                    >
                        {/* Announce State Change */}
                        <div className="sr-only" role="status" aria-live="polite">
                            Session loaded in Review Mode.
                        </div>
                        <SessionReviewLayout session={session} projectId={projectId} />
                    </motion.div>
                )}

                {viewState === 'live' && (
                    <motion.div
                        key="live"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "circOut" }}
                        className="relative w-full h-auto"
                    >
                        {/* Announce State Change */}
                        <div className="sr-only" role="status" aria-live="polite">
                            Session loaded. Models ready. Live System Active.
                        </div>
                        <LiveSessionLayout projectId={projectId} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
