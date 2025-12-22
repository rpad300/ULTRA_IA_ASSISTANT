import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion, AnimatePresence } from "framer-motion";

export function ConflictDetection() {
    const {
        conflicts,
        isRecording,
        detectConflicts
    } = useMeetingStore();

    // Detect conflicts periodically
    useEffect(() => {
        if (!isRecording) return;

        const interval = setInterval(() => {
            detectConflicts();
        }, 30000); // Detect every 30 seconds (optimized for performance)

        return () => clearInterval(interval);
    }, [isRecording, detectConflicts]);

    const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
        switch (severity) {
            case 'low':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'medium':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'high':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
    };

    if (conflicts.length === 0) {
        return null; // Don't show if no conflicts
    }

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    Conflitos Detectados
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <AnimatePresence mode="popLayout">
                    {conflicts.map((conflict, index) => (
                        <motion.div
                            key={conflict.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                getSeverityColor(conflict.severity)
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Badge variant="outline" className="text-xs">
                                            {conflict.severity === 'high' ? 'Alto' : conflict.severity === 'medium' ? 'Médio' : 'Baixo'}
                                        </Badge>
                                        <span className="text-xs opacity-70">
                                            {conflict.participants.join(', ')}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-xs font-medium leading-relaxed">
                                    {conflict.summary}
                                </p>

                                {conflict.resolutionSuggestions.length > 0 && (
                                    <div className="pt-2 space-y-1">
                                        <p className="text-xs font-semibold opacity-90 mb-1">
                                            Sugestões de resolução:
                                        </p>
                                        <ul className="space-y-1 pl-3">
                                            {conflict.resolutionSuggestions.slice(0, 3).map((suggestion, idx) => (
                                                <li key={idx} className="text-xs opacity-80 list-disc">
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
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

