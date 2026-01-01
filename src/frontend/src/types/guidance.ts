import type { Message } from "@/api/client";
import type { Participant } from "@/store/types";
import type { ActionConfig } from "@/types/slices/ui";
import type {
    MeetingQualityScore,
    RelationshipInsight,
    DetectedAction
} from "@/types/slices/intelligence";
import type { TranscriptBlock } from "@/types/slices/transcript";

/**
 * ULTRA ASSISTANT GUIDANCE ENGINE (SOTA 2025)
 * -------------------------------------------
 * A Context-Based Inference Engine for Strategic Meeting Intelligence.
 * 
 * Features:
 * - Discriminated Unions for Insight Type Safety.
 * - Branded Types for ID Collision Prevention.
 * - Weighted Rule Execution & Cooldown Management.
 * - Deep Context Awareness (Quality, Relationships, Lineage).
 */

// --- 1. Branded Types & Helpers ---

export type GuidanceId = string & { readonly __brand: 'GuidanceId' };
export type RuleId = string & { readonly __brand: 'RuleId' };

export const toGuidanceId = (id: string): GuidanceId => id as GuidanceId;
export const toRuleId = (id: string): RuleId => id as RuleId;

// --- 2. Enums & Base Definitions ---

export type GuidanceCategory = 'strategic' | 'tactical' | 'interpersonal';
export type GuidancePriority = 'high' | 'medium' | 'low';
export type GuidanceImpact = 'high' | 'medium' | 'low'; // Visual Impact (e.g. Gold Glow vs Subtle)

// --- 3. Discriminated Union: Guidance Insights ---

interface BaseGuidanceInsight {
    id: GuidanceId;
    priority: GuidancePriority;
    impact: GuidanceImpact;
    title: string;
    message: string;
    context?: string; // Additional context (e.g. "Mentioned 2 mins ago")
    timestamp: number;
    dismissed?: boolean;
    confidence?: number; // 0-100

    // Explainability
    reasoningChain?: string[]; // "1. Mentioned Deadline -> 2. No Date Set -> 3. Suggest Date"

    // Executable Guidance (The "Tool" Aspect)
    actions?: ActionConfig[];
}

export interface BehaviorInsight extends BaseGuidanceInsight {
    type: 'behavior';
    targetParticipantId: string;
    behaviorMetric: 'speaking_speed' | 'interruptions' | 'monologue';
}

export interface QuestionInsight extends BaseGuidanceInsight {
    type: 'question';
    scriptSource?: string; // Where did this question come from? (e.g. "Sales Playbook v2")
}

export interface GeneralInsight extends BaseGuidanceInsight {
    type: 'warning' | 'suggestion' | 'response' | 'clarification';
}

export type GuidanceInsight = BehaviorInsight | QuestionInsight | GeneralInsight;

// --- 4. Deep Knowledge Context ---

export interface ExtendedMessage extends Message {
    thread_id?: string;
}

export interface GuidanceContext {
    // Immutable History Window
    transcriptBlocks: readonly TranscriptBlock[];
    recentActions: readonly DetectedAction[]; // Don't suggest what's already done

    // Live State
    participants: Participant[];
    messages: ExtendedMessage[];
    activeRelationshipInsights: RelationshipInsight[];
    meetingQuality: MeetingQualityScore | null;

    // Temporal Context
    lastDecisionTimestamp: number;
    now: number; // For diffing

    // NLP Context
    recentText: string;
    recentSentiment: ('positive' | 'negative' | 'neutral')[];
    threadContext: string;
    selectedThreadId: string | null;

    // Flags
    detectedActions: any[]; // Legacy, prefer recentActions typed
    risks: any[];
    clarifications: any[];
}

// --- 5. Inference Rules ---

export interface GuidanceRule {
    id: RuleId;
    name: string;
    description?: string;

    // Logic Configuration
    category: GuidanceCategory;
    priorityWeight: number; // 1-100. Higher wins conflicts.
    cooldownPeriod: number; // Seconds before re-triggering.
    maxTriggersPerSession?: number; // E.g., only one "Icebreaker" per session.

    // Performance Filter
    matchKeywords?: string[]; // Pre-filter: only run if these exist in recentText.

    // Inference Function
    condition: (context: GuidanceContext) => boolean;
    generate: (context: GuidanceContext) => GuidanceInsight | GuidanceInsight[];
}
