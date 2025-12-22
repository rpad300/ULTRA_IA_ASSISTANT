import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMeetingStore } from "@/store/meetingStore";
import { workspaceApi, type Session } from "@/api/client";
import { toast } from "react-hot-toast";

export interface SessionController {
    sessionId: string | undefined;
    isLoading: boolean;
    session: Session | null;
    projectId: string;
    // Command Actions
    togglePause: () => void;
    // State
    isRecording: boolean;
    isPaused: boolean;
}

export function useSessionController(readOnly: boolean = false) {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);
    const [projectId, setProjectId] = useState<string>("");

    // Store Selectors
    const {
        isRecording,
        isPaused,
        pauseSession,
        resumeSession,
    } = useMeetingStore();

    // 1. Session ID Validation & Routing Protection
    useEffect(() => {
        // Quick loading simulation or instant if data is ready
        setIsLoading(false);
        if (!sessionId) {
            const timer = setTimeout(() => navigate(-1), 100);
            return () => clearTimeout(timer);
        }
    }, [sessionId, navigate]);

    // 2. Live Session Initialization
    useEffect(() => {
        if (!sessionId || readOnly) return;

        const store = useMeetingStore.getState();
        if (store.sessionId !== sessionId) {
            store.resetSession();
            useMeetingStore.setState({ sessionId });
        }

        // Cleanup on Unmount
        return () => {
            // SOTA Best Practice: 
            // Don't auto-stop on unmount to prevent data loss on refresh.
            // Just clear local timers if any.
            console.log('[useSessionController] Unmounting active session view');
        };
    }, [sessionId, readOnly]);

    // 3. Read-Only Data Fetching
    useEffect(() => {
        if (readOnly && sessionId) {
            const loadSessionData = async () => {
                try {
                    // Parallel fetch could be better here
                    const sessionData = await workspaceApi.getSession(sessionId);
                    setSession(sessionData);

                    if (sessionData?.thread_id) {
                        const thread = await workspaceApi.getThread(sessionData.thread_id);
                        if (thread?.project_id) {
                            setProjectId(thread.project_id);
                        }
                    }
                    // Load transcripts into store for playback
                    await useMeetingStore.getState().loadTranscripts(sessionId);
                } catch (error) {
                    console.error("Failed to load session details", error);
                    toast.error("Failed to load session data");
                }
            };
            loadSessionData();
        }
    }, [readOnly, sessionId]);

    const togglePause = useCallback(() => {
        if (isPaused) resumeSession();
        else pauseSession();
    }, [isPaused, resumeSession, pauseSession]);

    return {
        sessionId,
        isLoading,
        session,
        projectId,
        togglePause,
        isRecording,
        isPaused
    };
}
