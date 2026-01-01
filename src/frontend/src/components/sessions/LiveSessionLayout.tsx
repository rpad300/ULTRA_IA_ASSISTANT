
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMeetingStore, type MeetingState } from "@/store/meetingStore";
import { useShallow } from 'zustand/react/shallow';
import { DASHBOARD_WIDGETS, type WidgetGroup } from "@/config/dashboardWidgets";
import { MeetingGuidancePane } from "@/components/sessions/MeetingGuidancePane";
import { TranscriptPane } from "@/components/sessions/TranscriptPane";
import { ParticipantsPane } from "@/components/sessions/ParticipantsPane";
import { LiveSummaryPane } from "@/components/sessions/LiveSummaryPane";
import { SessionControlBar } from "@/components/sessions/SessionControlBar";
import { InterventionHUD } from "@/components/sessions/InterventionHUD";
import { AgentPane } from "@/components/agent/AgentPane";

// Helper for Panel Grid
const WidgetPanel = ({ group }: { group: WidgetGroup }) => {
    const widgets = Object.values(DASHBOARD_WIDGETS).filter(w => w.group === group);

    return (
        <div className="flex flex-col gap-2 h-auto">
            {widgets.map(config => {
                const Widget = config.component;
                return <Widget key={config.id} />;
            })}
        </div>
    );
};

export function LiveSessionLayout({ }: { projectId?: string }) {
    const { layoutMode, panelsVisibility } = useMeetingStore(
        useShallow((state: MeetingState) => ({
            layoutMode: state.layoutMode,
            panelsVisibility: state.panelsVisibility,
        }))
    );

    // -- Layout Orchestration Logic --

    // Determine Main Grid Columns based on visibility
    const showTranscript = panelsVisibility.transcript;
    const showSidebar = panelsVisibility.participants || panelsVisibility.summary || panelsVisibility.agent; // "Right Sidebar" concept

    // Grid Class Calculation
    const getTranscriptClass = () => {
        if (!showSidebar) return "col-span-1 lg:col-span-12";
        return "col-span-1 lg:col-span-7";
    };

    const getSidebarClass = () => {
        if (!showTranscript) return "col-span-1 lg:col-span-12";
        return "col-span-1 lg:col-span-5";
    };

    return (
        <div className="relative flex flex-col w-full min-h-screen h-auto overflow-visible bg-background transition-colors duration-500">
            {/* Oracle HUD Overlay */}
            <InterventionHUD />

            <div className="shrink-0 z-10 sticky top-0 bg-background/95 backdrop-blur z-30 border-b transition-all duration-200">
                <SessionControlBar />
            </div>

            <div className="flex flex-col gap-4 p-4 w-full max-w-[1920px] mx-auto pb-20">
                {/* Guidance - Always Top (conditional) */}
                <AnimatePresence>
                    {panelsVisibility.guidance && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="w-full shrink-0 z-20 overflow-hidden"
                        >
                            <MeetingGuidancePane />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Content: Transcript + Participants (Flex-1 to fill space) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 relative z-10">
                    {/* Left: Transcript */}
                    <AnimatePresence mode="popLayout">
                        {showTranscript && (
                            <motion.div
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={cn(
                                    "flex flex-col bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-sm transition-all duration-500 ease-in-out",
                                    getTranscriptClass()
                                )}
                            >
                                <TranscriptPane />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Right: Participants & Summary & Agent */}
                    <AnimatePresence mode="popLayout">
                        {showSidebar && (
                            <motion.div
                                layout
                                className={cn("flex flex-col gap-3", getSidebarClass())}
                            >
                                {/* SOTA Agent Pane - High Priority */}
                                {panelsVisibility.agent && (
                                    <motion.div
                                        key="agent-pane"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex flex-col h-[calc(100vh-140px)]" // Fixed height context for scroll
                                    >
                                        <AgentPane />
                                    </motion.div>
                                )}

                                {!panelsVisibility.agent && panelsVisibility.participants && (
                                    <motion.div
                                        key="participants-pane"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex flex-col bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-sm overflow-hidden"
                                    >
                                        <ParticipantsPane />
                                    </motion.div>
                                )}

                                {!panelsVisibility.agent && panelsVisibility.summary && (
                                    <motion.div
                                        key="summary-pane"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="flex flex-col bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-sm overflow-hidden"
                                    >
                                        <LiveSummaryPane />
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Support Panels - Dynamic Grid ( constrained height ) */}
                {layoutMode !== 'minimal' && (
                    <motion.div
                        className={cn(
                            "grid gap-3 shrink-0 pb-1 mt-auto",
                            "grid-cols-1 md:grid-cols-2 lg:grid-cols-12"
                        )}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Column 1: Copilot & CrossMeeting (Insights/Guidance mix) */}
                        {panelsVisibility.insights && (
                            <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                                <WidgetPanel group="ai-copilot" />
                            </div>
                        )}

                        {/* Column 2: Coaching & Reminders */}
                        {panelsVisibility.health && (
                            <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                                <WidgetPanel group="coaching" />
                            </div>
                        )}

                        {/* Column 3: Health */}
                        {panelsVisibility.health && (
                            <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                                <WidgetPanel group="health" />
                            </div>
                        )}

                        {/* Column 4: Insights */}
                        {panelsVisibility.insights && (
                            <div className="col-span-1 md:col-span-1 lg:col-span-3 flex flex-col gap-2">
                                <WidgetPanel group="insights" />
                            </div>
                        )}

                        {/* Full Row: Timeline */}
                        {panelsVisibility.timeline && (
                            <div className="col-span-1 md:col-span-2 lg:col-span-12 flex flex-col gap-2">
                                <WidgetPanel group="timeline" />
                            </div>
                        )}

                        {/* Analytics Row (Detailed Only & if Analytics panel enabled) */}
                        {layoutMode === 'detailed' && panelsVisibility.analytics && (
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
