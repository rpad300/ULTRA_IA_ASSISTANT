
import { useRef, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { cn } from "@/lib/utils";
import {
    BrainCircuit,
    CheckCircle2,
    Loader2,
    Search,
    FileText,
    Sparkles,
    AlertCircle
} from "lucide-react";

export const AgentReasoningHub = () => {
    const { reasoningSteps, activityLevel, ragStatus, setFocusedBlockId } = useMeetingStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new steps
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [reasoningSteps.length, ragStatus]);

    // Neural Heartbeat: Visual intensity driven by agent activity
    const pulseVariant: Variants = {
        idle: { scale: 1, opacity: 0.5, filter: "blur(0px)" },
        active: {
            scale: [1, 1.1 + (activityLevel * 0.2), 1],
            opacity: [0.6, 0.8 + (activityLevel * 0.2), 0.6],
            filter: [`blur(0px)`, `blur(${activityLevel * 4}px)`, `blur(0px)`],
            transition: {
                duration: 2 - activityLevel, // Faster when active
                repeat: Infinity,
                ease: "easeInOut"
            }
        } as any // Cast to avoid strict transition type mismatch
    };

    // Deep Link Handler
    const handleStepClick = (blockId?: string) => {
        if (blockId) {
            setFocusedBlockId(blockId);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-card/30 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden relative">
            {/* Header / Neural Core */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                <div className="relative flex items-center justify-center w-8 h-8">
                    {/* Neural Orb */}
                    <motion.div
                        className="absolute w-full h-full rounded-full bg-indigo-500/30"
                        variants={pulseVariant}
                        animate={activityLevel > 0 ? "active" : "idle"}
                    />
                    <BrainCircuit className={cn("w-5 h-5 z-10", activityLevel > 0 ? "text-indigo-400" : "text-slate-500")} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200">
                        {activityLevel > 0 ? "Reasoning Active" : "Agent Standby"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                        {ragStatus.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Timeline Scroll Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
                <AnimatePresence initial={false}>
                    {reasoningSteps.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -10, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: "auto" }}
                            className="flex gap-3 group"
                        >
                            {/* Connector Line */}
                            <div className="flex flex-col items-center min-w-[20px]">
                                <div className={cn(
                                    "w-2 h-2 rounded-full mt-1.5 z-10 transition-colors duration-300",
                                    step.status === 'active' ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" :
                                        step.status === 'completed' ? "bg-emerald-500/80" :
                                            step.status === 'failed' ? "bg-red-500" :
                                                "bg-slate-700"
                                )} />
                                {index !== reasoningSteps.length - 1 && (
                                    <div className="w-[1px] flex-1 bg-white/10 my-1 group-hover:bg-indigo-500/20 transition-colors" />
                                )}
                            </div>

                            {/* Content Card */}
                            <div
                                onClick={() => handleStepClick(step.contextBlockId)}
                                className={cn(
                                    "flex-1 p-3 rounded-lg border text-sm transition-all duration-300",
                                    step.contextBlockId ? "cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/5 active:scale-[0.98]" : "",
                                    step.status === 'active'
                                        ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-100"
                                        : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-xs text-slate-400 uppercase tracking-tight flex items-center gap-1">
                                        {step.type === 'rag' && <Search className="w-3 h-3" />}
                                        {step.type === 'tool' && <Sparkles className="w-3 h-3" />}
                                        {step.type === 'logic' && <BrainCircuit className="w-3 h-3" />}
                                        {step.type}
                                    </span>
                                    {step.status === 'active' && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                                    {step.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                    {step.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-500" />}
                                </div>

                                <p className="leading-relaxed whitespace-pre-wrap font-light text-[13px]">
                                    {step.description}
                                </p>

                                {step.contextBlockId && (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400 group-hover:text-indigo-300 transition-colors">
                                        <FileText className="w-3 h-3" />
                                        <span>Linked to transcript</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Ghost Step (Prediction) */}
                    {ragStatus === 'analyzing_query' && reasoningSteps.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            className="flex gap-3 grayscale"
                        >
                            <div className="flex flex-col items-center min-w-[20px]">
                                <div className="w-2 h-2 rounded-full mt-1.5 border border-dashed border-slate-500 bg-transparent" />
                            </div>
                            <div className="flex-1 p-3 rounded-lg border border-dashed border-slate-700 bg-transparent text-sm text-slate-500 italic">
                                Fetching relevant context...
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Ambient Background Glow */}
            <div className={cn(
                "absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-indigo-900/10 to-transparent pointer-events-none transition-opacity duration-1000",
                activityLevel > 0 ? "opacity-100" : "opacity-0"
            )} />
        </div>
    );
};
