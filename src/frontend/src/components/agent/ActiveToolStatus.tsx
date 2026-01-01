

import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/store/meetingStore";
import { Terminal, StopCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ActiveToolStatus = () => {
    const { activeTools, interruptAgent } = useMeetingStore();

    if (activeTools.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 mt-4 px-1">
            <AnimatePresence>
                {activeTools.map((tool) => (
                    <motion.div
                        key={tool.tool + tool.startedAt}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-slate-950/80 border border-indigo-500/30 rounded-lg p-3 relative overflow-hidden group shadow-lg shadow-indigo-500/10"
                    >
                        {/* Animated Progress Bar Background */}
                        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />

                        <div className="relative z-10 flex items-center justify-between gap-3">
                            {/* Icon & Label */}
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-indigo-500/20 rounded-md">
                                    {tool.progress === 'running' ? (
                                        <Loader2 className="w-4 h-4 text-indigo-300 animate-spin" />
                                    ) : (
                                        <Terminal className="w-4 h-4 text-indigo-300" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">
                                        Executing Tool
                                    </span>
                                    <span className="text-sm font-medium text-white truncate">
                                        {tool.ui_hint}
                                    </span>
                                </div>
                            </div>

                            {/* Stop Action */}
                            {tool.isInterruptible && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    onClick={() => interruptAgent()}
                                    title="Stop execution"
                                >
                                    <StopCircle className="w-5 h-5" />
                                </Button>
                            )}
                        </div>

                        {/* Input Preview (Command args etc) */}
                        {tool.inputPreview && (
                            <div className="relative z-10 mt-2 pl-11">
                                <div className="text-[10px] font-mono text-slate-400 bg-black/40 p-1.5 rounded border border-white/5 truncate">
                                    $ {tool.inputPreview}
                                </div>
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
