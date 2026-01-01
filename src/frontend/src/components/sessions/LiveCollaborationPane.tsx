import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Wifi, MousePointer2, Copy } from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { motion, AnimatePresence } from "framer-motion";
import { getUserColor, getUserColorVariant, useLocalPresence, getConnectivityColor, getConnectivityStatus, type PresenceStatus, type ActivityContext } from "@/utils/presence-utils";
import { cn } from "@/lib/utils";

// --- Types ---
interface DisplayUser {
    id: string;
    name: string;
    avatar?: string;
    isSelf?: boolean;
}

// --- Sub-components ---

const AvatarStack = ({ activeViewers, currentUser }: { activeViewers: any[], currentUser: any }) => {
    const allUsers = useMemo(() => currentUser ? [currentUser, ...activeViewers] : [...activeViewers], [currentUser, activeViewers]);
    const displayUsers = allUsers.slice(0, 4); // Show max 4
    const overflow = Math.max(0, allUsers.length - 4);

    return (
        <div className="flex items-center -space-x-3 hover:space-x-1 transition-all duration-300">
            {displayUsers.map((user, i) => (
                <TooltipProvider key={user.id + i}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <motion.div
                                layoutId={`avatar-stack-${user.id}`}
                                className="relative group cursor-pointer"
                                whileHover={{ scale: 1.1, zIndex: 10, y: -2 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <div
                                    className="h-8 w-8 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-sm transition-all bg-muted text-muted-foreground"
                                    style={{
                                        borderColor: "hsl(var(--background))",
                                        backgroundColor: user.avatar ? undefined : getUserColorVariant(user.id, 'bg'),
                                        color: user.avatar ? undefined : getUserColor(user.id)
                                    }}
                                >
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" />
                                    ) : (
                                        user.name.slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                {/* Active Dot */}
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background bg-green-500 animate-pulse" />
                            </motion.div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="font-medium">{user.name} {user.id === currentUser?.id ? '(You)' : ''}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ))}
            {overflow > 0 && (
                <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shadow-sm z-0">
                    +{overflow}
                </div>
            )}
        </div>
    );
};

// --- Main Component ---

export function LiveCollaborationPane() {
    const { activeViewers } = useMeetingStore();
    const { currentUser } = useWorkspaceStore();
    const localStatus = useLocalPresence(60000); // 1 min timeout for idle

    // Simulate activity states for other users (replace with real WebSocket data later)
    const [viewerActivities, setViewerActivities] = useState<Record<string, { status: PresenceStatus, context: ActivityContext, latency: number }>>({});

    // Jump to User Logic
    const [focusedUser, setFocusedUser] = useState<string | null>(null);

    const handleJumpToUser = (userId: string) => {
        setFocusedUser(userId);
        console.log(`[PresenceEngine] Focusing view on user: ${userId}`);
        // Store dispatch or event bus emit would go here for actual scroll
        setTimeout(() => setFocusedUser(null), 1000); // Reset flash
    };

    // Update local user activity (simulated effect to console/store)
    useEffect(() => {
        // Here we would socket.emit('presence_update', { status: localStatus, context: 'Viewing' })
        // console.log("Local Presence Update:", localStatus);
    }, [localStatus]);

    // Initial random states for demo fidelity if existing viewers have no data
    useEffect(() => {
        if (activeViewers.length > 0) {
            const newStates: typeof viewerActivities = {};
            activeViewers.forEach(v => {
                if (!viewerActivities[v.id]) {
                    newStates[v.id] = {
                        status: Math.random() > 0.7 ? 'active' : 'idle',
                        context: Math.random() > 0.8 ? 'Typing' : 'Viewing',
                        latency: Math.floor(Math.random() * 200) + 20
                    };
                }
            });
            if (Object.keys(newStates).length > 0) {
                setViewerActivities(prev => ({ ...prev, ...newStates }));
            }
        }
    }, [activeViewers]);

    const allUsers = useMemo<DisplayUser[]>(() => {
        const list: DisplayUser[] = activeViewers.map(v => ({ ...v, isSelf: false }));
        if (currentUser) {
            // Add self to top of list
            list.unshift({ ...currentUser, isSelf: true });
        }
        return list;
    }, [activeViewers, currentUser]);

    return (
        <Card className="border-border/50 shadow-sm backdrop-blur-sm bg-card/50 overflow-hidden flex flex-col h-full max-h-[400px]">
            <CardHeader className="p-4 py-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0 sticky top-0 bg-background/80 z-20 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Live Presence</CardTitle>
                        <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            {activeViewers.length + (currentUser ? 1 : 0)} Active in session
                        </p>
                    </div>
                </div>
                <AvatarStack activeViewers={activeViewers} currentUser={currentUser} />
            </CardHeader>

            <CardContent className="p-0 overflow-y-auto custom-scrollbar flex-1">
                <AnimatePresence mode="popLayout" initial={false}>
                    {allUsers.length === 1 && !allUsers[0].isSelf && activeViewers.length === 0 ? (
                        // Fallback Empty State (should rarely confirm this condition if current user is added)
                        null
                    ) : allUsers.length === 1 && allUsers[0].isSelf ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3"
                        >
                            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                                <Wifi className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-sm font-medium">Waiting for colleagues...</h3>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                Share the link to collaborate with your team in real-time.
                            </p>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-2 mt-2 bg-background/50 hover:bg-accent/50">
                                <Copy className="h-3 w-3" />
                                Copy Invite Link
                            </Button>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {allUsers.map((user) => {
                                const isSelf = user.isSelf;
                                const userId = user.id;
                                const userColor = getUserColor(userId);
                                const activity = isSelf
                                    ? { status: localStatus, context: 'Viewing', latency: 12 }
                                    : viewerActivities[userId] || { status: 'active', context: 'Viewing', latency: 50 };

                                const ringColor = activity.status === 'active' ? userColor : 'transparent';

                                return (
                                    <motion.div
                                        key={userId}
                                        layout
                                        initial={{ opacity: 0, x: -20, height: 0 }}
                                        animate={{
                                            opacity: 1, x: 0, height: 'auto',
                                            backgroundColor: focusedUser === userId ? getUserColorVariant(userId, 'bg') : 'transparent'
                                        }}
                                        exit={{ opacity: 0, x: 20, height: 0 }}
                                        transition={{
                                            type: "spring", stiffness: 400, damping: 25,
                                            backgroundColor: { duration: 0.2 }
                                        }}
                                        className={cn(
                                            "flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group relative overflow-hidden",
                                            isSelf && "bg-primary/5 hover:bg-primary/10"
                                        )}
                                    >
                                        {/* Flash Effect Layer */}
                                        {focusedUser === userId && (
                                            <motion.div
                                                className="absolute inset-0 bg-primary/20 pointer-events-none"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: [0, 1, 0] }}
                                                transition={{ duration: 0.6 }}
                                            />
                                        )}

                                        {/* Avatar with Activity Ring */}
                                        <div className="relative shrink-0">
                                            <motion.div
                                                className="h-9 w-9 rounded-full p-[2px] transition-all duration-500"
                                                animate={{
                                                    borderColor: ringColor,
                                                    boxShadow: activity.status === 'active' ? `0 0 0 1px ${ringColor}30` : 'none'
                                                }}
                                                style={{ borderStyle: 'solid', borderWidth: '1.5px' }}
                                            >
                                                <div
                                                    className="h-full w-full rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                                                    style={{
                                                        backgroundColor: user.avatar ? undefined : getUserColorVariant(userId, 'bg'),
                                                        color: user.avatar ? undefined : userColor
                                                    }}
                                                >
                                                    {user.avatar ? (
                                                        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        user.name.slice(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                            </motion.div>

                                            {/* Typing Indicator / Status Badge */}
                                            {activity.context === 'Typing' && (
                                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border">
                                                    <div className="flex h-3 w-3 items-center justify-center">
                                                        <span className="flex space-x-[1px]">
                                                            <motion.span className="block h-1 w-1 bg-primary rounded-full" animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                                                            <motion.span className="block h-1 w-1 bg-primary rounded-full" animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                                                            <motion.span className="block h-1 w-1 bg-primary rounded-full" animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* User Info & Actions */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium truncate flex items-center gap-1.5">
                                                    {user.name}
                                                    {isSelf && <span className="text-[10px] text-muted-foreground/70 bg-muted px-1 rounded-sm">(You)</span>}
                                                </span>

                                                {!isSelf && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleJumpToUser(userId)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-background text-muted-foreground hover:text-primary focus:outline-none focus:opacity-100"
                                                        title="Jump to location"
                                                    >
                                                        <MousePointer2 className="h-3.5 w-3.5" />
                                                    </motion.button>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 mt-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "h-4 px-1 text-[9px] font-medium border-0 rounded-sm pointer-events-none uppercase tracking-wider",
                                                            activity.status === 'idle' ? "bg-muted text-muted-foreground" :
                                                                activity.context.includes('Typing') ? "bg-blue-500/10 text-blue-500" :
                                                                    "bg-green-500/10 text-green-500"
                                                        )}
                                                    >
                                                        {activity.context.includes('Typing') ? 'Typing...' :
                                                            activity.status === 'idle' ? 'Idle' :
                                                                activity.context}
                                                    </Badge>
                                                </div>

                                                <div
                                                    className={cn("text-[10px] flex items-center gap-1 ml-auto", getConnectivityColor(getConnectivityStatus(activity.latency)))}
                                                    title={`Latency: ${activity.latency}ms`}
                                                >
                                                    <Wifi className="h-3 w-3" />
                                                    <span className="hidden group-hover:inline opacity-70 tabular-nums">{activity.latency}ms</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

export default LiveCollaborationPane;

