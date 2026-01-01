

import { motion } from "framer-motion";
import { AgentReasoningHub } from "./AgentReasoningHub";
import { KnowledgeSourceList } from "./KnowledgeSourceList";
import { ActiveToolStatus } from "./ActiveToolStatus";

// This component acts as the Layout wrapper for the SOTA Agent Widgets.
// It is intended to be placed in the "Right Sidebar" slot (replacing Participants/Summary or toggling).
export const AgentPane = () => {
    return (
        <div className="flex flex-col h-full w-full gap-4">
            {/* Main Trace (Flex Grow to fill space) */}
            <div className="flex-1 min-h-0 relative">
                <AgentReasoningHub />
            </div>

            {/* Footer Area: Active Tools & Sources (Collapsible or Scrollable if needed) */}
            {/* On desktop we stack them. On mobile we might want a drawer (implemented via CSS media queries or separate mobile view) */}
            <motion.div
                className="shrink-0 flex flex-col gap-4 pb-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <ActiveToolStatus />
                <KnowledgeSourceList />
            </motion.div>
        </div>
    );
};
