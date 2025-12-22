
import { create } from 'zustand';
import { workspaceApi } from '@/api/client';

export interface ServiceStatus {
    status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
    latency_ms?: number;
    connected: boolean;
    error?: string;
    details?: any;
}

interface SystemState {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    services: {
        supabase: ServiceStatus;
        qdrant: ServiceStatus;
        gemini: ServiceStatus;
        drive: ServiceStatus;
        picovoice: ServiceStatus;
    };
    isLoading: boolean;
    lastChecked: Date | null;

    checkHealth: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
    status: 'unknown',
    services: {
        supabase: { status: 'unhealthy', connected: false },
        qdrant: { status: 'unhealthy', connected: false },
        gemini: { status: 'unhealthy', connected: false },
        drive: { status: 'unhealthy', connected: false },
        picovoice: { status: 'unknown', connected: false }
    },
    isLoading: false,
    lastChecked: null,

    checkHealth: async () => {
        set({ isLoading: true });
        try {
            const health = await workspaceApi.getSystemHealth();
            set({
                status: health.status as any,
                services: {
                    supabase: {
                        ...health.services.supabase,
                        status: health.services.supabase.status as any
                    },
                    qdrant: {
                        ...health.services.qdrant,
                        status: health.services.qdrant.status as any,
                        details: {
                            collection: health.services.qdrant.collection,
                            vectors: health.services.qdrant.vectors_count
                        }
                    },
                    gemini: {
                        ...health.services.gemini,
                        status: health.services.gemini.status as any,
                        details: { model: health.services.gemini.model }
                    },
                    drive: {
                        ...health.services.drive,
                        status: health.services.drive.status as any,
                        details: { user: health.services.drive.user }
                    },
                    picovoice: {
                        status: health.services?.picovoice?.status as any || 'unknown',
                        connected: health.services?.picovoice?.connected || false,
                        details: health.services?.picovoice?.details || {}
                    }
                },
                lastChecked: new Date(),
                isLoading: false
            });
        } catch (error) {
            console.error("Health check failed:", error);
            set({
                status: 'unhealthy',
                isLoading: false,
                // Keep previous service states or reset? Best to mark all disconnected on total failure
                services: {
                    supabase: { status: 'unhealthy', connected: false, error: "Backend unreachable" },
                    qdrant: { status: 'unhealthy', connected: false, error: "Backend unreachable" },
                    gemini: { status: 'unhealthy', connected: false, error: "Backend unreachable" },
                    drive: { status: 'unhealthy', connected: false, error: "Backend unreachable" },
                    picovoice: { status: 'unhealthy', connected: false, error: "Backend unreachable" }
                }
            });
        }
    }
}));
