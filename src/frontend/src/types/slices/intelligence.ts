/**
 * SOTA Domain-Driven Intelligence Schema (2025)
 * ---------------------------------------------
 * "The Single Source of Truth" for Ultra Assistant Intelligence.
 *
 * Features:
 * - Branded Types for strict ID safety (Zero-Cost Abstractions).
 * - Discriminated Unions for robust AutoActions.
 * - Universal Lineage for deep explainability and context tracking.
 * - Readonly Types for immutable state management.
 * - OKLCH Color Standards.
 */

// --- 1. SOTA Primitives (Branded Types) ---

export type Brand<K, T> = K & { __brand: T };

export type SessionId = Brand<string, 'SessionId'>;
export type BlockId = Brand<string, 'BlockId'>;
export type ParticipantId = Brand<string, 'ParticipantId'>;
export type ActionId = Brand<string, 'ActionId'>;
export type InsightId = Brand<string, 'InsightId'>;
export type ClusterId = Brand<string, 'ClusterId'>;
export type TimestampMs = Brand<number, 'TimestampMs'>; // Explicit Millisecond Precision

export type OKLCHColor = string; // e.g., "oklch(0.6 0.15 240)"

/**
 * Casting Helper
 * Use this to safely transform raw API strings into Branded Types.
 * Usage: const pid = toBrand<ParticipantId>("user-123");
 */
export const toBrand = <T>(value: any): T => value as T;


// --- 2. Universal Lineage & Base Entity ---

export interface UniversalLineage {
    blockId?: BlockId;
    audioStart?: TimestampMs;
    audioEnd?: TimestampMs;
    sourceFileId?: string; // For documents/uploads
}

export interface BaseAIEntity {
    id: string; // Usage specific ID (e.g. RiskId) but kept string for generic handling if needed, or refine per subtype
    timestamp: TimestampMs;
    confidence: number; // 0.0 - 1.0
    isArchived?: boolean;
    lineage?: UniversalLineage;
    reasoning?: string; // Explainable AI (Why was this generated?)
}


// --- 3. Domain Models ---

// --- 3.1 Topic & Chapter Engine ---

export interface DensityPoint {
    readonly position: number; // 0.0 - 1.0 (relative to cluster duration)
    readonly intensity: number; // 0.0 - 1.0
    readonly speakerId: ParticipantId;
}

export interface TopicCluster extends BaseAIEntity {
    id: ClusterId; // Explicit Override
    name: string;
    blocks: readonly BlockId[];
    startTime: TimestampMs;
    endTime: TimestampMs;
    sentiment: 'positive' | 'neutral' | 'negative';
    keywords: readonly string[];
    participantCount: number;

    // Chapter Engine SOTA Fields
    summary?: string; // AI TL;DR
    dominantSpeakerId?: ParticipantId;
    densityMap?: readonly DensityPoint[]; // Sparkline visualization
    temperature?: 'tense' | 'productive' | 'neutral' | 'ambiguous';

    // Hierarchical Semantics
    parentTopicId?: ClusterId;
    subTopicIds?: readonly ClusterId[];
}

// --- 3.2 Cross-Meeting Intelligence ---

export interface RelatedMeetingExcerpt {
    meetingId: SessionId;
    meetingTitle: string;
    date: TimestampMs;
    snippet: string;
    contextId?: string;
}

export interface CrossMeetingPattern extends BaseAIEntity {
    type: 'pattern' | 'contradiction' | 'trend' | 'relationship' | 'sentiment_shift';
    description: string;

    // Pattern Specifics
    relatedMeetings?: readonly RelatedMeetingExcerpt[];
    sentimentTrend?: readonly number[]; // Immutable trend data [-1, 1]

    // Contradiction Resolution
    contradictionSeverity?: 'critical' | 'moderate' | 'low';
    resolutionScript?: string;

    // Lineage & Metadata
    affectedContacts?: readonly ParticipantId[];
    relatedTopics?: readonly string[];
}


// --- 3.3 AutoActions (Discriminated Unions) ---

export type AutoActionType = 'create_task' | 'send_email' | 'schedule_followup' | 'update_crm' | 'generate_document';

export interface CreateTaskData {
    title: string;
    priority: 'high' | 'medium' | 'low';
    assigneeId?: ParticipantId;
    dueDate?: string; // ISO String for external systems
    platform?: 'jira' | 'linear' | 'asana' | 'tasks';
}

export interface EmailData {
    to: readonly string[];
    subject: string;
    body: string;
    isDraft: boolean;
}

export interface CrmUpdateData {
    contactId: string;
    field: string;
    value: string;
    system: 'salesforce' | 'hubspot' | 'pipedrive';
}

export interface AutoAction extends BaseAIEntity {
    id: ActionId;
    type: AutoActionType;
    status: 'pending' | 'approved' | 'executed' | 'rejected';
    description: string;
    preview?: string;

    // Discriminated Union for Data
    data:
    | { type: 'create_task'; content: CreateTaskData }
    | { type: 'send_email'; content: EmailData }
    | { type: 'update_crm'; content: CrmUpdateData }
    | { type: 'schedule_followup'; content: any } // Define as needed
    | { type: 'generate_document'; content: any }; // Define as needed
}

// Keep legacy wrapper if needed for compatibility with old code accessing 'data' directly without type check
// BUT we prefer strictness. Note: User prompt asked for "Substitui o campo data: any por uma Discriminated Union".
// To unify the interface, we can do this:
export type DetectedActionData =
    | CreateTaskData
    | EmailData
    | CrmUpdateData;


