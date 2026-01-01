import { MeetingHealthScore } from "@/components/sessions/MeetingHealthScore";
import { LiveInsightsPane } from "@/components/sessions/LiveInsightsPane";
import { TopicClustersPane } from "@/components/sessions/TopicClustersPane";
import { SentimentAnalysisPane } from "@/components/sessions/SentimentAnalysisPane";
import { RealTimeCoaching } from "@/components/sessions/RealTimeCoaching";
import { PredictiveQuestions } from "@/components/sessions/PredictiveQuestions";
import { ConflictDetection } from "@/components/sessions/ConflictDetection";
import { EmotionDetection } from "@/components/sessions/EmotionDetection";
import { SmartReminders } from "@/components/sessions/SmartReminders";
import { SmartActionItems } from "@/components/sessions/SmartActionItems";
import { FlowPredictionPane } from "@/components/sessions/FlowPredictionPane";
import { AdvancedAnalyticsDashboard } from "@/components/sessions/AdvancedAnalyticsDashboard";
import { SmartHighlightingPane } from "@/components/sessions/SmartHighlightingPane";

import { AICoPilotPanel } from "@/components/sessions/AICoPilotPanel";
import { CrossMeetingIntelligence } from "@/components/sessions/CrossMeetingIntelligence";
import { PredictivePreparation } from "@/components/sessions/PredictivePreparation";
import { RelationshipIntelligence } from "@/components/sessions/RelationshipIntelligence";
import { VisualTimeline } from "@/components/sessions/VisualTimeline";

export type WidgetGroup = 'health' | 'ai-copilot' | 'coaching' | 'insights' | 'timeline' | 'analytics' | 'highlights' | 'quality' | 'preparation' | 'relationships';

export interface DashboardWidgetConfig {
    component: React.ComponentType<any>;
    id: string;
    group: WidgetGroup;
    title: string;
    description?: string;
    defaultVisible: boolean;
}

export const DASHBOARD_WIDGETS: Record<string, DashboardWidgetConfig> = {
    // Health & Emotion
    'health-score': { component: MeetingHealthScore, id: 'health-score', group: 'health', title: 'Health Score', defaultVisible: true },
    'sentiment': { component: SentimentAnalysisPane, id: 'sentiment', group: 'health', title: 'Sentiment', defaultVisible: true },
    'emotion': { component: EmotionDetection, id: 'emotion', group: 'health', title: 'Emotion', defaultVisible: true },

    // AI Co-Pilot
    'copilot': { component: AICoPilotPanel, id: 'copilot', group: 'ai-copilot', title: 'AI Co-Pilot', defaultVisible: true },
    'cross-meeting': { component: CrossMeetingIntelligence, id: 'cross-meeting', group: 'ai-copilot', title: 'Cross Meeting', defaultVisible: true },

    // Coaching
    'coaching': { component: RealTimeCoaching, id: 'coaching', group: 'coaching', title: 'Coaching', defaultVisible: true },
    'predictive-q': { component: PredictiveQuestions, id: 'predictive-q', group: 'coaching', title: 'Predictive Questions', defaultVisible: true },
    'reminders': { component: SmartReminders, id: 'reminders', group: 'coaching', title: 'Reminders', defaultVisible: true },

    // Insights & Actions
    'actions': { component: SmartActionItems, id: 'actions', group: 'insights', title: 'Action Items', defaultVisible: true },
    'live-insights': { component: LiveInsightsPane, id: 'live-insights', group: 'insights', title: 'Live Insights', defaultVisible: true },

    // Timeline & Topics (Visual Timeline is standalone in the bottom row)
    'timeline': { component: VisualTimeline, id: 'timeline', group: 'timeline', title: 'Timeline', defaultVisible: true },

    // Redistributed from Timeline to avoid vertical stacking overflow
    'clusters': { component: TopicClustersPane, id: 'clusters', group: 'insights', title: 'Topic Clusters', defaultVisible: true },
    'conflict': { component: ConflictDetection, id: 'conflict', group: 'health', title: 'Conflicts', defaultVisible: true },
    'flow': { component: FlowPredictionPane, id: 'flow', group: 'coaching', title: 'Flow Prediction', defaultVisible: true },

    // Advanced Stats (Detailed Mode)
    'analytics': { component: AdvancedAnalyticsDashboard, id: 'analytics', group: 'analytics', title: 'Advanced Analytics', defaultVisible: false },
    'highlights': { component: SmartHighlightingPane, id: 'highlights', group: 'highlights', title: 'Highlights', defaultVisible: false },
    // 'quality': { component: MeetingQualityScoreCard, id: 'quality', group: 'quality', title: 'Quality Score', defaultVisible: false },
    'prep': { component: PredictivePreparation, id: 'prep', group: 'preparation', title: 'Preparation', defaultVisible: false },
    'relation': { component: RelationshipIntelligence, id: 'relation', group: 'relationships', title: 'Relationships', defaultVisible: false },
};

export const getWidgetsByGroup = (group: WidgetGroup) => {
    return Object.values(DASHBOARD_WIDGETS).filter(w => w.group === group);
};
