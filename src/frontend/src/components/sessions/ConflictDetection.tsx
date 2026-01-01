import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Copy, Thermometer, ChevronDown, ChevronUp, Eye, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useConflictEngine } from "@/hooks/useConflictEngine";
import { toast } from "sonner";

export function ConflictDetection() {
    const {
        conflicts,
        meetingTemperature,
        isProcessing
    } = useConflictEngine();

    const [isCollapsed, setIsCollapsed] = useState(false);

    // Liquid Animation for Temperature
    const temperatureColor = meetingTemperature > 80 ? 'bg-orange-500' :
        meetingTemperature > 50 ? 'bg-yellow-500' : 'bg-blue-400';

    const handleCopyScript = (script: string) => {
        navigator.clipboard.writeText(script);
        toast.success("Script copiado para a área de transferência");
    };

    // Invisible if calm and not processing, or if collapsed and nothing major
    if (conflicts.length === 0 && meetingTemperature < 30 && !isProcessing) {
        return null;
    }

    return (
        <Card className="border-border/50 bg-background/60 backdrop-blur-xl shadow-lg transition-all duration-300">
            <CardHeader className="p-3 border-b border-border/50 shrink-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                    <div className="relative">
                        <AlertTriangle className={cn("h-4 w-4 transition-colors", meetingTemperature > 60 ? "text-orange-500 animate-pulse" : "text-muted-foreground")} />
                        {/* Heatmap Glow Effect */}
                        {meetingTemperature > 60 && (
                            <div className="absolute inset-0 bg-orange-500/50 blur-md rounded-full animate-ping opacity-20" />
                        )}
                    </div>
                    Mediação Inteligente
                    {isProcessing && (
                        <Activity className="h-3 w-3 text-muted-foreground animate-spin ml-1 opacity-50" />
                    )}
                </CardTitle>

                <div className="flex items-center gap-2">
                    {/* Meeting Temperature UI */}
                    <div className="h-8 w-1.5 bg-secondary/50 rounded-full overflow-hidden relative" title={`Temperatura da Reunião: ${meetingTemperature}%`}>
                        <motion.div
                            className={cn("w-full absolute bottom-0 rounded-full", temperatureColor)}
                            initial={{ height: "20%" }}
                            animate={{ height: `${meetingTemperature}%` }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        >
                            {/* Boiling Particles Effect for High Temp */}
                            {meetingTemperature > 80 && (
                                <motion.div
                                    className="absolute inset-0 bg-white/30"
                                    animate={{ opacity: [0, 1, 0], y: [0, -10] }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                />
                            )}
                        </motion.div>
                    </div>

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-secondary rounded-md"
                    >
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>
            </CardHeader>

            <AnimatePresence>
                {!isCollapsed && (
                    <CardContent className="p-3 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {conflicts.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4 italic">
                                Ambiente colaborativo detetado.
                            </p>
                        ) : (
                            conflicts.map((conflict, index) => (
                                <motion.div
                                    key={conflict.id}
                                    initial={{ opacity: 0, scale: 0.98, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={cn(
                                        "group rounded-lg border p-3 transition-all",
                                        conflict.severity === 'high'
                                            ? "bg-red-500/5 border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]"
                                            : "bg-card/50 border-border/50"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={conflict.severity === 'high' ? 'destructive' : 'outline'} className="text-[10px] uppercase px-1.5 h-5">
                                                {conflict.severity === 'high' ? 'Crítico' : 'Atenção'}
                                            </Badge>
                                            <span className="text-xs font-medium text-foreground/80">
                                                {conflict.participants.length > 0 ? conflict.participants.join(', ') : 'Participantes'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                            {new Date(conflict.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>

                                    <p className="text-xs text-foreground/90 font-medium leading-relaxed mb-3">
                                        {conflict.summary}
                                    </p>

                                    {/* Peacekeeper Script Box */}
                                    {conflict.resolutionSuggestions.length > 0 && (
                                        <div className="bg-background/50 rounded-md border border-border/50 p-2 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                                                    <Thermometer size={10} />
                                                    SCRIPT SUGERIDO
                                                </span>
                                                <button
                                                    onClick={() => handleCopyScript(conflict.resolutionSuggestions[0])}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground"
                                                    title="Copiar Script"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                            <p className="text-xs italic text-muted-foreground font-serif border-l-2 border-primary/30 pl-2">
                                                "{conflict.resolutionSuggestions[0]}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions Footer */}
                                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/30">
                                        <button
                                            className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                                            onClick={() => toast.info("Funcionalidade de deep-link para transcrição em breve!")}
                                        >
                                            <Eye size={10} />
                                            Ver Fonte
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </CardContent>
                )}
            </AnimatePresence>
        </Card>
    );
}
