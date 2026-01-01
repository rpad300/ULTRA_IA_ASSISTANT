import { motion, AnimatePresence } from "framer-motion";
import { Activity, Mic, Cpu, ShieldCheck, AlertTriangle, RefreshCw, Check, TrendingDown } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionHealth } from "./useSessionStatus";
import { useSessionStatus } from "./useSessionStatus";
import { socketManager } from "@/managers/TranscriptionSocketManager";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";

// --- SOTA SVG Sparkline (Medical/Aerospace Aesthetic) ---
const AudioSparkline = ({ level }: { level: number }) => {
    // Increase resolution for smooth "analog" feel
    const [history, setHistory] = useState<number[]>(new Array(60).fill(0));

    useEffect(() => {
        setHistory(prev => {
            const next = [...prev.slice(1), level];
            return next;
        });
    }, [level]);

    // Generate Path Data
    const pathData = useMemo(() => {
        const width = 100;
        const height = 100;
        const step = width / (history.length - 1);

        let d = `M 0 ${height}`;

        history.forEach((val, i) => {
            const x = i * step;
            // Invert Y because SVG 0 is top. Scale level directly.
            const visualVal = Math.max(val * 0.9, 0.02);
            const y = height - (visualVal * height);
            d += ` L ${x} ${y}`;
        });

        return d;
    }, [history]);

    const isActive = useMemo(() => history.some(h => h > 0.01), [history]);

    return (
        <div className="relative h-10 w-full mt-2 overflow-hidden rounded-md bg-black/40 border border-white/5 ring-1 ring-white/5">
            {/* Grid Lines for "Oscilloscope" feel */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />

            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
            >
                {/* 1. Line */}
                <motion.path
                    d={pathData}
                    fill="none"
                    strokeWidth="2"
                    stroke={isActive ? "#10b981" : "#334155"} // Emerald or Slate
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-colors duration-300"
                />

                {/* 2. Glow Filter Effect */}
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Live Indicator overlay if active */}
            {isActive && (
                <div className="absolute top-1 right-1 flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-500 animate-ping" />
                </div>
            )}
        </div>
    );
};

