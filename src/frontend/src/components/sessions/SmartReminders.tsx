import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Bell,
    CheckCircle2,
    X,
    Clock,
    ArrowRightCircle,
    Zap,
    Link as LinkIcon,
    Ghost
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useReminderEngine, type Reminder } from "@/hooks/useReminderEngine";

export function SmartReminders() {
    const {
        activeReminders,
        dismissReminder,
        markAsAddressed,
        snoozeReminder,
        transformToTask,
        jumpToContext
    } = useReminderEngine();

    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    // Keyboard Shortcut: Alt + R to focus/highlight first reminder
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                const first = activeReminders[0];
                if (first) setHighlightedId(first.id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeReminders]);

    // Clear highlight after delay
    useEffect(() => {
        if (highlightedId) {
            const timer = setTimeout(() => setHighlightedId(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [highlightedId]);

    const getStyles = (type: Reminder['type'], status?: Reminder['status']) => {
        // Ghost Confirmation Override
        if (status === 'resolving') {
            return {
                border: 'border-emerald-500/50',
                bg: 'bg-emerald-950/20',
                icon: 'text-emerald-400',
                gradient: 'from-emerald-500/20 to-emerald-500/5',
                pulse: 'bg-emerald-500',
                glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]'
            };
        }

        switch (type) {
            case 'deadline':
                return {
                    border: 'border-orange-500/50',
                    bg: 'bg-orange-950/20',
                    icon: 'text-orange-400',
                    gradient: 'from-orange-500/10 to-transparent',
                    pulse: 'bg-orange-500',
                    glow: ''
                };
            case 'promise':
                return {
                    border: 'border-violet-500/50',
                    bg: 'bg-violet-950/20',
                    icon: 'text-violet-400',
                    gradient: 'from-violet-500/10 to-transparent',
                    pulse: 'bg-violet-500',
                    glow: ''
                };
            case 'missing_topic':
                return {
                    border: 'border-pink-500/50',
                    bg: 'bg-pink-950/20',
                    icon: 'text-pink-400',
                    gradient: 'from-pink-500/10 to-transparent',
                    pulse: 'bg-pink-500',
                    glow: ''
                };
            case 'confirmation':
                return {
                    border: 'border-yellow-500/50',
                    bg: 'bg-yellow-950/20',
                    icon: 'text-yellow-400',
                    gradient: 'from-yellow-500/10 to-transparent',
                    pulse: 'bg-yellow-500',
                    glow: ''
                };
            default: // follow-up
                return {
                    border: 'border-blue-500/50',
                    bg: 'bg-blue-950/20',
                    icon: 'text-blue-400',
                    gradient: 'from-blue-500/10 to-transparent',
                    pulse: 'bg-blue-500',
                    glow: ''
                };
        }
    };

    if (activeReminders.length === 0) {
        return (
            <Card className="border-border/50 bg-card/30 backdrop-blur-xl shadow-sm border-dashed">
                <CardHeader className="p-4 border-b border-border/10">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground/70">
                        <Bell className="h-4 w-4" />
                        Accountability Hub
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center space-y-2">
                    <div className="p-2 rounded-full bg-primary/5">
                        <CheckCircle2 className="h-5 w-5 text-primary/40" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Nenhuma pendência detectada.<br />O assistente está a ouvir...
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card/40 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden max-h-[500px]">
            <CardHeader className="p-4 border-b border-border/50 shrink-0 flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-400">
                    <Bell className="h-4 w-4 text-primary" />
                    Accountability Hub
                    <Badge variant="secondary" className="ml-2 text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
                        {activeReminders.length} Active
                    </Badge>
                </CardTitle>
                {/* Visual Pulse for Activity */}
                <div className="flex gap-1" aria-hidden="true">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-pulse delay-75" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/20 animate-pulse delay-150" />
                </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 overflow-y-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
                <div aria-live="polite" className="sr-only">
                    {activeReminders.length > 0 && `New reminder: ${activeReminders[activeReminders.length - 1].message}`}
                </div>

                <AnimatePresence mode="popLayout" initial={false}>
                    {activeReminders.map((reminder) => {
                        const styles = getStyles(reminder.type, reminder.status);
                        const isHighlighted = highlightedId === reminder.id;
                        const isResolving = reminder.status === 'resolving';

                        return (
                            <motion.div
                                key={reminder.id}
                                layout
                                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                                animate={{
                                    opacity: isResolving ? 0.8 : 1, // Start fading if resolving
                                    x: 0,
                                    scale: isHighlighted ? 1.05 : 1,
                                    borderColor: isHighlighted ? "rgba(124, 58, 237, 0.5)" : undefined,
                                    boxShadow: isHighlighted ? "0 0 20px rgba(124, 58, 237, 0.3)" : (isResolving ? "0 0 30px rgba(16,185,129,0.2)" : "none")
                                }}
                                exit={{
                                    opacity: 0,
                                    x: -50,
                                    scale: 0.8,
                                    transition: { duration: 0.3 }
                                }}
                                className={cn(
                                    "relative rounded-xl border p-0 overflow-hidden transition-all group",
                                    styles.border,
                                    styles.bg
                                )}
                            >
                                {/* Ghost Animation Overlay */}
                                {isResolving && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 bg-emerald-500/10 z-20 flex items-center justify-center backdrop-blur-[1px]"
                                    >
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-shadow-sm">
                                            <Ghost className="h-4 w-4 animate-bounce" />
                                            <span>Resolved</span>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Urgency Pulse / Progress Bar (Visual Timer) */}
                                {reminder.priority === 'high' && !isResolving && (
                                    <motion.div
                                        initial={{ width: "100%" }}
                                        animate={{ width: "0%" }}
                                        transition={{ duration: 60 * 5, ease: "linear" }}
                                        className={cn("absolute top-0 left-0 h-0.5 z-10", styles.pulse)}
                                    />
                                )}

                                {/* Background Gradient */}
                                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none", styles.gradient)} />

                                <div className="relative p-3 space-y-2">
                                    {/* Header */}
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 border-current/30 uppercase tracking-tighter", styles.icon)}>
                                                {reminder.type.replace('_', ' ')}
                                            </Badge>
                                            {reminder.priority === 'high' && !isResolving && (
                                                <Zap className="h-3 w-3 text-yellow-400 animate-pulse" />
                                            )}
                                        </div>

                                        {!isResolving && (
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 rounded-full hover:bg-black/20"
                                                    onClick={() => snoozeReminder(reminder.id)}
                                                    title="Snooze 5 min"
                                                >
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 rounded-full hover:bg-black/20"
                                                    onClick={() => markAsAddressed(reminder.id)}
                                                    title="Mark as done"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 rounded-full hover:bg-black/20"
                                                    onClick={() => dismissReminder(reminder.id)}
                                                >
                                                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content (Deep Linking Wrapper) */}
                                    <div
                                        className="cursor-pointer group/text"
                                        onClick={() => !isResolving && jumpToContext(reminder.relatedBlockId)}
                                    >
                                        <p className="text-sm font-medium leading-snug text-foreground/90 group-hover/text:text-primary transition-colors flex items-center gap-2">
                                            {reminder.message}
                                            {reminder.relatedBlockId && !isResolving && (
                                                <LinkIcon className="h-2.5 w-2.5 opacity-0 group-hover/text:opacity-50 transition-opacity" />
                                            )}
                                        </p>
                                        {reminder.context && (
                                            <p className="text-xs text-muted-foreground/70 italic mt-1 line-clamp-2">
                                                {reminder.context}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions Footer */}
                                    {!isResolving && (
                                        <div className="pt-2 flex items-center justify-end border-t border-black/5 dark:border-white/5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-2 hover:bg-primary/10 hover:text-primary gap-1.5 transition-colors ml-auto"
                                                onClick={() => transformToTask(reminder)}
                                            >
                                                <ArrowRightCircle className="h-3 w-3" />
                                                Transform into Task
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
