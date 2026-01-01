import * as React from "react";
import {
    Bell,
    X,
    Check,
    AlertCircle,
    Info,
    AlertTriangle,
    CheckCircle2,
    Inbox,
    Trash2,
    ArrowRight,
    ExternalLink,
    MessageSquare,
    Play,
    Pause,
    Mic,
    MicOff,
    FileText,
    Brain
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { cva } from "class-variance-authority";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner"; // SOTA Toast Integration

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
    DrawerFooter,
    DrawerClose
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMeetingStore } from "@/store/meetingStore";
import type { Notification, ActionConfig } from "@/types/slices/ui";

// --- Types & Utilities ---

interface NotificationGroup {
    id: string; // id of the first item
    type: 'group';
    category: Notification['type'];
    items: Notification[];
    latestTimestamp: number;
}

interface SingleNotification {
    type: 'single';
    item: Notification;
}

type NotificationEntry = NotificationGroup | SingleNotification;

const notificationVariants = cva(
    "relative overflow-hidden rounded-lg border p-3 transition-all",
    {
        variants: {
            variant: {
                info: "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50",
                warning: "bg-yellow-50/50 border-yellow-100 dark:bg-yellow-950/20 dark:border-yellow-900/40",
                error: "bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/50",
                success: "bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900/50",
            },
            priority: {
                low: "opacity-90",
                medium: "",
                high: "border-l-4 shadow-sm",
            },
            isGrouped: {
                true: "rounded-none first:rounded-t-lg last:rounded-b-lg border-b-0 last:border-b",
                false: "mb-2",
            }
        },
        compoundVariants: [
            { variant: "info", priority: "high", class: "border-l-blue-500" },
            { variant: "warning", priority: "high", class: "border-l-yellow-500" },
            { variant: "error", priority: "high", class: "border-l-red-500" },
            { variant: "success", priority: "high", class: "border-l-green-500" },
        ],
        defaultVariants: {
            variant: "info",
            priority: "medium",
            isGrouped: false,
        }
    }
);

// --- Icon Mapping (Dynamic Action Icons) ---
const getActionIcon = (iconName?: string) => {
    switch (iconName) {
        case 'ArrowRight': return ArrowRight;
        case 'ExternalLink': return ExternalLink;
        case 'MessageSquare': return MessageSquare;
        case 'Check': return Check;
        case 'Trash': return Trash2;
        case 'Play': return Play;
        case 'Pause': return Pause;
        case 'Mic': return Mic;
        case 'MicOff': return MicOff;
        case 'FileText': return FileText;
        case 'Brain': return Brain;
        default: return ArrowRight;
    }
};

// --- Sounds ---
const playNotificationSound = (type?: string) => {
    if (!type || type === 'none') return;

    // Placeholder: Real implementation would use Audio() assets
    // console.log(`[Sound] Playing ${type} sound`);
};

// --- Components ---

function NotificationIcon({ type }: { type: Notification['type'] }) {
    switch (type) {
        case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
        case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        default: return <Info className="h-4 w-4 text-blue-500" />;
    }
}

function ActionButton({ config }: { config: ActionConfig }) {
    const Icon = getActionIcon(config.icon);
    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2 gap-1.5 border border-transparent hover:border-border hover:bg-background/80"
            onClick={(e) => {
                e.stopPropagation();
                // Execute implementation handled by Orchestrator, here we just assume the store/handler attached a function via closure
                // OR more likely in SOTA: The 'actionId' is dispatched.
                // For this refactor, we support the legacy closure if present, or just log.
                console.log(`Action Triggered: ${config.actionId}`, config.payload);
            }}
        >
            {Icon && <Icon className="h-3 w-3" />}
            {config.label}
        </Button>
    );
}

