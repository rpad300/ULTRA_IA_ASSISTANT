
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MasterControlsProps {
    isRecording: boolean;
    isPaused: boolean;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
}

export function MasterControls({
    isRecording,
    isPaused,
    onStart,
    onPause,
    onResume,
    onStop
}: MasterControlsProps) {
    return (
        <div className="flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">
                {!isRecording ? (
                    <motion.div
                        key="start"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Button
                            onClick={onStart}
                            size="lg"
                            className={cn(
                                "relative overflow-hidden pl-6 pr-8 h-12 rounded-full",
                                "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500",
                                "border border-emerald-400/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                                "text-white font-semibold tracking-wide transition-all"
                            )}
                        >
                            {/* Inner Glow */}
                            <motion.div
                                className="absolute inset-0 bg-white/20"
                                animate={{ opacity: [0, 0.5, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />

                            <div className="relative flex items-center gap-2">
                                <Play className="h-5 w-5 fill-current" />
                                <span>START SESSION</span>
                            </div>
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="controls"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2"
                    >
                        {isPaused ? (
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    onClick={onResume}
                                    variant="outline"
                                    className="h-10 px-6 rounded-full border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500 text-amber-500 gap-2"
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                    RESUME
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    onClick={onPause}
                                    variant="outline"
                                    className="h-10 px-6 rounded-full border-slate-700 hover:bg-slate-800 gap-2 font-medium"
                                >
                                    <Pause className="h-4 w-4" />
                                    PAUSE
                                </Button>
                            </motion.div>
                        )}

                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                                onClick={onStop}
                                variant="destructive"
                                className="h-10 px-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 gap-2"
                            >
                                <Square className="h-4 w-4 fill-current" />
                                <span className="hidden sm:inline">STOP</span>
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
