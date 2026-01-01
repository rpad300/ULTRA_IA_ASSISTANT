import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMeetingStore, type MeetingState } from "@/store/meetingStore";
import { useShallow } from 'zustand/react/shallow';
import { workspaceApi, type Session } from "@/api/client";
import { toast } from "react-hot-toast";
import { useSessionTimer } from "./useSessionTimer";
import { socketManager } from "@/managers/TranscriptionSocketManager";

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

    // Activate Session Timer Logic
    useSessionTimer();

    // Store Selectors (Strict & SOTA Pattern)
    // Store Selectors (Strict & SOTA Pattern)
    const [isRecording, isPaused] = useMeetingStore(
        useShallow((state: MeetingState) => [state.isRecording, state.isPaused])
    );

    // Actions (Stable References)
    const { pauseSession, resumeSession } = useMeetingStore(
        useShallow((state: MeetingState) => ({
            pauseSession: state.pauseSession,
            resumeSession: state.resumeSession
        }))
    );

    // 1. Session ID Validation & Routing Protection
    useEffect(() => {
        setIsLoading(false);
        if (!sessionId) {
            const timer = setTimeout(() => navigate(-1), 100);
            return () => clearTimeout(timer);
        }
    }, [sessionId, navigate]);

    // 2. Live Session Initialization & Socket Management
    useEffect(() => {
        if (!sessionId || readOnly) return;

        const store = useMeetingStore.getState();

        // State Synchronization
        if (store.sessionId !== sessionId) {
            store.resetAll(); // Cleaner full reset
            useMeetingStore.setState({ sessionId });
        }

        // SOTA: Socket Lifecycle Management
        // Explicitly connect when entering a live session view
        console.log('[SessionController] Initializing Socket for:', sessionId);
        socketManager.connect(sessionId);

        // SOTA: Runtime State Revalidation (Recover from Refresh)
        // Check if session is actually active on backend
        workspaceApi.getSession(sessionId).then(sessionData => {
            setSession(sessionData);
            // SOTA: Use Thread Context for WebSocket Connectivity
            if (sessionData.thread_id) {
                // We update the store so AICoPilotEngine can connect to the correct thread channel
                useMeetingStore.setState({ threadId: sessionData.thread_id });
            }
            if (!sessionData.ended_at) {
                console.log('[SessionController] Session is open (not ended). Waiting for user to Resume/Start.');
                // User Request: Do NOT auto-start recording even if session is technically open.
                // useMeetingStore.setState({ isRecording: false }); // Default is false anyway via resetAll()

                // Optimistic Audio Check - if the backend is actively capturing, we might want to show that status,
                // but for now, we respect the "Manual Start" requirement strictly.
                // We'll let the user click "Start/Resume" which will sync up.
            }
        }).catch(e => {
            console.error('[SessionController] Failed to validate live session', e);
        });

        return () => {
            console.log('[SessionController] Unmounting active session view');
        };
    }, [sessionId, readOnly]);

    // 3. Read-Only Data Fetching
    useEffect(() => {
        if (readOnly && sessionId) {
            const loadSessionData = async () => {
                try {
                    const sessionData = await workspaceApi.getSession(sessionId);
                    setSession(sessionData);

                    if (sessionData?.thread_id) {
                        const thread = await workspaceApi.getThread(sessionData.thread_id);
                        if (thread?.project_id) {
                            setProjectId(thread.project_id);
                        }
                    }
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
