import { motion } from 'framer-motion';
import type { QuickAction } from '@/hooks/useAICoPilotEngine';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
    actions: QuickAction[];
    onActionSelect: (prompt: string) => void;
    disabled?: boolean;
}

export function QuickActions({ actions, onActionSelect, disabled }: QuickActionsProps) {
    return (
        <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar mask-gradient-x">
            {actions.map((action, i) => (
                <motion.button
                    key={action.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => onActionSelect(action.prompt)}
                    disabled={disabled}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                        "bg-background/40 backdrop-blur-md border-primary/10 hover:border-primary/30",
                        "text-muted-foreground hover:text-primary hover:bg-primary/5",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {action.category === 'analysis' && <Sparkles className="h-3 w-3 text-amber-500" />}
                    {action.label}
                </motion.button>
            ))}
        </div>
    );
}