// --- 3.4 Live Governance & Decisions ---

/**
 * Represents a key item extracted live.
 * Extends BaseAIEntity for lineage/confidence.
 */
export interface LiveSummaryItem extends BaseAIEntity {
    text: string;
    type: 'key_point' | 'decision' | 'action_item';
    status: 'pending' | 'confirmed' | 'rejected';

    // SOTA Decision Governance
    verifiedBy?: ParticipantId;
    verificationTimestamp?: TimestampMs;

    assignee?: ParticipantId;
    dueDate?: string; // ISO

    // UI Flags
    isNew?: boolean; // Client-side hydration flag
}

export interface LiveSummary {
    keyPoints: readonly LiveSummaryItem[];
    decisions: readonly LiveSummaryItem[];
    actionItems: readonly LiveSummaryItem[];
    lastUpdated: TimestampMs;
    executiveOverview?: {
        context: string;
        keyPoints: readonly string[];
        conclusion: string;
    };
}


// --- 3.5 Relationship & Political IQ ---

export interface InfluenceMetrics {
    supportCount: number;
    challengeCount: number;
}

export interface RelationshipInsight extends BaseAIEntity { // id can be composite p1_p2
    participant1: ParticipantId;
    participant2: ParticipantId;
    relationshipType: 'collaborative' | 'conflict' | 'neutral' | 'influential';
    strength: number; // 0-100
    volatility: number; // 0.0 (Stable) - 1.0 (Volatile)
    color?: OKLCHColor;
    trend?: 'increasing' | 'decreasing' | 'stable';

    interactions: number;
    lastInteraction: TimestampMs;

    // Political IQ
    influenceMetrics: InfluenceMetrics;

    patterns: readonly {
        name: string;
        description: string;
        evidenceBlockId?: BlockId;
        timestamp: TimestampMs;
    }[];
}


// --- 3.6 Other Intelligence Types (Updated to SOTA) ---

export interface Insight extends BaseAIEntity {
    type: 'oracle' | 'risk' | 'coaching' | 'flow' | 'conflict';
    summary: string;
}

export interface Risk extends BaseAIEntity {
    summary: string;
    severity: 'low' | 'medium' | 'high';
}

export interface CoachingInsight extends BaseAIEntity {
    type: 'tone' | 'pace' | 'question' | 'interruption' | 'silence' | 'assertiveness';
    severity: 'good' | 'warning' | 'critical';
    message: string;
    suggestion?: string;
}

export interface DetectedAction extends BaseAIEntity { // Generic/Legacy container, replaced mostly by AutoAction but kept for flexibility
    text: string;
    confirmed?: boolean;
    taskId?: string; // External ID

    suggestedAssigneeId?: ParticipantId;
    suggestedDueDate?: string;
    priority?: 'high' | 'medium' | 'low';

    relatedTool?: 'jira' | 'notion' | 'linear' | 'tasks';
}

export interface FlowPrediction extends BaseAIEntity {
    predictedTopic: string;
    estimatedTime: number; // seconds
}

export interface PredictiveQuestion extends BaseAIEntity {
    question: string;
    context: string;
    priority: 'high' | 'medium' | 'low';
    category: 'risk' | 'clarification' | 'follow-up' | 'strategic';
    isPinned?: boolean;
}

export interface EmotionState extends BaseAIEntity {
    participantId: ParticipantId;
    emotion: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'engaged' | 'bored';
}


export interface MeetingQualityScore {
    overall: number;
    engagement: number;
    clarity: number;
    efficiency: number;
    participation: number;
    decisionVelocity: number;
    lastUpdated: TimestampMs;
}

export interface ScoreHistoryPoint {
    overall: number;
    timestamp: TimestampMs;
}


export interface MeetingHealth {
    engagement: number;
    clarity: number;
    progress: number;
    participation: number;
    overall: number;
}

export interface Clarification extends BaseAIEntity {
    suggestion: string;
    context?: string;
}

export interface ConflictDetection extends BaseAIEntity {
    participants: readonly ParticipantId[];
    severity: 'low' | 'medium' | 'high';
    summary: string;
    resolutionSuggestions: readonly string[];
}

export interface PrepDocument {
    id: string; // Document ID
    sessionId: SessionId;
    participantInsights: readonly {
        name: string;
        insights: readonly string[];
        likelyQuestions: readonly string[];
        historicalAttention: readonly string[];
        color: OKLCHColor;
    }[];
    likelyTopics: readonly {
        topic: string;
        confidence: number;
        status: 'pending' | 'discussed';
    }[];
    suggestedQuestions: readonly {
        question: string;
        context: string;
        priority: 'high' | 'medium';
    }[];
    risks: readonly {
        risk: string;
        probability: number;
        battleCard: string;
        status: 'active' | 'mitigated';
    }[];
    context: string;
    generatedAt: TimestampMs;
    lastUpdated: TimestampMs;
}

export interface OracleInsight extends BaseAIEntity {
    typeString: 'conflict' | 'solution'; // Renamed to avoid reserved word conflict if extending BaseAIEntity
    text: string;
    sourceLink?: string;
    relatedFact?: string;
}

export interface HighlightGroup {
    id: string;
    name: string;
    blockIds: readonly BlockId[];
    category: 'decision' | 'action' | 'risk' | 'insight' | 'question' | 'other';
    createdAt: TimestampMs;
}