// --- Main Monitor Component ---
export function SessionHealthMonitor() {
    const { sessionHealth, currentAudioLevel } = useSessionStatus();
    const [isHovered, setIsHovered] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showSuccessFlash, setShowSuccessFlash] = useState(false);
    const prevStatus = useRef(sessionHealth.status);

    // Responsive check
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Detect recovery for "Success Flash"
    useEffect(() => {
        if (prevStatus.current !== 'optimal' && sessionHealth.status === 'optimal') {
            setShowSuccessFlash(true);
            setTimeout(() => setShowSuccessFlash(false), 2000);
        }
        prevStatus.current = sessionHealth.status;
    }, [sessionHealth.status]);

    const health = sessionHealth;

    const getStatusColor = (status: SessionHealth['status']) => {
        if (showSuccessFlash) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]";
        switch (status) {
            case 'optimal': return "bg-emerald-500/5 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
            case 'warning': return "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]";
            case 'critical': return "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)] animate-pulse-subtle";
            default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
        }
    };

    const StatusIcon = {
        optimal: ShieldCheck,
        warning: AlertTriangle,
        critical: Activity
    }[health.status];

    // Actions
    const handleRequestPermission = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            window.location.reload();
        } catch (e) {
            console.error("Permission request failed", e);
        }
    };

    const handleRestartService = () => {
        window.location.reload();
    };

    const Content = (
        <div className="space-y-4 min-w-[280px]">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-3 h-3" /> System Diagnostics
                </h4>
                {health.status === 'optimal' && (
                    <span className="text-[10px] text-emerald-500 font-mono tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                    </span>
                )}
            </div>

            {/* Detailed Rows */}
            <div className="space-y-3">
                {/* 1. Microphone */}
                <div className="group flex flex-col gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5 text-foreground/90">
                            <Mic className="h-4 w-4 text-sky-400" />
                            <span className="font-medium">Microphone Input</span>
                        </div>
                        <StatusDot status={health.layers.hardware.status === 'optimal' ? 'ok' : 'err'} />
                    </div>
                    {health.layers.hardware.status !== 'optimal' && (
                        <div className="flex justify-end mt-2 animate-in slide-in-from-top-1">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] w-full"
                                onClick={handleRequestPermission}
                            >
                                Request Access
                            </Button>
                        </div>
                    )}
                </div>

                {/* 2. Speaker ID */}
                <div className="group flex items-center justify-between text-sm p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                    <div className="flex items-center gap-2.5 text-foreground/90">
                        <Cpu className="h-4 w-4 text-violet-400" />
                        <span className="font-medium">Speaker ID Engine</span>
                    </div>
                    <StatusDot status={health.layers.inteligencia.status === 'optimal' ? 'ok' : 'warn'} />
                </div>

                {/* SOTA: Remote Brain Status */}
                <div className="group flex items-center justify-between text-sm p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                    <div className="flex items-center gap-2.5 text-foreground/90">
                        <Activity className="h-4 w-4 text-indigo-400" />
                        <span className="font-medium">Brain: Remote (GPU)</span>
                    </div>
                    <StatusDot status={'ok'} />
                </div>

                {/* 3. Audio Stream with SVG Sparkline */}
                <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 ring-1 ring-white/5">
                    <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2.5 text-foreground/90">
                            <Activity className={cn("h-4 w-4 transition-colors duration-300", currentAudioLevel > 0.05 ? "text-emerald-400" : "text-slate-500")} />
                            <span className="font-medium">Signal Integrity</span>
                        </div>
                        <span className={cn(
                            "text-[10px] font-mono transition-colors",
                            currentAudioLevel > 0.1 ? "text-emerald-400" : "text-muted-foreground"
                        )}>
                            {(currentAudioLevel * 100).toFixed(0)}%
                        </span>
                    </div>

                    {/* SOTA Sparkline */}
                    <AudioSparkline level={currentAudioLevel} />

                    <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-white/5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Latency</span>
                        <span className={cn(
                            "text-[10px] font-mono justify-end flex",
                            health.metrics.latencyMs > 150 ? "text-amber-400" : "text-emerald-400"
                        )}>
                            <span>{health.metrics.latencyMs < 5 ? 'DIRECT' : `${health.metrics.latencyMs.toFixed(0)}ms (RTT)`}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Critical Actions */}
            {(health.status !== 'optimal' || health.isDeclining) && (
                <div className="pt-3 mt-2 border-t border-white/10 animate-in slide-in-from-top-2 fade-in">
                    <div className={cn(
                        "rounded-md p-3 border",
                        health.isDeclining ? "bg-rose-500/10 border-rose-500/20" : "bg-amber-500/10 border-amber-500/20"
                    )}>
                        <div className="flex gap-2 items-start">
                            {health.isDeclining ?
                                <TrendingDown className="w-4 h-4 text-rose-500 mt-0.5 shrink-0 animate-pulse" /> :
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            }
                            <div className="space-y-2 w-full">
                                <p className={cn(
                                    "text-xs font-medium leading-relaxed",
                                    health.isDeclining ? "text-rose-200" : "text-amber-200/90"
                                )}>
                                    {health.isDeclining ? "Health is declining rapidly." : "System performance is degraded."}
                                </p>

                                {health.recommendedAction && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn(
                                            "h-7 text-[10px] w-full justify-start pl-2",
                                            health.isDeclining ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-200" : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-200"
                                        )}
                                        onClick={() => {
                                            if (health.recommendedAction?.action === 'check_network') {
                                                socketManager.connect(sessionHealth.metrics.latencyMs ? 'reconnect' : 'auto'); // Simplified reconnect trigger
                                            } else if (health.recommendedAction?.action === 'reset_mic') {
                                                handleRequestPermission();
                                            } else {
                                                handleRestartService();
                                            }
                                        }}
                                    >
                                        <RefreshCw className="w-3 h-3 mr-2" />
                                        {health.recommendedAction.label || "Fix Issue"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Shared Badge logic for reuse in Drawer/Hover
    const HealthBadge = (
        <Badge
            variant="outline"
            className={cn(
                "relative h-9 px-3 gap-2 cursor-pointer transition-all duration-500 backdrop-blur-2xl border bg-background/50 select-none overflow-hidden",
                getStatusColor(health.status),
                isHovered && "ring-2 ring-offset-1 ring-offset-background ring-white/10 scale-105 shadow-xl"
            )}
            role="status"
            aria-live="assertive"
            aria-label={`System Status: ${health.message}`} // Screen reader support
        >
            {/* Morphing Icon */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={showSuccessFlash ? 'success' : health.status}
                    initial={{ scale: 0, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0, rotate: 20 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                    {showSuccessFlash ? <Check className="h-4 w-4" /> : <StatusIcon className="h-4 w-4" />}
                </motion.div>
            </AnimatePresence>

            <span className="font-medium tracking-tight whitespace-nowrap hidden sm:inline-block">
                {showSuccessFlash ? "Fixed!" : health.message}
            </span>

            {/* Heartbeat (Visual Ping) */}
            <span className="relative flex h-2 w-2 ml-1">
                <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    health.status === 'optimal' ? "bg-emerald-500" : "bg-amber-500",
                    // Speed up if audio level is high (activity)
                    currentAudioLevel > 0.05 && "duration-700"
                )}></span>
                <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    health.status === 'optimal' ? "bg-emerald-500" : "bg-amber-500"
                )}></span>
            </span>

            {/* Success Flash Overlay */}
            <AnimatePresence>
                {showSuccessFlash && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-emerald-500 blur-xl"
                    />
                )}
            </AnimatePresence>
        </Badge>
    );

    // Render Drawer for Mobile
    if (isMobile) {
        return (
            <Drawer>
                <DrawerTrigger asChild>
                    {HealthBadge}
                </DrawerTrigger>
                <DrawerContent className="bg-zinc-950 border-t border-white/10 outline-none">
                    <DrawerHeader>
                        <DrawerTitle>System Diagnostics</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        {Content}
                    </div>
                </DrawerContent>
            </Drawer>
        );
    }

    // Desktop Hover Popup
    return (
        <div
            className="relative z-50"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {HealthBadge}

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 4, scale: 0.96, filter: 'blur(2px)' }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={cn(
                            "absolute top-full left-0 mt-3 p-4 rounded-xl border w-[300px]",
                            "bg-popover/90 backdrop-blur-3xl border-white/10 shadow-2xl",
                            "ring-1 ring-white/5"
                        )}
                        style={{ transformOrigin: 'top left' }}
                    >
                        {Content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'err' }) {
    if (status === 'ok') return <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />;
    if (status === 'warn') return <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />;
    return <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-bounce" />;
}
