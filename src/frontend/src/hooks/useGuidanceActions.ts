
import { useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import type { ActionConfig } from '@/types/slices/ui';
// PanelId is used in strings, type import not strictly needed if we use string literals or PanelId type for strictness.
// PanelId is used in strings, type import not strictly needed if we use string literals or PanelId type for strictness.

export function useGuidanceActions() {
    const confirmActionAsTask = useMeetingStore(state => state.confirmActionAsTask);
    const togglePanelFocus = useMeetingStore(state => state.togglePanelFocus);
    const setPanelVisibility = useMeetingStore(state => state.setPanelVisibility);

    const executeAction = useCallback((action: ActionConfig) => {
        console.log(`[GuidanceActionHandler] Executing: ${action.actionId}`, action.payload);

        switch (action.actionId) {
            case 'confirm_action_task':
                if (action.payload?.actionId) {
                    confirmActionAsTask(action.payload.actionId, {});
                    // Optional: Show toast "Task Confirmed"
                } else {
                    console.warn('[GuidanceActionHandler] Missing payload.actionId for confirm_action_task');
                }
                break;

            case 'open_budget_panel':
            case 'open_analytics_panel':
                setPanelVisibility('analytics', true);
                togglePanelFocus('analytics');
                break;

            case 'open_timeline_panel':
                setPanelVisibility('timeline', true);
                togglePanelFocus('timeline');
                break;

            case 'open_health_panel':
                setPanelVisibility('health', true);
                togglePanelFocus('health');
                break;

            case 'open_participants_panel':
                setPanelVisibility('participants', true);
                togglePanelFocus('participants');
                break;

            case 'open_insights_panel':
                setPanelVisibility('insights', true);
                togglePanelFocus('insights');
                break;

            default:
                console.warn(`[GuidanceActionHandler] Unknown actionId: ${action.actionId}`);
                break;
        }
    }, [confirmActionAsTask, togglePanelFocus, setPanelVisibility]);

    return {
        executeAction
    };
}