function NotificationCard({
    notification,
    isGrouped = false,
    onMarkRead,
    onDismiss,
    measureRef,
    index
}: {
    notification: Notification;
    isGrouped?: boolean;
    onMarkRead: (id: string) => void;
    onDismiss: (id: string) => void;
    measureRef?: (node: Element | null) => void;
    index?: number;
}) {
    const timeAgo = formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: ptBR });
    const { metadata, primaryAction, secondaryAction } = notification;

    // Swipe Logic
    const x = useMotionValue(0);
    const opacity = useTransform(x, [-100, 0], [0, 1]);
    const color = useTransform(x, [-100, 0], ["rgb(239 68 68)", "rgba(0,0,0,0)"]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (info.offset.x < -100) {
            onDismiss(notification.id);
        }
    };

    return (
        <motion.div
            ref={measureRef}
            data-index={index}
            style={{ x, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0.1 }}
            onDragEnd={handleDragEnd}
            className={cn(
                notificationVariants({
                    variant: notification.type,
                    priority: notification.priority || 'medium',
                    isGrouped
                }),
                !notification.read ? "bg-opacity-100 shadow-sm" : "opacity-80 grayscale-[0.2]",
                "touch-pan-y"
            )}
        >
            <motion.div
                style={{ backgroundColor: color }}
                className="absolute inset-0 z-0 pointer-events-none opacity-10"
            />

            <div className="flex gap-3 relative z-10">
                <div className="mt-0.5 shrink-0 flex flex-col items-center gap-2">
                    <NotificationIcon type={notification.type} />
                    {metadata?.avatarUrl && (
                        <div className="h-5 w-5 rounded-full overflow-hidden ring-1 ring-border">
                            <img src={metadata.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between">
                        <p className="text-sm font-medium leading-none">
                            {notification.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {timeAgo}
                        </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {notification.message}
                    </p>

                    {/* Rich Metadata Lineage */}
                    {metadata?.lineage && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
                            <Brain className="h-3 w-3" />
                            <span>Contexto Identificado</span>
                        </div>
                    )}

                    {/* SOTA Action Buttons */}
                    {(primaryAction || secondaryAction || notification.actionUrl) && (
                        <div className="pt-2 flex flex-wrap gap-2">
                            {primaryAction && <ActionButton config={primaryAction} />}
                            {secondaryAction && <ActionButton config={secondaryAction} />}

                            {/* Legacy Fallback */}
                            {notification.actionUrl && !primaryAction && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 text-xs px-3"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(notification.actionUrl, '_blank');
                                    }}
                                >
                                    Ver Detalhes
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Manual Controls */}
                <div className="flex flex-col gap-1 -mr-1">
                    {!notification.read && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:text-green-600"
                            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                        >
                            <Check className="h-3 w-3" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

function NotificationList({
    entries,
    onMarkRead,
    onDismiss,
    parentRef
}: {
    entries: NotificationEntry[];
    onMarkRead: (id: string) => void;
    onDismiss: (id: string) => void;
    parentRef: React.RefObject<HTMLDivElement | null>;
}) {
    const rowVirtualizer = useVirtualizer({
        count: entries.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
        overscan: 5,
    });

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <Inbox className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Tudo limpo por aqui</p>
                    <p className="text-xs text-muted-foreground/60">
                        Nenhuma notificação nova.
                    </p>
                </div>
            </div>
        );
    }

    const [_, setTick] = React.useState(0);
    React.useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div
            style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const entry = entries[virtualRow.index];
                return (
                    <div
                        key={virtualRow.key}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="py-1 px-1"
                    >
                        {entry.type === 'single' ? (
                            <NotificationCard
                                notification={entry.item}
                                onMarkRead={onMarkRead}
                                onDismiss={onDismiss}
                            />
                        ) : (
                            <div className="space-y-[1px] group">
                                {entry.items.map((item) => (
                                    <NotificationCard
                                        key={item.id}
                                        notification={item}
                                        isGrouped={true}
                                        onMarkRead={onMarkRead}
                                        onDismiss={onDismiss}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// --- Main Hook with SOTA Toast Integration ---
function useNotificationLogic() {
    const { notifications, markNotificationAsRead, dismissNotification, clearAllNotifications } = useMeetingStore();
    const [processedEntries, setProcessedEntries] = React.useState<NotificationEntry[]>([]);

    // Toast & Sound Orchestrator
    const trackedIds = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        // Sync tracked definitions
        if (notifications.length === 0) {
            trackedIds.current.clear();
            return;
        }

        // Check for new items
        // Since we prepend (Unshift), the new ones are at the start.
        // We iterate and check if we tracked them.

        notifications.forEach(note => {
            if (!trackedIds.current.has(note.id)) {
                trackedIds.current.add(note.id);

                // --- SOTA Activation ---

                // 1. Toast Trigger
                if (note.isToast) {
                    const toastFn = note.type === 'error' ? toast.error :
                        note.type === 'success' ? toast.success :
                            note.type === 'warning' ? toast.warning : toast;

                    toastFn(note.title, {
                        description: note.message,
                        duration: note.duration || 4000,
                        action: note.primaryAction ? {
                            label: note.primaryAction.label,
                            onClick: () => console.log("Toast Action Triggered") // Wired in real implementation
                        } : undefined
                    });
                }

                // 2. Sound Trigger
                if (note.metadata?.soundTrigger && note.metadata.soundTrigger !== 'none') {
                    playNotificationSound(note.metadata.soundTrigger);
                } else if (note.type === 'error') {
                    playNotificationSound('alert');
                }
            }
        });

    }, [notifications]);

    // Sort and Group
    React.useMemo(() => {
        // Store already sorts by Priority > Date in 'addNotification', 
        // but here we might want temporal pure sort for specific views, 
        // OR respect store order. 
        // Given store logic: "notifications.sort((a,b)...)". 
        // We should trust the store's order.

        const sorted = notifications; // Already sorted by Priority/Time

        const grouped: NotificationEntry[] = [];
        let currentGroup: NotificationGroup | null = null;

        sorted.forEach((note, index) => {
            const prev = index > 0 ? sorted[index - 1] : null;

            // Semantic Grouping via 'groupId' OR Type heuristics
            const isRelated = (prev && prev.groupId && prev.groupId === note.groupId) ||
                (prev && !prev.groupId && !note.groupId && prev.type === note.type && (prev.timestamp - note.timestamp) < 60000); // 1 min grouping window

            if (isRelated) {
                if (currentGroup) {
                    currentGroup.items.push(note);
                } else {
                    const lastEntry = grouped[grouped.length - 1];

                    // Helper strict type check
                    if (lastEntry && lastEntry.type === 'single') {
                        const newGroup: NotificationGroup = {
                            id: lastEntry.item.id,
                            type: 'group',
                            category: note.type, // Assumes same type if related
                            items: [lastEntry.item, note],
                            latestTimestamp: lastEntry.item.timestamp
                        };
                        grouped[grouped.length - 1] = newGroup;
                        currentGroup = newGroup;
                    } else if (lastEntry && lastEntry.type === 'group') {
                        lastEntry.items.push(note);
                        currentGroup = lastEntry;
                    } else {
                        // Fallback
                        grouped.push({ type: 'single', item: note });
                    }
                }
            } else {
                grouped.push({ type: 'single', item: note });
                currentGroup = null;
            }
        });

        setProcessedEntries(grouped);
    }, [notifications]);

    return {
        entries: processedEntries,
        unreadCount: notifications.filter(n => !n.read).length,
        hasUnreadError: notifications.some(n => !n.read && n.type === 'error'),
        markNotificationAsRead,
        dismissNotification,
        clearAllNotifications
    };
}

// --- Main Component ---
export function NotificationCenter() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<"all" | "unread">("all");
    const isDesktop = useMediaQuery("(min-width: 768px)");

    const {
        entries,
        unreadCount,
        hasUnreadError,
        markNotificationAsRead,
        dismissNotification,
        clearAllNotifications
    } = useNotificationLogic();

    const filteredEntries = React.useMemo(() => {
        if (activeTab === "all") return entries;
        return entries
            .map(entry => {
                if (entry.type === 'single') {
                    return !entry.item.read ? entry : null;
                } else {
                    const unreadItems = entry.items.filter(i => !i.read);
                    if (unreadItems.length === 0) return null;
                    return { ...entry, items: unreadItems };
                }
            })
            .filter(Boolean) as NotificationEntry[];
    }, [entries, activeTab]);

    const TriggerButton = (
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "relative transition-transform",
                hasUnreadError && "animate-[shake_0.5s_ease-in-out_infinite_paused] hover:animate-none",
                hasUnreadError && !isOpen && "text-red-500"
            )}
        >
            <Bell className={cn("h-5 w-5", hasUnreadError && "animate-pulse")} />
            {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
            )}
        </Button>
    );

    const Header = (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm">Central de Eventos</h4>
                {unreadCount > 0 && (
                    <Badge variant="secondary" className="px-1.5 h-5 text-[10px]">
                        {unreadCount} novas
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => entries.forEach(e => {
                            if (e.type === 'single') markNotificationAsRead(e.item.id);
                            else e.items.forEach(i => markNotificationAsRead(i.id));
                        })}
                    >
                        <Check className="h-3 w-3 mr-1" /> Marcar lidas
                    </Button>
                )}
                {entries.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Limpar tudo"
                        onClick={clearAllNotifications}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );

    const scrollRef = React.useRef<HTMLDivElement>(null);

    const Content = (
        <div className="flex flex-col h-full overflow-hidden">
            {Header}

            <Tabs
                defaultValue="all"
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="flex flex-col flex-1 overflow-hidden"
            >
                <div className="px-4 pt-2 pb-0">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
                        <TabsTrigger value="unread" className="text-xs">Não Lidas</TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-hidden min-h-0 relative">
                    <ScrollArea className="h-full w-full" ref={scrollRef}>
                        <div className="p-3 pb-20 sm:pb-3">
                            <TabsContent value="all" className="m-0 space-y-4">
                                <NotificationList
                                    entries={filteredEntries}
                                    onMarkRead={markNotificationAsRead}
                                    onDismiss={dismissNotification}
                                    parentRef={scrollRef}
                                />
                            </TabsContent>
                            <TabsContent value="unread" className="m-0 space-y-4">
                                <NotificationList
                                    entries={filteredEntries}
                                    onMarkRead={markNotificationAsRead}
                                    onDismiss={dismissNotification}
                                    parentRef={scrollRef}
                                />
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </div>
            </Tabs>
        </div>
    );

    if (isDesktop) {
        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    {TriggerButton}
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 mr-4 max-h-[600px] shadow-xl border-border/80" align="end" sideOffset={5}>
                    <div className="h-[550px] flex flex-col">
                        {Content}
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
                {TriggerButton}
            </DrawerTrigger>
            <DrawerContent className="h-[85vh] outline-none">
                <DrawerHeader className="text-left sr-only">
                    <DrawerTitle>Notificações</DrawerTitle>
                </DrawerHeader>
                {Content}
                <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                        <Button variant="outline" className="min-h-12 text-base">Fechar</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
