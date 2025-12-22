import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare,
    Mail,
    Phone,
    Calendar,
    Clock,
    Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CommunicationStyle {
    style: 'formal' | 'casual' | 'technical' | 'emotional' | 'mixed';
    preferredChannel: 'email' | 'call' | 'meeting' | 'mixed';
    averageResponseTime: string;
    preferredTimes: string[];
    tone: 'positive' | 'neutral' | 'negative' | 'mixed';
    bestPractices: string[];
}

interface CommunicationStyleAnalysisProps {
    contactId: string;
    meetingsCount?: number;
    emailCount?: number;
    callCount?: number;
}

export function CommunicationStyleAnalysis({
    meetingsCount = 0,
    emailCount = 0,
    callCount = 0
}: CommunicationStyleAnalysisProps) {
    const style: CommunicationStyle = useMemo(() => {
        // Simulate AI analysis based on available data

        // Determine style
        let detectedStyle: CommunicationStyle['style'] = 'mixed';
        if (meetingsCount > emailCount && meetingsCount > callCount) {
            detectedStyle = 'formal';
        } else if (emailCount > meetingsCount) {
            detectedStyle = 'casual';
        } else if (callCount > meetingsCount) {
            detectedStyle = 'emotional';
        }

        // Determine preferred channel
        let preferredChannel: CommunicationStyle['preferredChannel'] = 'mixed';
        if (meetingsCount > emailCount && meetingsCount > callCount) {
            preferredChannel = 'meeting';
        } else if (emailCount > callCount) {
            preferredChannel = 'email';
        } else if (callCount > emailCount) {
            preferredChannel = 'call';
        }

        // Generate best practices
        const bestPractices: string[] = [];
        if (detectedStyle === 'formal') {
            bestPractices.push("Use dados e métricas em comunicações");
            bestPractices.push("Agende reuniões estruturadas com agenda");
            bestPractices.push("Siga com resumos escritos após reuniões");
        } else if (detectedStyle === 'casual') {
            bestPractices.push("Comunicação direta e objetiva");
            bestPractices.push("Email é o canal preferido");
            bestPractices.push("Evite reuniões desnecessárias");
        } else {
            bestPractices.push("Adapte o estilo baseado no contexto");
            bestPractices.push("Use múltiplos canais conforme necessário");
        }

        return {
            style: detectedStyle,
            preferredChannel,
            averageResponseTime: meetingsCount > 5 ? "24-48 horas" : "48-72 horas",
            preferredTimes: ["Manhã (9h-12h)", "Tarde (14h-17h)"],
            tone: meetingsCount > 8 ? 'positive' : 'neutral',
            bestPractices
        };
    }, [meetingsCount, emailCount, callCount]);

    const getStyleColor = (style: string) => {
        const colors: Record<string, string> = {
            'formal': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            'casual': 'bg-green-500/20 text-green-400 border-green-500/30',
            'technical': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            'emotional': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            'mixed': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };
        return colors[style] || colors.mixed;
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'email':
                return <Mail className="h-4 w-4" />;
            case 'call':
                return <Phone className="h-4 w-4" />;
            case 'meeting':
                return <Calendar className="h-4 w-4" />;
            default:
                return <MessageSquare className="h-4 w-4" />;
        }
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Communication Style Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Style Detection */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Detected Style</span>
                        <Badge variant="outline" className={cn("text-xs", getStyleColor(style.style))}>
                            {style.style.charAt(0).toUpperCase() + style.style.slice(1)}
                        </Badge>
                    </div>
                </div>

                {/* Preferred Channel */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            {getChannelIcon(style.preferredChannel)}
                            <span>Preferred Channel</span>
                        </div>
                        <span className="font-medium capitalize">{style.preferredChannel}</span>
                    </div>
                </div>

                {/* Response Time */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>Average Response Time</span>
                        </div>
                        <span className="font-medium">{style.averageResponseTime}</span>
                    </div>
                </div>

                {/* Preferred Times */}
                <div className="space-y-2">
                    <div className="text-xs font-medium mb-1">Preferred Times</div>
                    <div className="flex flex-wrap gap-1">
                        {style.preferredTimes.map((time, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                                {time}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Tone Analysis */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span>Overall Tone</span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-xs",
                                style.tone === 'positive' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                    style.tone === 'negative' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            )}
                        >
                            {style.tone.charAt(0).toUpperCase() + style.tone.slice(1)}
                        </Badge>
                    </div>
                </div>

                {/* Best Practices */}
                <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold">
                        <Lightbulb className="h-3 w-3" />
                        Best Practices
                    </div>
                    <ul className="space-y-1">
                        {style.bestPractices.map((practice, idx) => (
                            <motion.li
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                            >
                                <span className="text-primary mt-0.5">•</span>
                                <span>{practice}</span>
                            </motion.li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

