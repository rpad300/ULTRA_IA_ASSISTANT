
import type { MeetingQualityScore } from "@/store/slices/intelligenceSlice";
import { generateOptimizationTip } from "@/utils/meeting-quality-utils";
import { Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function OptimizationTips({ metrics }: { metrics: MeetingQualityScore | null }) {
    const [activeTip, setActiveTip] = useState(metrics ? generateOptimizationTip(metrics) : null);

    useEffect(() => {
        if (metrics) {
            // Only update tip every 15s to avoid flickering noise, or if metrics change substantially
            // For now, simple re-generation is fine as the component will re-render
            const tip = generateOptimizationTip(metrics);
            if (tip?.id !== activeTip?.id) {
                setActiveTip(tip);
            }
        }
    }, [metrics]);

    if (!activeTip) return null;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border bg-card/60 shadow-sm text-sm",
                    activeTip.severity === 'high' ? "border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400" : "border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400"
                )}
            >
                <div className="p-1.5 rounded-full bg-background/80 shrink-0">
                    <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-xs uppercase tracking-wide opacity-80 mb-0.5">
                        Dica de {activeTip.metric}
                    </p>
                    <p className="leading-tight">
                        {activeTip.message}
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
