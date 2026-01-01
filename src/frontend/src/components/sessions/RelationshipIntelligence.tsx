import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Network,
    TrendingUp,
    TrendingDown,
    Activity,
    Heart,
    Zap,
    Search,
    Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingStore } from "@/store/meetingStore";
import { useRelationshipEngine } from "@/hooks/useRelationshipEngine";
import { motion, AnimatePresence } from "framer-motion";

// --- Types & Interfaces ---
interface ParticipantNode {
    id: string;
    x: number;
    y: number;
    angle: number;
    color: string;
}

export function RelationshipIntelligence() {
    // 1. Initialize Engine
    useRelationshipEngine();

    // 2. State & Store
    const {
        relationshipInsights,
        setFocusedBlockId
    } = useMeetingStore();

    // 3. Social Chord Map Logic
    const chordData = useMemo(() => {
        // Extract unique participants
        const participantsSet = new Set<string>();
        relationshipInsights.forEach(r => {
            participantsSet.add(r.participant1);
            participantsSet.add(r.participant2);
        });
        const participants = Array.from(participantsSet);

        // Calculate Positions (Circle)
        const radius = 100;
        const center = 150; // SVG viewBox center
        const nodes: ParticipantNode[] = participants.map((p, i) => {
            const angle = (i / participants.length) * 2 * Math.PI - Math.PI / 2; // Start top
            return {
                id: p,
                x: center + radius * Math.cos(angle),
                y: center + radius * Math.sin(angle),
                angle,
                color: 'oklch(0.7 0.14 240)' // Default, will refine
            };
        });

        // Create Edges
        const edges = relationshipInsights.map(r => {
            const n1 = nodes.find(n => n.id === r.participant1);
            const n2 = nodes.find(n => n.id === r.participant2);
            if (!n1 || !n2) return null;

            // Quadratic Bezier Control Point (Center of circle causes "chord" effect)
            return {
                ...r,
                d: `M ${n1.x} ${n1.y} Q ${center} ${center} ${n2.x} ${n2.y}`,
                sourceNode: n1,
                targetNode: n2
            };
        }).filter(Boolean);

        return { nodes, edges };
    }, [relationshipInsights]);

    const handleDeepLink = (blockId?: string) => {
        if (blockId) setFocusedBlockId(blockId);
    };

    // 4. Interaction State
    const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);

    return (
        <Card className="border-border bg-card/50 backdrop-blur-xl shadow-xl h-full flex flex-col overflow-hidden">
            <CardHeader className="p-4 border-b border-border shrink-0 bg-secondary/10">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10 ring-1 ring-primary/20">
                            <Network className="h-4 w-4 text-primary" />
                        </div>
                        <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            Social Dynamics Graph
                        </span>
                    </div>
                    {relationshipInsights.length > 0 && (
                        <Badge variant="outline" className="text-[10px] font-mono animate-pulse">
                            ACTIVE
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex flex-col flex-1 overflow-hidden relative">

                {/* --- Section 1: Social Chord Map (Top) --- */}
                <div className="h-64 relative bg-gradient-to-b from-background/50 to-background/5 shrink-0 flex items-center justify-center border-b border-border/40">
                    {relationshipInsights.length < 2 ? (
                        <div className="flex flex-col items-center justify-center text-muted-foreground animate-pulse gap-2">
                            <Activity className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Gathering social signals...</p>
                        </div>
                    ) : (
                        <svg
                            width="300" height="300" viewBox="0 0 300 300"
                            className="w-full h-full max-w-[300px]"
                            onMouseLeave={() => setHoveredParticipant(null)}
                        >
                            {/* Defs for gradients */}
                            <defs>
                                <radialGradient id="nodeGradient">
                                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                                </radialGradient>
                            </defs>

                            {/* Connectivity Lines */}
                            <AnimatePresence>
                                {chordData.edges.map((edge) => {
                                    if (!edge) return null;

                                    const isDimmed = hoveredParticipant &&
                                        edge.participant1 !== hoveredParticipant &&
                                        edge.participant2 !== hoveredParticipant;

                                    return (
                                        <motion.g key={`${edge.participant1}-${edge.participant2}`}
                                            className="transition-opacity duration-300"
                                            style={{ opacity: isDimmed ? 0.1 : 1 }}
                                        >
                                            {/* Background Path (Dim) */}
                                            <path
                                                d={edge.d}
                                                fill="none"
                                                stroke={edge.color || 'gray'}
                                                strokeWidth={Math.max(1, edge.strength / 20)}
                                                strokeOpacity="0.2"
                                                strokeLinecap="round"
                                            />
                                            {/* Flowing Path (Active) */}
                                            <motion.path
                                                d={edge.d}
                                                fill="none"
                                                stroke={edge.color || 'gray'}
                                                strokeWidth={Math.max(1, edge.strength / 20)}
                                                strokeOpacity="0.8"
                                                strokeDasharray="4 4"
                                                initial={{ strokeDashoffset: 0 }}
                                                animate={{ strokeDashoffset: -20 }}
                                                transition={{ repeat: Infinity, duration: 10 / (Math.max(1, edge.interactions)), ease: "linear" }}
                                            />
                                        </motion.g>
                                    )
                                })}
                            </AnimatePresence>

                            {/* Nodes (Avatars) */}
                            {chordData.nodes.map((node) => (
                                <g
                                    key={node.id}
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onMouseEnter={() => setHoveredParticipant(node.id)}
                                >
                                    {/* Interaction Glow */}
                                    <motion.circle
                                        cx={node.x}
                                        cy={node.y}
                                        r="20"
                                        fill="url(#nodeGradient)"
                                        className={cn("text-primary", hoveredParticipant === node.id ? "opacity-100" : "opacity-0")}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 300 }}
                                    />
                                    {/* Avatar Circle */}
                                    <circle cx={node.x} cy={node.y} r="14" className="fill-background stroke-border stroke-2" />
                                    {/* Initials */}
                                    <text
                                        x={node.x}
                                        y={node.y}
                                        dy=".35em"
                                        textAnchor="middle"
                                        className="fill-foreground text-[10px] font-bold pointer-events-none select-none"
                                    >
                                        {node.id.substring(0, 2).toUpperCase()}
                                    </text>
                                </g>
                            ))}
                        </svg>
                    )}

                    {/* Floating Legend/Stats */}
                    <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-background/80 backdrop-blur p-2 rounded-md border shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.18_150)]"></span> Support
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.6_0.2_20)]"></span> Challenge
                        </div>
                    </div>
                </div>

                {/* --- Section 2: Insights ScrollArea --- */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/5" style={{ scrollbarWidth: 'thin' }}>
                    <AnimatePresence>
                        {relationshipInsights.map((insight, index) => (
                            <CardRow
                                key={`${insight.participant1}-${insight.participant2}`}
                                insight={insight}
                                index={index}
                                handleDeepLink={handleDeepLink}
                                hoveredParticipant={hoveredParticipant}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}

// Sub-component to assume state handling for cleaner Hover Sync without complex prop drilling in one huge file
function CardRow({ insight, index, handleDeepLink, hoveredParticipant }: { insight: any, index: number, handleDeepLink: (id: string) => void, hoveredParticipant: string | null }) {
    const isDimmed = hoveredParticipant &&
        insight.participant1 !== hoveredParticipant &&
        insight.participant2 !== hoveredParticipant;

    const isHighlighted = hoveredParticipant && !isDimmed;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            style={{ opacity: isDimmed ? 0.3 : 1 }}
        >
            <div className={cn(
                "relative group rounded-xl border p-4 transition-all hover:shadow-md",
                isHighlighted ? "ring-2 ring-primary/50 shadow-lg scale-[1.02]" : "",
                insight.relationshipType === 'conflict' ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" :
                    insight.relationshipType === 'collaborative' ? "bg-green-500/5 border-green-500/20 hover:border-green-500/40" :
                        insight.relationshipType === 'influential' ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40" :
                            "bg-card border-border"
            )}>
                {/* Fissure Effect for Conflicts */}
                {insight.relationshipType === 'conflict' && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-red-500/10 to-transparent" />
                    </div>
                )}

                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <div className="h-8 w-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-bold">
                                {insight.participant1.substring(0, 1)}
                            </div>
                            <div className="h-8 w-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-bold">
                                {insight.participant2.substring(0, 1)}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-medium text-foreground/90">
                                {insight.participant1} & {insight.participant2}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="secondary" className={cn(
                                    "text-[10px] h-5 px-1.5 font-normal capitalize bg-opacity-50",
                                    insight.relationshipType === 'conflict' && "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-400",
                                    insight.relationshipType === 'collaborative' && "text-green-600 bg-green-100 dark:bg-green-950/30 dark:text-green-400",
                                    insight.relationshipType === 'influential' && "text-blue-600 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400"
                                )}>
                                    {insight.relationshipType}
                                </Badge>

                                {/* Trend Indicator */}
                                {insight.trend === 'increasing' && <TrendingUp className="h-3 w-3 text-green-500" />}
                                {insight.trend === 'decreasing' && <TrendingDown className="h-3 w-3 text-red-500" />}
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xl font-bold font-mono tracking-tight tabular-nums opacity-60">
                            {insight.strength}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Synergy</div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-background/40 rounded p-2 flex items-center justify-between border border-border/50">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Heart className="h-3 w-3" /> Support
                        </span>
                        <span className="text-xs font-mono font-medium">{insight.supportCount}</span>
                    </div>
                    <div className="bg-background/40 rounded p-2 flex items-center justify-between border border-border/50">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Challenge
                        </span>
                        <span className="text-xs font-mono font-medium">{insight.challengeCount}</span>
                    </div>
                </div>

                {/* Patterns & Evidence */}
                {insight.patterns.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Detected Patterns</p>
                        <div className="space-y-1.5">
                            {insight.patterns.map((pattern: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between group/pattern p-1.5 rounded hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={cn(
                                            "w-1 h-8 rounded-full shrink-0",
                                            pattern.name.includes("Tension") ? "bg-red-400" : "bg-green-400"
                                        )} />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium truncate">{pattern.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                                {pattern.description}
                                            </p>
                                        </div>
                                    </div>

                                    {pattern.evidenceBlockId && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 opacity-0 group-hover/pattern:opacity-100 transition-opacity"
                                            onClick={() => handleDeepLink(pattern.evidenceBlockId)}
                                            title="View Proof in Transcript"
                                        >
                                            <Search className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Alliance Badge (If collaboratively strong) */}
                {insight.relationshipType === 'collaborative' && insight.strength > 70 && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 backdrop-blur-md shadow-sm">
                        <Shield className="h-2.5 w-2.5" /> STRONG ALLIANCE
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// Ensure clean export types if needed
export default RelationshipIntelligence;

