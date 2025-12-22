import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";

interface Reminder {
    id: string;
    type: 'follow-up' | 'confirmation' | 'deadline' | 'promise';
    message: string;
    context?: string;
    timestamp: number;
    dismissed?: boolean;
}

export function SmartReminders() {
    const {
        transcriptBlocks,
        isRecording
    } = useMeetingStore();
    const [reminders, setReminders] = useState<Reminder[]>([]);

    // Generate reminders based on transcript
    useEffect(() => {
        if (!isRecording || transcriptBlocks.length === 0) return;

        const interval = setInterval(() => {
            const newReminders: Reminder[] = [];
            const recentBlocks = transcriptBlocks.slice(-20);
            const recentText = recentBlocks.map(b => b.text.toLowerCase()).join(' ');

            // Check for unconfirmed budget mentions
            if ((recentText.includes('orçamento') || recentText.includes('budget')) &&
                !recentText.includes('confirm') &&
                !recentText.includes('aprovado') &&
                !recentText.includes('approved')) {
                const existingReminder = reminders.find(r =>
                    r.type === 'confirmation' && r.message.includes('orçamento')
                );
                if (!existingReminder) {
                    newReminders.push({
                        id: `reminder-${Date.now()}-budget`,
                        type: 'confirmation',
                        message: 'Orçamento foi mencionado mas não foi confirmado',
                        context: 'Na preparação foi mencionado que o orçamento precisava ser confirmado',
                        timestamp: Date.now()
                    });
                }
            }

            // Check for unconfirmed deadlines
            if ((recentText.includes('prazo') || recentText.includes('deadline') || recentText.includes('entrega')) &&
                !recentText.includes('confirm') &&
                !recentText.includes('definido')) {
                const existingReminder = reminders.find(r =>
                    r.type === 'deadline' && r.message.includes('prazo')
                );
                if (!existingReminder) {
                    newReminders.push({
                        id: `reminder-${Date.now()}-deadline`,
                        type: 'deadline',
                        message: 'Prazo foi mencionado mas não foi confirmado',
                        context: 'Considere confirmar o prazo explicitamente',
                        timestamp: Date.now()
                    });
                }
            }

            // Check for promises/commitments
            const promiseIndicators = ['vou fazer', 'vou enviar', 'vou confirmar', 'i will', 'i\'ll', 'prometo', 'promise'];
            const hasPromise = promiseIndicators.some(indicator => recentText.includes(indicator));
            if (hasPromise) {
                const lastBlock = recentBlocks[recentBlocks.length - 1];
                const existingReminder = reminders.find(r =>
                    r.type === 'promise' &&
                    (Date.now() - r.timestamp) < 30000 // Within last 30 seconds
                );
                if (!existingReminder && lastBlock) {
                    newReminders.push({
                        id: `reminder-${Date.now()}-promise`,
                        type: 'promise',
                        message: `Compromisso detectado: "${lastBlock.text.substring(0, 50)}..."`,
                        context: 'Considere criar uma task para este compromisso',
                        timestamp: Date.now()
                    });
                }
            }

            // Check for follow-ups needed
            const followUpIndicators = ['depois', 'mais tarde', 'seguir', 'follow up', 'follow-up', 'retomar'];
            if (followUpIndicators.some(ind => recentText.includes(ind))) {
                const existingReminder = reminders.find(r =>
                    r.type === 'follow-up' &&
                    (Date.now() - r.timestamp) < 60000 // Within last minute
                );
                if (!existingReminder) {
                    newReminders.push({
                        id: `reminder-${Date.now()}-followup`,
                        type: 'follow-up',
                        message: 'Tópico foi marcado para follow-up',
                        context: 'Não se esqueça de retomar este tópico',
                        timestamp: Date.now()
                    });
                }
            }

            // Add new reminders
            if (newReminders.length > 0) {
                setReminders(prev => [...prev, ...newReminders].slice(-10)); // Keep last 10
            }
        }, 30000); // Check every 30 seconds (optimized for performance)

        return () => clearInterval(interval);
    }, [isRecording, transcriptBlocks, reminders]);

    const handleDismiss = (id: string) => {
        setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, dismissed: true } : r
        ));
    };

    const handleMarkAddressed = (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id));
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'follow-up':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'confirmation':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'deadline':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'promise':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'follow-up': 'Follow-up',
            'confirmation': 'Confirmação',
            'deadline': 'Prazo',
            'promise': 'Compromisso'
        };
        return labels[type] || type;
    };

    const activeReminders = reminders.filter(r => !r.dismissed).slice(-5);

    if (activeReminders.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        Lembretes Inteligentes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Lembretes contextuais aparecerão aqui
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Lembretes Inteligentes
                    <Badge variant="outline" className="ml-auto text-xs">
                        {activeReminders.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <AnimatePresence mode="popLayout">
                    {activeReminders.map((reminder, index) => (
                        <motion.div
                            key={reminder.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                getTypeColor(reminder.type)
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Badge variant="outline" className="text-xs">
                                            {getTypeLabel(reminder.type)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => handleMarkAddressed(reminder.id)}
                                            title="Marcar como abordado"
                                        >
                                            <CheckCircle2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => handleDismiss(reminder.id)}
                                            title="Dispensar"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <p className="text-xs font-medium leading-relaxed">
                                    {reminder.message}
                                </p>

                                {reminder.context && (
                                    <div className="pt-1 border-t border-current/20">
                                        <p className="text-xs opacity-80 italic">
                                            📌 {reminder.context}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

