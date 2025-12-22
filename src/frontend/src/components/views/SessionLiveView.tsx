import { useSessionController } from '@/hooks/useSessionController';
import { LiveSessionLayout } from '@/components/sessions/LiveSessionLayout';
import { SessionReviewLayout } from '@/components/sessions/SessionReviewLayout';
import { useMeetingStore } from '@/store/meetingStore';

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

    // Loading State
    if (isLoading || (readOnly && !session)) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-50/50 dark:bg-black/20">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative h-12 w-12">
                        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-gray-200 opacity-25 dark:border-gray-800"></div>
                        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-l-blue-600 border-t-transparent dark:border-l-blue-500"></div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Loading Session...</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Restoring state and connecting to services</p>
                    </div>
                </div>
            </div>
        );
    }

    // Model Loading Overlay (Global for this view)
    // SOTA: Could be moved to a Context or Toast, but fine here for now.
    if (isModelLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-50/50 dark:bg-black/20">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative h-12 w-12">
                        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-indigo-200 opacity-50 dark:border-indigo-900"></div>
                        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-l-indigo-600 border-t-transparent dark:border-l-indigo-500"></div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Initializing AI Models</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{modelLoadingMessage || "Loading..."}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Main Render Logic
    if (readOnly && session) {
        return <SessionReviewLayout session={session} projectId={projectId} />;
    }

    return <LiveSessionLayout projectId={projectId} />;
}
