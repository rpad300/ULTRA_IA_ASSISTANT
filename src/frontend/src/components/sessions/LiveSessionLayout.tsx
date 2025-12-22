import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { DASHBOARD_WIDGETS, type WidgetGroup } from "@/config/dashboardWidgets";
import { MeetingGuidancePane } from "@/components/sessions/MeetingGuidancePane";
import { TranscriptPane } from "@/components/sessions/TranscriptPane";
import { ParticipantsPane } from "@/components/sessions/ParticipantsPane";
import { LiveSummaryPane } from "@/components/sessions/LiveSummaryPane";
import { SessionControlBar } from "@/components/sessions/SessionControlBar";

// Helper for Panel Grid
const WidgetPanel = ({ group }: { group: WidgetGroup }) => {
    const widgets = Object.values(DASHBOARD_WIDGETS).filter(w => w.group === group);

    // The original code logics: (!focusedPanels.includes(...) || layoutMode === 'detailed')
    // We simplify: Render all in group if the group wrapper is requested

    return (
        <div className="flex flex-col gap-2 h-full">
            {widgets.map(config => {
                const Widget = config.component;
                return <Widget key={config.id} />;
            })}
        </div>
    );
};

export function LiveSessionLayout({ }: { projectId?: string }) {
    const { layoutMode } = useMeetingStore();

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
            <div className="shrink-0">
                <SessionControlBar />
            </div>

            <div className="flex-1 flex flex-col gap-3 p-3 min-h-0 overflow-hidden">
                {/* Guidance - Always Top */}
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full shrink-0">
                    <MeetingGuidancePane />
                </motion.div>

                {/* Main Content: Transcript + Participants */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
                    {/* Left: Transcript */}
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="col-span-1 lg:col-span-7 flex flex-col bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden shadow-sm min-h-0"
                    >
                        <TranscriptPane />
                    </motion.div>

                    {/* Right: Participants & Summary */}
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="col-span-1 lg:col-span-5 flex flex-col gap-3 min-h-0 overflow-hidden"
                    >
                        <div className="flex-1 flex flex-col bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden shadow-sm min-h-0" style={{ minHeight: '200px' }}>
                            <ParticipantsPane />
                        </div>
                        <div className="flex-1 flex flex-col bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden shadow-sm min-h-0" style={{ minHeight: '200px' }}>
                            <LiveSummaryPane />
                        </div>
                    </motion.div>
                </div>

                {/* Support Panels - Dynamic Grid */}
                {layoutMode !== 'minimal' && (
                    <motion.div
                        className={cn(
                            "grid gap-3 shrink-0 overflow-y-auto transition-all duration-300 pr-2",
                            "grid-cols-1 md:grid-cols-2 lg:grid-cols-12",
                            "max-h-[400px]" // User suggestion: grid-auto-rows? Fixed max-height for scrolling bottom area
                        )}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* 
                           We map specific groups to columns to maintain the logic 
                           of the original "Support Panel 1/2/3/4" 
                        */}

                        {/* Column 1: Copilot & CrossMeeting */}
                        <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                            <WidgetPanel group="ai-copilot" />
                        </div>

                        {/* Column 2: Coaching & Reminders */}
                        <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                            <WidgetPanel group="coaching" />
                        </div>

                        {/* Column 3: Health */}
                        <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                            <WidgetPanel group="health" />
                        </div>

                        {/* Column 4: Insights */}
                        <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                            <WidgetPanel group="insights" />
                        </div>

                        {/* Full Row: Timeline (Optional) */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-12 flex flex-col gap-2">
                            <WidgetPanel group="timeline" />
                        </div>

                        {/* Analytics Row (Detailed Only) */}
                        {layoutMode === 'detailed' && (
                            <>
                                <div className="col-span-1 md:col-span-1 lg:col-span-3">
                                    <WidgetPanel group="analytics" />
                                </div>
                                <div className="col-span-1 md:col-span-1 lg:col-span-3">
                                    <WidgetPanel group="highlights" />
                                </div>
                                <div className="col-span-1 md:col-span-1 lg:col-span-3">
                                    <WidgetPanel group="quality" />
                                </div>
                                <div className="col-span-1 md:col-span-1 lg:col-span-3">
                                    <WidgetPanel group="preparation" />
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
