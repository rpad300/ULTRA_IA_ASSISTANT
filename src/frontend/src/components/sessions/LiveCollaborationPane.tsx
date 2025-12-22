import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";

export function LiveCollaborationPane() {
    const { activeViewers } = useMeetingStore();
    const [currentUser] = useState({ id: 'user-1', name: 'You', avatar: undefined });

    // Viewers are managed by the meeting store via WebSocket or real-time updates
    // No mock data - all viewers come from actual collaboration state

    const allViewers = [currentUser, ...activeViewers];

    return (
        <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Live Collaboration
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {allViewers.length}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {allViewers.map((viewer, index) => (
                            <motion.div
                                key={viewer.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ delay: index * 0.1 }}
                                className={cn(
                                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                                    viewer.id === currentUser.id
                                        ? "bg-primary/10 border-primary/20"
                                        : "bg-card border-border hover:border-primary/40"
                                )}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                                    viewer.id === currentUser.id
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                    {viewer.avatar ? (
                                        <img src={viewer.avatar} alt={viewer.name} className="h-full w-full rounded-full" />
                                    ) : (
                                        viewer.name[0]?.toUpperCase() || '?'
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {viewer.name}
                                        {viewer.id === currentUser.id && (
                                            <span className="text-xs text-muted-foreground ml-1">(You)</span>
                                        )}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Wifi className="h-3 w-3 text-green-500" />
                                        <span>Watching live</span>
                                    </div>
                                </div>
                                {viewer.id !== currentUser.id && (
                                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                                        Active
                                    </Badge>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {allViewers.length === 1 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        You're the only one watching. Share the link to collaborate!
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

