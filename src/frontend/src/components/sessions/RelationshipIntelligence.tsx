import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
    Network, 
    Users, 
    TrendingUp,
    AlertTriangle,
    Heart,
    Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";

export function RelationshipIntelligence() {
    const { 
        relationshipInsights,
        updateRelationshipInsights
    } = useMeetingStore();
    
    useEffect(() => {
        // Update relationship insights periodically
        const interval = setInterval(() => {
            updateRelationshipInsights();
        }, 30000); // Every 30 seconds
        
        return () => clearInterval(interval);
    }, [updateRelationshipInsights]);
    
    const getRelationshipIcon = (type: string) => {
        switch (type) {
            case 'collaborative':
                return <Heart className="h-4 w-4 text-green-400" />;
            case 'conflict':
                return <AlertTriangle className="h-4 w-4 text-red-400" />;
            case 'influential':
                return <TrendingUp className="h-4 w-4 text-blue-400" />;
            default:
                return <Minus className="h-4 w-4 text-gray-400" />;
        }
    };
    
    const getRelationshipColor = (type: string) => {
        switch (type) {
            case 'collaborative':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'conflict':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'influential':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };
    
    const getRelationshipLabel = (type: string) => {
        const labels: Record<string, string> = {
            'collaborative': 'Colaborativo',
            'conflict': 'Conflito',
            'neutral': 'Neutro',
            'influential': 'Influente'
        };
        return labels[type] || type;
    };
    
    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    Relationship Intelligence
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {relationshipInsights.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground">
                            Analisando relacionamentos entre participantes...
                        </p>
                    </div>
                ) : (
                    relationshipInsights.map((insight, index) => (
                        <motion.div
                            key={`${insight.participant1}-${insight.participant2}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                getRelationshipColor(insight.relationshipType)
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        {getRelationshipIcon(insight.relationshipType)}
                                        <div className="flex-1">
                                            <p className="font-medium">
                                                {insight.participant1} ↔ {insight.participant2}
                                            </p>
                                            <Badge variant="outline" className="text-xs mt-1">
                                                {getRelationshipLabel(insight.relationshipType)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="opacity-80">Força do Relacionamento</span>
                                        <span className="font-medium">{insight.strength}%</span>
                                    </div>
                                    <Progress value={insight.strength} className="h-1.5" />
                                </div>
                                
                                <div className="pt-1 border-t border-current/20 space-y-1">
                                    <p className="text-xs opacity-80">
                                        <Users className="h-3 w-3 inline mr-1" />
                                        {insight.interactions} interações
                                    </p>
                                    
                                    {insight.patterns.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium opacity-90">Padrões:</p>
                                            <ul className="space-y-0.5 pl-3">
                                                {insight.patterns.map((pattern, idx) => (
                                                    <li key={idx} className="text-xs opacity-80">
                                                        • {pattern}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

