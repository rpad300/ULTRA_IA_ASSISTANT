import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import {
    Flag,
    Volume2,
    VolumeX,
    FileText,
    Settings,
    MoreHorizontal,
    X,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMeetingStore } from "@/store/meetingStore";
import { useOverlayStore } from "@/store/overlayStore";
import { AdaptiveLayout } from "./AdaptiveLayout";
import { NotificationCenter } from "./NotificationCenter";
import { AudioDashboard } from "./AudioDashboard";
import { cn } from "@/lib/utils";

// --- SOTA Command Strip Architecture ---

// Helper for Tooltips
interface TooltipWrapperProps {
    children: React.ReactNode;
    content: string;
    side?: "top" | "right" | "bottom" | "left";
}

const TooltipWrapper = ({ children, content, side = "bottom" }: TooltipWrapperProps) => {
    if (!content) return <>{children}</>;
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent side={side} className="text-xs px-2 py-1">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// 1. Group Divider
const GroupDivider = () => (
    <div className="h-6 w-px bg-white/10 mx-1 md:mx-2" />
);

// 2. Command Trigger Button (Primitive)
interface CommandTriggerProps {
    icon: React.ReactNode;
    label?: string;
    shortcut?: string;
    isActive?: boolean;
    isCritical?: boolean;
    onClick?: () => void;
    className?: string;
    tooltip?: string;
}

const CommandTrigger = ({ icon, label, isActive, isCritical, onClick, className, tooltip }: CommandTriggerProps) => {
    return (
        <TooltipWrapper content={tooltip || label || ""} side="top">
            <motion.div
                whileHover="hover"
                whileTap="tap"
                className="relative"
            >
                <Button
                    onClick={onClick}
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "relative h-9 gap-2 transition-all duration-300 border border-transparent overflow-hidden",
                        isActive
                            ? "bg-white/10 text-white border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            : "text-muted-foreground hover:text-white hover:bg-white/5",
                        isCritical && "text-red-500 hover:text-red-400 hover:bg-red-500/10",
                        className
                    )}
                >
                    {/* Visual Feedback Layers */}
                    {isCritical && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            whileTap={{ opacity: 0.5, scale: 2 }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 bg-red-500 rounded-full blur-xl"
                        />
                    )}

                    {/* Icon Morph/Animation Container */}
                    <div className="relative z-10 flex items-center justify-center">
                        {icon}
                    </div>

                    {label && <span className="relative z-10 text-xs font-medium hidden lg:inline-block">{label}</span>}

                    {/* Shortcut Badge (Visual only, usually in tooltip but can be inline) */}
                </Button>
            </motion.div>
        </TooltipWrapper>
    );
};


