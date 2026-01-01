import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Smile, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEmotionEngine } from "@/hooks/useEmotionEngine";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function EmotionDetection() {
    const {
        emotionStates,
        meetingMood,
        conflictRisks,
        participants
    } = useEmotionEngine();

    // -- Helpers --
    const getParticipantInfo = (pid: string) => {
        const p = participants.find(part => part.speakerId === pid);
        return {
            name: p?.name || pid,
            avatar: p?.avatar
        };
    };

    const getEmotionConfig = (emotion: string) => {
        switch (emotion) {
            case 'happy': return { label: 'Feliz', icon: Smile, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', glow: '142, 70%, 50%' };
            case 'frustrated': return { label: 'Frustrado', icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: '20, 90%, 50%' };
            case 'confused': return { label: 'Confuso', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', glow: '50, 90%, 50%' };
            case 'engaged': return { label: 'Engajado', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: '220, 80%, 55%' };
            case 'bored': return { label: 'Entediado', icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', glow: '0, 0%, 50%' };
            default: return { label: 'Neutro', icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', glow: '0, 0%, 50%' };
        }
    };

    // Calculate Trend (Mocking previous state for now as full history isn't in slice)
    // In a real SOTA implementation we'd compare with previous 10s slice
    const getTrendIcon = (confidence: number) => {
        if (confidence > 75) return <TrendingUp className="h-3 w-3 text-green-400" />;
        if (confidence < 40) return <TrendingDown className="h-3 w-3 text-red-400" />;
        return <Minus className="h-3 w-3 text-gray-400" />;
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-xl shadow-lg transition-all duration-300 overflow-hidden relative group">
            {/* -- Live Meeting Mood Nebula -- */}
            <div className="absolute inset-x-0 top-0 h-32 overflow-hidden pointer-events-none opacity-40">
                <motion.div
                    className="absolute inset-0 blur-3xl"
                    animate={{
                        background: `radial-gradient(circle at 50% -20%, ${meetingMood.color}, transparent 70%)`,
                        opacity: meetingMood.intensity
                    }}
                    transition={{ duration: 4, repeat: Infinity, repeatType: "mirror" }}
                />
            </div>

            <CardHeader className="p-4 border-b border-border relative z-10 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Smile className="h-4 w-4 text-primary" />
                        Intelligence Dashboard
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                        Clima: <span className="font-medium text-foreground" style={{ color: meetingMood.color }}>
                            {meetingMood.state}
                        </span>
                    </CardDescription>
                </div>
                {/* Conflict Alerts */}
                <AnimatePresence>
                    {conflictRisks.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                        >
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="destructive" className="animate-pulse shadow-md cursor-help flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Risco
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs bg-destructive text-destructive-foreground border-destructive/50">
                                        <div className="font-semibold mb-1">Conflito Potencial Detectado</div>
                                        <div className="text-xs">{conflictRisks[0]}</div>
                                        <div className="mt-2 text-xs opacity-90 border-t border-white/20 pt-1">
                                            Sugestão: Intervir para mediação
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardHeader>

            <CardContent className="p-0 relative z-10 max-h-[300px] overflow-y-auto custom-scrollbar">
                {emotionStates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground opacity-50">
                        <Smile className="h-8 w-8 mb-2 stroke-1" />
                        <span className="text-xs">A aguardar dados emocionais...</span>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        <AnimatePresence>
                            {emotionStates.map((state) => {
                                const info = getParticipantInfo(state.participantId);
                                const config = getEmotionConfig(state.emotion);

                                // Aura Intensity calculation
                                const glowOpacity = Math.max(0.1, state.confidence / 100);
                                const glowSize = Math.max(2, (state.confidence / 100) * 8);

                                return (
                                    <motion.div
                                        key={state.participantId}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="p-3 hover:bg-muted/50 transition-colors group/item relative"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar with Aura */}
                                            <div className="relative">
                                                <motion.div
                                                    className="absolute inset-0 rounded-full"
                                                    animate={{
                                                        boxShadow: `0 0 ${glowSize}px hsla(${config.glow}, ${glowOpacity})`
                                                    }}
                                                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                                                />
                                                <Avatar className="h-9 w-9 border border-border relative z-10">
                                                    <AvatarImage src={info.avatar} />
                                                    <AvatarFallback className="text-[10px] bg-background">
                                                        {info.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>

                                                {/* Mini Emotion Icon Badge */}
                                                <div className={cn(
                                                    "absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center border border-background shadow-sm z-20 bg-card",
                                                    config.color
                                                )}>
                                                    <config.icon className="h-2.5 w-2.5" />
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-sm font-medium truncate">{info.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {getTrendIcon(state.confidence)}
                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                            {state.confidence}%
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn("text-[10px] px-1.5 py-0 h-5 font-normal border-0", config.bg, config.color)}
                                                    >
                                                        {config.label}
                                                    </Badge>

                                                    {/* Explainable AI Tooltip */}
                                                    {state.reasoning && (
                                                        <TooltipProvider>
                                                            <Tooltip delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <Info className="h-3 w-3 text-muted-foreground/50 hover:text-primary cursor-help transition-colors" />
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right" className="text-xs max-w-[200px]">
                                                                    {state.reasoning}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Fallback logic for Emotion Detection if props are missing
EmotionDetection.defaultProps = {
    // any default props
};
