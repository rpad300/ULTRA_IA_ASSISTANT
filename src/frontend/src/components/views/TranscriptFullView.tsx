import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Search,
    ExternalLink,
    Bookmark,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";

export function TranscriptFullView() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { transcriptBlocks } = useMeetingStore();
    const [searchQuery, setSearchQuery] = useState("");


    // Filter blocks by search
    const filteredBlocks = useMemo(() => {
        if (!searchQuery.trim()) return transcriptBlocks;

        const query = searchQuery.toLowerCase();
        return transcriptBlocks.filter(block =>
            block.text.toLowerCase().includes(query) ||
            block.speaker.toLowerCase().includes(query) ||
            block.topic?.toLowerCase().includes(query)
        );
    }, [transcriptBlocks, searchQuery]);

    // Get unique highlights for sidebar
    const highlights = useMemo(() => {
        return transcriptBlocks
            .filter(b => b.isHighlighted)
            .map(b => ({
                id: b.id,
                text: b.text.substring(0, 100) + (b.text.length > 100 ? '...' : ''),
                speaker: b.speaker,
                timestamp: b.timestamp,
                topic: b.topic
            }));
    }, [transcriptBlocks]);

    const handleJumpToBlock = (blockId: string) => {
        const element = document.getElementById(`block-${blockId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight briefly
            element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
                element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
        }
    };

    const highlightSearchTerm = (text: string, query: string) => {
        if (!query.trim()) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === query.toLowerCase() ? (
                <mark key={index} className="bg-yellow-400/30 text-yellow-100">
                    {part}
                </mark>
            ) : part
        );
    };

    const formatTimestamp = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Transcrição Completa</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Sessão {sessionId} • {transcriptBlocks.length} blocos
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                            // TODO: Open in Google Drive
                            window.open('https://drive.google.com', '_blank');
                        }}
                    >
                        <ExternalLink className="h-4 w-4" />
                        Abrir no Drive
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
                {/* Main Transcript */}
                <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                    {/* Search Bar */}
                    <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm p-2 mb-4 rounded-lg border border-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar na transcrição..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-9"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                                    onClick={() => setSearchQuery("")}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        {searchQuery && (
                            <p className="text-xs text-muted-foreground mt-2">
                                {filteredBlocks.length} resultado(s) encontrado(s)
                            </p>
                        )}
                    </div>

                    {/* Transcript Blocks */}
                    <div className="space-y-3">
                        {filteredBlocks.length === 0 ? (
                            <Card className="border-border bg-card/50 backdrop-blur-sm">
                                <CardContent className="p-8 text-center">
                                    <p className="text-muted-foreground">
                                        {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhum bloco de transcrição disponível'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredBlocks.map((block, index) => (
                                <motion.div
                                    key={block.id}
                                    id={`block-${block.id}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.01 }}
                                    className={cn(
                                        "p-4 rounded-lg border transition-all",
                                        block.isHighlighted
                                            ? "bg-yellow-500/10 border-yellow-500/30"
                                            : "bg-card/50 border-border hover:border-primary/40"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <Badge variant="outline" className="text-xs">
                                                {block.speaker}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {formatTimestamp(block.timestamp)}
                                            </span>
                                            {block.topic && (
                                                <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                                                    {block.topic}
                                                </Badge>
                                            )}
                                            {block.isHighlighted && (
                                                <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                                    <Bookmark className="h-3 w-3 mr-1" />
                                                    Highlight
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm leading-relaxed text-foreground/90">
                                        {searchQuery ? highlightSearchTerm(block.text, searchQuery) : block.text}
                                    </p>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-80 shrink-0 space-y-4 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {/* Highlights */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader className="p-4 border-b border-border shrink-0">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Bookmark className="h-4 w-4 text-primary" />
                                Highlights ({highlights.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 max-h-96 overflow-y-auto">
                            {highlights.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                    Nenhum highlight
                                </p>
                            ) : (
                                highlights.map((highlight, index) => (
                                    <motion.button
                                        key={highlight.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => handleJumpToBlock(highlight.id)}
                                        className="w-full text-left p-3 rounded-lg border border-border bg-card/30 hover:bg-accent/50 transition-colors space-y-1"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-xs">
                                                {highlight.speaker}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {formatTimestamp(highlight.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-xs leading-relaxed line-clamp-2">
                                            {highlight.text}
                                        </p>
                                        {highlight.topic && (
                                            <Badge variant="outline" className="text-xs mt-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
                                                {highlight.topic}
                                            </Badge>
                                        )}
                                    </motion.button>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Stats */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader className="p-4 border-b border-border shrink-0">
                            <CardTitle className="text-sm font-semibold">Estatísticas</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total de blocos:</span>
                                <span className="font-medium">{transcriptBlocks.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Highlights:</span>
                                <span className="font-medium">{highlights.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Participantes:</span>
                                <span className="font-medium">
                                    {new Set(transcriptBlocks.map(b => b.speaker)).size}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

