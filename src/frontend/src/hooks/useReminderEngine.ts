import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { toBrand } from '@/types/slices/intelligence';
import type { TimestampMs, BlockId, DetectedAction } from '@/types/slices/intelligence';

export type ReminderType = 'follow-up' | 'confirmation' | 'deadline' | 'promise' | 'missing_topic';

export interface Reminder {
    id: string;
    type: ReminderType;
    message: string;
    context?: string;
    timestamp: number;
    dismissed?: boolean;
    snoozedUntil?: number;
    autoResolved?: boolean;
    priority?: 'high' | 'medium' | 'low';
    relatedBlockId?: string; // For Deep Linking
    status?: 'active' | 'resolving' | 'dismissed'; // New for Ghost Animation
}

export function useReminderEngine() {
    const {
        transcriptBlocks,
        isRecording,
        addDetectedAction,
        setFocusedBlockId,
        prepDocuments,
        elapsedTime
    } = useMeetingStore();

    const [reminders, setReminders] = useState<Reminder[]>([]);

    // --- Helpers ---
    const isSnoozed = (r: Reminder) => r.snoozedUntil ? r.snoozedUntil > Date.now() : false;

    const playNotificationSound = () => {
        // Placeholder for low-profile sound
        console.log("🎵 Playing Low-Profile Notification Sound...");
    };

    // --- Core Logic: Analysis Loop ---
    useEffect(() => {
        if (!isRecording || transcriptBlocks.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const newReminders: Reminder[] = [];

            // Get recent context (last 20 blocks ~ 1-2 mins)
            const recentBlocks = transcriptBlocks.slice(-20);
            const recentText = recentBlocks.map(b => b.text.toLowerCase()).join(' ');

            // Get even more recent for trigger detection (last 3 blocks)
            const lastBlock = recentBlocks[recentBlocks.length - 1];
            if (!lastBlock) return;

            // 1. Closed Loop Verification (Auto-Resolve)
            setReminders(prev => {
                return prev.map(r => {
                    if (r.type === 'promise' && r.status !== 'dismissed' && !r.autoResolved) {
                        const keywords = r.message.toLowerCase()
                            .replace('compromisso detectado:', '')
                            .replace(/['"]/g, '')
                            .split(' ')
                            .filter(w => w.length > 4);

                        const confirmationIndicators = ['já enviei', 'feito', 'está pronto', 'sent it', 'done', 'completed'];
                        const isAddressed = confirmationIndicators.some(ind => recentText.includes(ind)) &&
                            keywords.some(k => recentText.includes(k));

                        if (isAddressed) {
                            // Trigger Ghost Animation State
                            return { ...r, autoResolved: true, status: 'resolving' };
                        }
                    }
                    return r;
                });
            });

            // 2. Detection Logic

            // A. Budget/Confirmation
            if ((recentText.includes('orçamento') || recentText.includes('budget')) &&
                !recentText.includes('confirm') &&
                !recentText.includes('aprovado')) {
                const existing = reminders.find(r => r.type === 'confirmation' && r.message.includes('Orçamento'));
                if (!existing) {
                    const r: Reminder = {
                        id: `reminder-${now}-budget`,
                        type: 'confirmation',
                        message: 'Orçamento mencionado sem confirmação',
                        context: 'O tópico de orçamento ficou em aberto.',
                        timestamp: now,
                        priority: 'high',
                        relatedBlockId: lastBlock.id,
                        status: 'active'
                    };
                    newReminders.push(r);
                    if (r.priority === 'high') playNotificationSound();
                }
            }

            // B. Deadlines
            if ((recentText.includes('prazo') || recentText.includes('deadline') || recentText.includes('entrega')) &&
                !recentText.includes('definido') && !recentText.includes('defined')) {
                const existing = reminders.find(r => r.type === 'deadline' && (now - r.timestamp) < 60000 * 5); // 5 min cooldown
                if (!existing) {
                    newReminders.push({
                        id: `reminder-${now}-deadline`,
                        type: 'deadline',
                        message: 'Prazo mencionado mas não definido',
                        context: 'Sugerimos definir uma data específica.',
                        timestamp: now,
                        priority: 'medium',
                        relatedBlockId: lastBlock.id,
                        status: 'active'
                    });
                }
            }

            // C. Promises (Enhanced Regex)
            const promiseRegex = /(eu vou|i will|i'll|vou enviar|vou fazer|let me|deixa comigo)/i;
            if (promiseRegex.test(lastBlock.text)) {
                const existing = reminders.find(r => r.type === 'promise' && (now - r.timestamp) < 30000);
                if (!existing) {
                    newReminders.push({
                        id: `reminder-${now}-promise`,
                        type: 'promise',
                        message: `Compromisso: "${lastBlock.text.substring(0, 40)}..."`,
                        context: 'Detectamos uma promessa de ação.',
                        timestamp: now,
                        priority: 'medium',
                        relatedBlockId: lastBlock.id,
                        status: 'active'
                    });
                }
            }

            // D. Follow-Ups (Restored)
            const followUpIndicators = ['depois', 'mais tarde', 'seguir', 'follow up', 'follow-up', 'retomar'];
            if (followUpIndicators.some(ind => recentText.includes(ind))) {
                const existing = reminders.find(r =>
                    r.type === 'follow-up' && (now - r.timestamp) < 60000
                );
                if (!existing) {
                    newReminders.push({
                        id: `reminder-${now}-followup`,
                        type: 'follow-up',
                        message: 'Tópico marcado para follow-up',
                        context: 'Não se esqueça de retomar este tópico.',
                        timestamp: now,
                        priority: 'low',
                        relatedBlockId: lastBlock.id,
                        status: 'active'
                    });
                }
            }

            // E. Missing Question (Prep Integration)
            if (elapsedTime > 600 && prepDocuments.length > 0) {
                const lastPrep = prepDocuments[prepDocuments.length - 1];
                const pendingTopics = lastPrep.likelyTopics.filter(t => t.status === 'pending');

                if (pendingTopics.length > 0) {
                    const topic = pendingTopics[0];
                    const existing = reminders.find(r => r.type === 'missing_topic' && r.message.includes(topic.topic));

                    if (!existing) {
                        newReminders.push({
                            id: `reminder-${now}-missing-${topic.topic.replace(/\s/g, '')}`,
                            type: 'missing_topic',
                            message: `Tópico não abordado: ${topic.topic}`,
                            context: 'Este item estava na pauta preparada.',
                            timestamp: now,
                            priority: 'medium',
                            relatedBlockId: undefined, // General prompt
                            status: 'active'
                        });
                    }
                }
            }

            if (newReminders.length > 0) {
                setReminders(prev => [...prev, ...newReminders]);
            }

        }, 5000);

        return () => clearInterval(interval);
    }, [isRecording, transcriptBlocks, reminders, elapsedTime, prepDocuments]);

    // Handle 'Resolving' State Transition
    useEffect(() => {
        const resolvingItems = reminders.filter(r => r.status === 'resolving');
        if (resolvingItems.length > 0) {
            const timer = setTimeout(() => {
                setReminders(prev => prev.map(r =>
                    r.status === 'resolving' ? { ...r, status: 'dismissed', dismissed: true } : r
                ));
            }, 1500); // 1.5s ghost animation duration
            return () => clearTimeout(timer);
        }
    }, [reminders]);

    // --- Actions ---

    const dismissReminder = useCallback((id: string) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed', dismissed: true } : r));
    }, []);

    const markAsAddressed = useCallback((id: string) => {
        // Trigger Ghost Animation
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'resolving', autoResolved: true } : r));
    }, []);

    const snoozeReminder = useCallback((id: string) => {
        setReminders(prev => prev.map(r =>
            r.id === id
                ? { ...r, snoozedUntil: Date.now() + (5 * 60 * 1000) }
                : r
        ));
    }, []);

    const transformToTask = useCallback((reminder: Reminder) => {
        const action: DetectedAction = {
            id: `act-${Date.now()}`, // Temporary ID, usually generated by store or backend
            text: reminder.message.replace('Compromisso: ', '').replace(/"/g, ''),
            timestamp: toBrand<TimestampMs>(Date.now()),
            // status: 'pending', // Removed as it's not in DetectedAction interface
            confidence: 1.0,
            priority: reminder.priority || 'medium', // Ensure priority is set
            lineage: reminder.relatedBlockId ? { blockId: toBrand<BlockId>(reminder.relatedBlockId) } : undefined
        };
        addDetectedAction(action);
        markAsAddressed(reminder.id);
    }, [addDetectedAction, markAsAddressed]);

    const jumpToContext = useCallback((blockId?: string) => {
        if (blockId) {
            setFocusedBlockId(blockId);
        }
    }, [setFocusedBlockId]);

    const activeReminders = useMemo(() =>
        reminders.filter(r => r.status !== 'dismissed' && !isSnoozed(r)).slice(-10),
        [reminders]);

    return {
        activeReminders,
        dismissReminder,
        markAsAddressed,
        snoozeReminder,
        transformToTask,
        jumpToContext
    };
}
