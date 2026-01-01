
export interface ReasoningStep {
    id: string;
    description: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
    timestamp: number;
    type: 'rag' | 'tool' | 'logic';
    metadata?: Record<string, any>;
    contextBlockId?: string; // Deep link to transcript
}

export interface KnowledgeSource {
    id: string;
    name: string;
    status: 'searching' | 'matched' | 'reading' | 'analyzed';
    type: 'file' | 'folder' | 'url';
    fileId?: string;
    snippet?: string; // Hover preview text
    confidence?: number;
    timestamp: number;
}

export interface ActiveTool {
    tool: string;
    progress: 'idle' | 'invoking' | 'running' | 'completed' | 'failed';
    ui_hint: string;
    inputPreview?: string;
    isInterruptible?: boolean; // Can user stop this?
    startedAt: number;
}

export interface AgentSlice {
    // SOTA 2025 State
    ragStatus: 'idle' | 'analyzing_query' | 'fetching_context' | 'reading_files' | 'synthesizing';
    reasoningSteps: ReasoningStep[];
    knowledgeSources: KnowledgeSource[];
    activeTools: ActiveTool[];

    // Visual Drivers
    activityLevel: number; // 0.0 to 1.0 (calculated based on recent actions)
    lastUpdate: number;    // Heartbeat for staleness check
    isStale: boolean;      // True if no updates for >15s

    // Actions
    addReasoningStep: (description: string, type: ReasoningStep['type']) => void;
    updateSourceStatus: (source: Partial<KnowledgeSource> & { name: string }) => void; // Name as key if ID missing
    updateActiveTool: (tool: ActiveTool) => void;
    heartbeat: () => void;
    interruptAgent: () => void; // Stops current action
    resetAgentState: () => void;
    checkStaleState: () => void;
}
