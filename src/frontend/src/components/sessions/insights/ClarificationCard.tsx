import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Clarification } from "@/store/meetingStore";
import { formatTime } from "@/utils/timeUtils";
import { motion } from "framer-motion";

interface ClarificationCardProps {
    clarification: Clarification;
    index: number;
    isGrouped?: boolean; // If true, styling might be slightly reduced to fit in group
}

export const ClarificationCard = memo(({ clarification, index, isGrouped = false }: ClarificationCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
            className="w-full"
        >
            <Card className={cn(
                "border-l-4 transition-all bg-card/40 hover:bg-card/60 backdrop-blur-sm",
                "border-yellow-400 dark:border-yellow-500", // Opportunity color
                isGrouped ? "ml-4 border-l-2 shadow-none" : "shadow-sm hover:shadow"
            )}>
                <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                        <div className="bg-yellow-500/10 p-1.5 rounded-full mt-0.5 shrink-0">
                            <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Clarification Opportunity
                                </h4>
                                <span className="text-[10px] text-muted-foreground">
                                    {formatTime(clarification.timestamp)}
                                </span>
                            </div>

                            <p className="text-sm font-medium leading-snug text-foreground/90">
                                {clarification.suggestion}
                            </p>

                            {clarification.context && (
                                <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                    <HelpCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                    <span className="italic">"{clarification.context}"</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

ClarificationCard.displayName = "ClarificationCard";
