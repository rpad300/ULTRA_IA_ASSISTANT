import { useState, useEffect, useMemo } from 'react';
import { workspaceApi } from '@/api/client';
import { useMeetingStore } from '@/store/meetingStore';

// Types
export interface EnrichedTask {
    id: string;
    title: string;
    status: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: Date;
    isRelevant: boolean;
    relevanceReason?: string;
}

export interface EnrichedEmail {
    id: string;
    subject: string;
    from: string;
    aiSummary: string; // The "TL;DR"
    date: Date;
    isRelevant: boolean;
}

export interface EnrichedDecision {
    id: string;
    text: string;
    meetingId: string;
    meetingTitle: string; // For lineage
    date: Date;
    isRelevant: boolean;
}

// Mock Data Generators for missing APIs
const MOCK_Decisions: EnrichedDecision[] = [
    { id: 'd1', text: "Adotar OKLCH para o sistema de cores", meetingId: 'session-101', meetingTitle: 'Design Review Q3', date: new Date(Date.now() - 86400000 * 2), isRelevant: false },
    { id: 'd2', text: "Migrar para Supabase", meetingId: 'session-99', meetingTitle: 'Arch Sync', date: new Date(Date.now() - 86400000 * 5), isRelevant: false }
];

const MOCK_Emails: EnrichedEmail[] = [
    { id: 'e1', subject: "Atualização de Prazos Q4", from: "Sofia Rocha", aiSummary: "Prazo final adiado para 15 de Dezembro devido a atrasos no backend.", date: new Date(Date.now() - 3600000 * 4), isRelevant: false },
    { id: 'e2', subject: "Feedback do Cliente (Alpha)", from: "João Silva", aiSummary: "Cliente satisfeito, mas pede modo escuro nativo urgente.", date: new Date(Date.now() - 3600000 * 24), isRelevant: false }
];

// Cache storage (Simple in-memory for session)
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30000; // 30 seconds

export function useContextData(filters: { threadId?: string; companyId?: string; projectId?: string }) {
    const { transcriptBlocks } = useMeetingStore();

    const [tasks, setTasks] = useState<EnrichedTask[]>([]);
    const [emails] = useState<EnrichedEmail[]>(MOCK_Emails);
    const [decisions] = useState<EnrichedDecision[]>(MOCK_Decisions);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetching Logic with "SWR-like" caching
    useEffect(() => {
        const fetchContext = async () => {
            setIsLoading(true);
            setError(null);

            const cacheKey = `tasks-${JSON.stringify(filters)}`;
            const cached = cache[cacheKey];

            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                setTasks(cached.data);
                setIsLoading(false);
                return;
            }

            try {
                // Fetch real tasks
                const rawTasks = await workspaceApi.getTasks({
                    status: 'open',
                    ...filters
                });

                // Transform to EnrichedTask (initial)
                const mappedTasks: EnrichedTask[] = rawTasks.slice(0, 5).map((t: any) => ({
                    id: t.id,
                    title: t.description || t.title || "Untitled Task",
                    status: t.status,
                    priority: t.priority || 'medium',
                    dueDate: t.due_date ? new Date(t.due_date) : undefined,
                    isRelevant: false
                }));

                // Update Cache
                cache[cacheKey] = { data: mappedTasks, timestamp: Date.now() };
                setTasks(mappedTasks);
            } catch (err) {
                console.error("Failed to fetch context data", err);
                setError("Failed to load ecosystem data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchContext();
    }, [filters.threadId, filters.companyId, filters.projectId]);

    // 2. Smart Relevance Engine
    // Re-runs whenever transcriptBlocks changes (throttled effectively by React batching or can be debounced)
    // We compute this wrapper to avoid mutating the source state directly
    const contextData = useMemo(() => {
        if (!transcriptBlocks || transcriptBlocks.length === 0) {
            return { tasks, emails, decisions };
        }

        // Get last 5 blocks text
        const recentText = transcriptBlocks.slice(-5).map(b => b.text.toLowerCase()).join(' ');

        const calculateRelevance = (text: string): boolean => {
            // Simple keyword matching for now (SOTA would use embeddings)
            // Tokenize text and check if significant tokens appear in recent transcript
            const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 3);
            if (tokens.length === 0) return false;

            // Check intersection
            const matchCount = tokens.filter(token => recentText.includes(token)).length;
            return matchCount >= 1; // Threshold
        };

        const processedTasks = tasks.map(t => {
            const isRelevant = calculateRelevance(t.title);
            return { ...t, isRelevant };
        }).sort((a, b) => (Number(b.isRelevant) - Number(a.isRelevant))); // Relevant first

        const processedEmails = emails.map(e => {
            const isRelevant = calculateRelevance(e.subject + " " + e.aiSummary);
            return { ...e, isRelevant };
        }).sort((a, b) => (Number(b.isRelevant) - Number(a.isRelevant)));

        const processedDecisions = decisions.map(d => {
            const isRelevant = calculateRelevance(d.text);
            return { ...d, isRelevant };
        }).sort((a, b) => (Number(b.isRelevant) - Number(a.isRelevant)));

        return {
            tasks: processedTasks,
            emails: processedEmails,
            decisions: processedDecisions
        };

    }, [tasks, emails, decisions, transcriptBlocks]);

    return {
        ...contextData,
        isLoading,
        error,
        refresh: () => {
            // Invalidate cache for this key manually if needed
            const cacheKey = `tasks-${JSON.stringify(filters)}`;
            delete cache[cacheKey];
            // Trigger re-fetch (could be cleaner with separate trigger state, but filters change does it)
        }
    };
}
