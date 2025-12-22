import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smile, Frown, Meh, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";

export function EmotionDetection() {
    const { 
        emotionStates, 
        participants,
        transcriptBlocks,
        isRecording,
        updateEmotionState,
        analyzeSentiment
    } = useMeetingStore();
    
    // Update emotion states based on sentiment analysis
    useEffect(() => {
        if (!isRecording || transcriptBlocks.length === 0) return;
        
        const interval = setInterval(() => {
            // Analyze recent blocks for each participant
            const recentBlocks = transcriptBlocks.slice(-10);
            const participantBlocks = new Map<string, typeof transcriptBlocks>();
            
            recentBlocks.forEach(block => {
                const speakerId = block.speakerId || block.speaker;
                if (!participantBlocks.has(speakerId)) {
                    participantBlocks.set(speakerId, []);
                }
                participantBlocks.get(speakerId)!.push(block);
            });
            
            participantBlocks.forEach((blocks, speakerId) => {
                const texts = blocks.map(b => b.text).join(' ');
                const sentiment = analyzeSentiment(texts);
                
                // Map sentiment to emotion
                let emotion: 'happy' | 'neutral' | 'frustrated' | 'confused' | 'engaged' | 'bored' = 'neutral';
                let confidence = 50;
                
                if (sentiment === 'positive') {
                    emotion = 'happy';
                    confidence = 70;
                } else if (sentiment === 'negative') {
                    // Check for frustration vs confusion
                    const frustrationWords = ['não', 'problema', 'erro', 'falha', 'no', 'problem', 'error', 'wrong'];
                    const confusionWords = ['não entendi', 'confuso', 'como', 'what', 'confused', 'how', 'clarify'];
                    
                    const hasFrustration = frustrationWords.some(w => texts.toLowerCase().includes(w));
                    const hasConfusion = confusionWords.some(w => texts.toLowerCase().includes(w));
                    
                    if (hasFrustration) {
                        emotion = 'frustrated';
                        confidence = 75;
                    } else if (hasConfusion) {
                        emotion = 'confused';
                        confidence = 70;
                    } else {
                        emotion = 'frustrated';
                        confidence = 60;
                    }
                } else {
                    // Check for engagement vs boredom
                    const engagementIndicators = ['ótimo', 'excelente', 'perfeito', 'great', 'excellent', 'perfect', 'yes', 'sim'];
                    const boredomIndicators = ['ok', 'tudo bem', 'whatever', 'fine', 'sure'];
                    
                    const engagementCount = engagementIndicators.filter(w => texts.toLowerCase().includes(w)).length;
                    const boredomCount = boredomIndicators.filter(w => texts.toLowerCase().includes(w)).length;
                    
                    if (engagementCount > boredomCount) {
                        emotion = 'engaged';
                        confidence = 65;
                    } else if (boredomCount > 0) {
                        emotion = 'bored';
                        confidence = 60;
                    } else {
                        emotion = 'neutral';
                        confidence = 50;
                    }
                }
                
                updateEmotionState(speakerId, emotion, confidence);
            });
        }, 30000); // Update every 30 seconds (optimized for performance)
        
        return () => clearInterval(interval);
    }, [isRecording, transcriptBlocks, updateEmotionState, analyzeSentiment]);
    
    const getEmotionIcon = (emotion: string) => {
        switch (emotion) {
            case 'happy':
                return <Smile className="h-4 w-4 text-green-400" />;
            case 'frustrated':
                return <Frown className="h-4 w-4 text-red-400" />;
            case 'confused':
                return <AlertCircle className="h-4 w-4 text-yellow-400" />;
            case 'engaged':
                return <TrendingUp className="h-4 w-4 text-blue-400" />;
            case 'bored':
                return <Meh className="h-4 w-4 text-gray-400" />;
            default:
                return <Meh className="h-4 w-4 text-gray-400" />;
        }
    };
    
    const getEmotionLabel = (emotion: string) => {
        const labels: Record<string, string> = {
            happy: 'Feliz',
            neutral: 'Neutro',
            frustrated: 'Frustrado',
            confused: 'Confuso',
            engaged: 'Engajado',
            bored: 'Entediado'
        };
        return labels[emotion] || emotion;
    };
    
    const getEmotionColor = (emotion: string) => {
        switch (emotion) {
            case 'happy':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'frustrated':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'confused':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'engaged':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'bored':
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };
    
    if (emotionStates.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Smile className="h-4 w-4 text-primary" />
                        Emoções & Engajamento
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Estados emocionais aparecerão aqui
                    </p>
                </CardContent>
            </Card>
        );
    }
    
    // Get participant names
    const getParticipantName = (participantId: string) => {
        const participant = participants.find(p => p.speakerId === participantId);
        if (participant?.name) return participant.name;
        if (participant?.contactId) return `Contact ${participant.contactId}`;
        return participantId;
    };
    
    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Smile className="h-4 w-4 text-primary" />
                    Emoções & Engajamento
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {emotionStates.map((emotionState, index) => (
                    <motion.div
                        key={emotionState.participantId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <div className={cn(
                            "p-3 rounded-lg border text-xs flex items-center justify-between gap-2",
                            getEmotionColor(emotionState.emotion)
                        )}>
                            <div className="flex items-center gap-2 flex-1">
                                {getEmotionIcon(emotionState.emotion)}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                        {getParticipantName(emotionState.participantId)}
                                    </p>
                                    <p className="text-xs opacity-70">
                                        {getEmotionLabel(emotionState.emotion)}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                {emotionState.confidence}%
                            </Badge>
                        </div>
                    </motion.div>
                ))}
            </CardContent>
        </Card>
    );
}

