import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, X, Check, AlertCircle, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";

export function NotificationCenter() {
    const {
        notifications,
        markNotificationAsRead,
        dismissNotification,
        clearAllNotifications
    } = useMeetingStore();
    const [isOpen, setIsOpen] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;
    const recentNotifications = notifications.slice(0, 10);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'info':
                return <Info className="h-4 w-4" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4" />;
            case 'error':
                return <AlertCircle className="h-4 w-4" />;
            case 'success':
                return <CheckCircle2 className="h-4 w-4" />;
            default:
                return <Info className="h-4 w-4" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'info':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'warning':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'error':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'success':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'border-red-500/50';
            case 'medium':
                return 'border-yellow-500/50';
            case 'low':
                return 'border-gray-500/50';
            default:
                return 'border-gray-500/50';
        }
    };

    return (
        <div className="relative">
            {/* Notification Bell Button */}
            <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center"
                    >
                        <span className="text-xs font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </motion.div>
                )}
            </Button>

            {/* Notification Panel */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-0 mt-2 w-80 z-50"
                    >
                        <Card className="border-border bg-card/95 backdrop-blur-sm shadow-lg">
                            <CardHeader className="p-3 border-b border-border shrink-0">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Bell className="h-4 w-4" />
                                        Notificações
                                        {unreadCount > 0 && (
                                            <Badge variant="outline" className="text-xs">
                                                {unreadCount} não lidas
                                            </Badge>
                                        )}
                                    </CardTitle>
                                    <div className="flex items-center gap-1">
                                        {unreadCount > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs"
                                                onClick={() => {
                                                    notifications.filter(n => !n.read).forEach(n => {
                                                        markNotificationAsRead(n.id);
                                                    });
                                                }}
                                            >
                                                <Check className="h-3 w-3 mr-1" />
                                                Marcar todas
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {recentNotifications.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                        Nenhuma notificação
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        <AnimatePresence mode="popLayout">
                                            {recentNotifications.map((notification, index) => (
                                                <motion.div
                                                    key={notification.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 10 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className={cn(
                                                        "p-3 hover:bg-accent/50 transition-colors",
                                                        !notification.read && "bg-accent/20"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "p-2 rounded border text-xs space-y-2",
                                                        getTypeColor(notification.type),
                                                        getPriorityColor(notification.priority || 'medium')
                                                    )}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2 flex-1">
                                                                {getTypeIcon(notification.type)}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-semibold leading-relaxed">
                                                                        {notification.title}
                                                                    </p>
                                                                    <p className="opacity-90 mt-1">
                                                                        {notification.message}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {!notification.read && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-5 w-5 p-0"
                                                                        onClick={() => markNotificationAsRead(notification.id)}
                                                                        title="Marcar como lida"
                                                                    >
                                                                        <Check className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-5 w-5 p-0"
                                                                    onClick={() => dismissNotification(notification.id)}
                                                                    title="Dispensar"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </CardContent>
                            {notifications.length > 0 && (
                                <div className="p-2 border-t border-border">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs h-7"
                                        onClick={clearAllNotifications}
                                    >
                                        Limpar Todas
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </motion.div>
                </>
            )}
        </div>
    );
}