export function Toolbelt() {
    const {
        isRecording,
        isSilentMode,
        toggleSilentMode,
        markCriticalMoment
    } = useMeetingStore();
    const { openOverlay } = useOverlayStore();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // --- Global Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input focused
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Shortcuts
            if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) {
                if (isRecording) handleMarkCritical();
            }
            if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
                if (isRecording) toggleSilentMode();
            }
            if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey) {
                openOverlay('teleprompter');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRecording, toggleSilentMode, markCriticalMoment, openOverlay]);


    // --- "Alive" State Logic ---
    // Mark Critical Ripple
    const [criticalTrigger, setCriticalTrigger] = useState(0);
    const handleMarkCritical = () => {
        markCriticalMoment();
        setCriticalTrigger(prev => prev + 1);
    };

    // --- Spotlight Effect ---
    const toolbeltRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = toolbeltRef.current?.getBoundingClientRect();
        if (rect) {
            mouseX.set(e.clientX - rect.left);
            mouseY.set(e.clientY - rect.top);
        }
    };

    return (
        <>
            {/* MAIN COMMAND STRIP */}
            <motion.div
                ref={toolbeltRef}
                onMouseMove={handleMouseMove}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-center p-1.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden relative group"
            >
                {/* Spotlight Gradient Layer */}
                <motion.div
                    className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                        background: useMotionTemplate`radial-gradient(
                            650px circle at ${mouseX}px ${mouseY}px,
                            rgba(255, 255, 255, 0.1),
                            transparent 80%
                        )`
                    }} />

                {/* Top Border Gradient (Subtle) */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

                {/* GROUP A: CAPTURE (Immediate Action) */}
                <div className="flex items-center gap-1 relative z-10" role="group" aria-label="Capture Tools">
                    {isRecording && (
                        <>
                            <motion.div
                                key={criticalTrigger}
                                animate={criticalTrigger > 0 ? {
                                    boxShadow: ["0 0 0px rgba(239,68,68,0)", "0 0 20px rgba(239,68,68,0.5)", "0 0 0px rgba(239,68,68,0)"]
                                } : {}}
                                transition={{ duration: 0.8 }}
                                className="rounded-md"
                            >
                                <CommandTrigger
                                    icon={<Flag className="h-4 w-4" />}
                                    label="MARK"
                                    isCritical={true}
                                    onClick={handleMarkCritical}
                                    tooltip="Mark Critical Moment (M)"
                                />
                            </motion.div>

                            <CommandTrigger
                                icon={
                                    <motion.div
                                        animate={{ scale: isSilentMode ? [1, 0.9, 1] : 1 }}
                                        transition={{ repeat: isSilentMode ? Infinity : 0, duration: 2 }}
                                    >
                                        {isSilentMode ? <VolumeX className="h-4 w-4 text-amber-500" /> : <Volume2 className="h-4 w-4" />}
                                    </motion.div>
                                }
                                isActive={isSilentMode}
                                onClick={toggleSilentMode}
                                className={isSilentMode ? "text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : ""}
                                tooltip="Toggle Silent Mode (S)"
                            />
                        </>
                    )}
                </div>

                <GroupDivider />

                {/* GROUP B: INTERFACE (Visualization) */}
                <div className="flex items-center gap-1 relative z-10" role="group" aria-label="Interface Tools">
                    <CommandTrigger
                        icon={<FileText className="h-4 w-4" />}
                        label="PROMPT"
                        onClick={() => openOverlay('teleprompter')}
                        tooltip="Open Teleprompter (P)"
                    />

                    {/* Adaptive Layout (Integrated) */}
                    <AdaptiveLayout
                        panelIds={['transcript', 'participants', 'summary', 'guidance', 'insights', 'health', 'timeline']}
                        className="border-transparent hover:bg-white/5 data-[state=open]:bg-white/10 text-muted-foreground hover:text-white"
                    />
                </div>

                <GroupDivider />

                {/* GROUP C: DIAGNOSTICS (System) */}
                <div className="hidden md:flex items-center gap-1 relative z-10" role="group" aria-label="System Tools">
                    <Popover>
                        <TooltipWrapper content="Audio Dashboard" side="top">
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 rounded-md text-muted-foreground hover:text-white hover:bg-white/5"
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                        </TooltipWrapper>
                        <PopoverContent
                            side="top"
                            align="center"
                            className="w-auto p-4 backdrop-blur-xl bg-zinc-950/90 border-white/10 shadow-2xl rounded-xl"
                        >
                            <AudioDashboard />
                        </PopoverContent>
                    </Popover>

                    <NotificationCenter />
                </div>

                {/* MOBILE OVERFLOW */}
                <div className="md:hidden flex items-center ml-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>

            {/* MOBILE ACTION SHEET (Custom Implementation) */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 rounded-t-2xl z-50 p-6 md:hidden max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-medium tracking-tight text-white flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-emerald-500" />
                                    Command Center
                                </h3>
                                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="space-y-6">
                                {/* Section 1: Session Control */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                        Session
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="outline"
                                            className="h-12 border-white/10 bg-white/5 hover:bg-white/10 justify-start"
                                            onClick={() => { handleMarkCritical(); setIsMobileMenuOpen(false); }}
                                        >
                                            <Flag className="h-4 w-4 mr-2 text-red-500" /> Mark Moment
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-12 border-white/10 bg-white/5 hover:bg-white/10 justify-start"
                                            onClick={() => { toggleSilentMode(); setIsMobileMenuOpen(false); }}
                                        >
                                            {isSilentMode ? <VolumeX className="h-4 w-4 mr-2 text-amber-500" /> : <Volume2 className="h-4 w-4 mr-2" />}
                                            {isSilentMode ? "Unmute Scribe" : "Mute Scribe"}
                                        </Button>
                                    </div>
                                </div>

                                {/* Section 2: Tools */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                        Tools
                                    </label>
                                    <div className="grid grid-cols-1 gap-3">
                                        <Button
                                            variant="secondary"
                                            className="justify-start"
                                            onClick={() => { openOverlay('teleprompter'); setIsMobileMenuOpen(false); }}
                                        >
                                            <FileText className="h-4 w-4 mr-2" /> Teleprompter
                                        </Button>
                                    </div>
                                </div>

                                {/* Section 3: Audio Dashboard (Inline) */}
                                <div className="pt-4 border-t border-white/10">
                                    <AudioDashboard />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
