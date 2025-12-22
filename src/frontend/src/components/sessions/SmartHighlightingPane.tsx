import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, Eye, EyeOff, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { useState } from "react";

export function SmartHighlightingPane() {
    const {
        highlightGroups,
        transcriptBlocks,
        isRecording,
        autoGroupHighlights
    } = useMeetingStore();
    const [showOnlyHighlights, setShowOnlyHighlights] = useState(false);

    // Auto-group highlights periodically
    useEffect(() => {
        if (!isRecording) return;

        const interval = setInterval(() => {
            autoGroupHighlights();
        }, 45000); // Group every 45 seconds (optimized for performance)

        return () => clearInterval(interval);
    }, [isRecording, autoGroupHighlights]);

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'decision':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'action':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'risk':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'insight':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'question':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
            'decision': 'Decisão',
            'action': 'Ação',
            'risk': 'Risco',
            'insight': 'Insight',
            'question': 'Pergunta',
            'other': 'Outro'
        };
        return labels[category] || category;
    };

    const handleJumpToBlock = (blockId: string) => {
        // Scroll to block in transcript
        const element = document.getElementById(`block-${blockId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight briefly
            element.classList.add('ring-2', 'ring-primary');
            setTimeout(() => {
                element.classList.remove('ring-2', 'ring-primary');
            }, 2000);
        }
    };

    const highlightedBlocks = transcriptBlocks.filter(b => b.isHighlighted);

    if (highlightGroups.length === 0 && highlightedBlocks.length === 0) {
        return (
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-3 border-b border-border">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Bookmark className="h-4 w-4 text-primary" />
                        Highlights Inteligentes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Highlights agrupados aparecerão aqui
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Bookmark className="h-4 w-4 text-primary" />
                        Highlights Inteligentes
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setShowOnlyHighlights(!showOnlyHighlights)}
                    >
                        {showOnlyHighlights ? (
                            <>
                                <EyeOff className="h-3 w-3 mr-1" />
                                Mostrar Tudo
                            </>
                        ) : (
                            <>
                                <Eye className="h-3 w-3 mr-1" />
                                Apenas Highlights
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {/* Highlight Groups */}
                {highlightGroups.length > 0 && (
                    <div className="space-y-2">
                        {highlightGroups.map((group, index) => {
                            const groupBlocks = transcriptBlocks.filter(b => group.blockIds.includes(b.id));
                            if (groupBlocks.length === 0) return null;

                            return (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <div className={cn(
                                        "p-3 rounded-lg border text-xs space-y-2",
                                        getCategoryColor(group.category)
                                    )}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    {getCategoryLabel(group.category)}
                                                </Badge>
                                                <span className="text-xs opacity-70">
                                                    {groupBlocks.length} {groupBlocks.length === 1 ? 'bloco' : 'blocos'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            {groupBlocks.slice(0, 3).map(block => (
                                                <div key={block.id} className="text-xs opacity-90 line-clamp-2">
                                                    "{block.text.substring(0, 80)}..."
                                                </div>
                                            ))}
                                            {groupBlocks.length > 3 && (
                                                <p className="text-xs opacity-70">
                                                    +{groupBlocks.length - 3} mais
                                                </p>
                                            )}
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full text-xs h-6"
                                            onClick={() => {
                                                if (groupBlocks.length > 0) {
                                                    handleJumpToBlock(groupBlocks[0].id);
                                                }
                                            }}
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Ver no Transcript
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Individual Highlights (if not in groups) */}
                {highlightedBlocks.filter(b =>
                    !highlightGroups.some(g => g.blockIds.includes(b.id))
                ).length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold opacity-70">Outros Highlights</p>
                            {highlightedBlocks
                                .filter(b => !highlightGroups.some(g => g.blockIds.includes(b.id)))
                                .slice(0, 5)
                                .map((block, index) => (
                                    <motion.div
                                        key={block.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="p-2 rounded border border-border bg-card/30 text-xs"
                                    >
                                        <p className="line-clamp-2 mb-1">
                                            "{block.text.substring(0, 100)}..."
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 text-xs"
                                            onClick={() => handleJumpToBlock(block.id)}
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Ver
                                        </Button>
                                    </motion.div>
                                ))}
                        </div>
                    )}
            </CardContent>
        </Card>
    );
}

