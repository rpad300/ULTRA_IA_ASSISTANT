import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Card,
    CardContent,
    CardHeader
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    ArrowLeft,
    Share2,
    FileDown,
    Calendar,
    Clock,
    Users,
    CheckCircle2,
    PlayCircle,
    BrainCircuit,
    Target,
    Activity,
    Mic,
    MoreHorizontal
} from "lucide-react";
import { useMeetingStore } from "@/store/meetingStore";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    AreaChart,
    Area
} from "recharts";
import { generateSessionReport } from "@/utils/reportGenerator";

// --- Animation Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

// --- Helper Components ---

function ExecutiveAnalyticsHeader({
    qualityScore,
    actionCount,
    decisionCount
}: {
    qualityScore: number;
    actionCount: number;
    decisionCount: number;
}) {
    // Calculate "Talk-Equity" visual - simulated for header sparkline
    // Calculate "Action Conversion" (actions / decisions ratio approx)
    const conversionRate = decisionCount > 0 ? Math.round((actionCount / decisionCount) * 100) : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-1">
            <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Quality Score</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-bold">{qualityScore}</span>
                            <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                    </div>
                    <div className="h-10 w-10 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-primary"
                                strokeDasharray={`${qualityScore}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                        </svg>
                        <Activity className="h-4 w-4 text-primary" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Decisions</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-bold">{decisionCount}</span>
                            <span className="text-xs text-green-400 font-medium">Verified</span>
                        </div>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <BrainCircuit className="h-4 w-4 text-green-400" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Actions</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-bold">{actionCount}</span>
                            <span className="text-xs text-blue-400 font-medium">Pending</span>
                        </div>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Target className="h-4 w-4 text-blue-400" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Conversion</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-bold">{conversionRate}%</span>
                            <span className="text-xs text-muted-foreground">Actionable</span>
                        </div>
                    </div>
                    {/* Tiny Bar Chart Visual */}
                    <div className="flex gap-1 h-8 items-end">
                        <div className="w-1 bg-primary/20 h-[30%] rounded-t-sm" />
                        <div className="w-1 bg-primary/20 h-[50%] rounded-t-sm" />
                        <div className="w-1 bg-primary h-[80%] rounded-t-sm" />
                        <div className="w-1 bg-primary/20 h-[40%] rounded-t-sm" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function SlotHeader({ icon: Icon, title, badge }: { icon: any, title: string, badge?: string | number }) {
    return (
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <div className="flex items-center gap-2 text-foreground/90">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold tracking-tight">{title}</h3>
            </div>
            {badge && <Badge variant="secondary" className="text-xs font-mono">{badge}</Badge>}
        </div>
    );
}

// --- Main View Component ---

export function SessionSummaryView() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const store = useMeetingStore();

    // Explicitly selecting state to ensure reactivity
    const transcriptBlocks = store.transcriptBlocks;
    const decisions = store.liveSummary?.decisions || [];
    const actions = store.detectedActions || [];
    const participants = store.participants || [];
    const qualityScore = store.meetingQualityScore?.overall || 85;

    // Local State
    const [selectedDecision, setSelectedDecision] = useState<any | null>(null);

    // Mock Session Data (In real app, fetch from API if not in store)
    // We strive to use Store data principally.
    const sessionData = useMemo(() => {
        return {
            id: sessionId || 'unknown',
            type: 'Strategic Review', // Could come from store if we had it
            date: store.startTime || Date.now(),
            duration: store.elapsedTime || 0,
            participants: participants.map((p: any) => p.name || 'Unknown Participant')
        };
    }, [sessionId, store.startTime, store.elapsedTime, participants]);

    // Data Transformation for Charts
    const voiceDistribution = useMemo(() => {
        // Calculate word count per speaker
        const distribution: Record<string, number> = {};
        transcriptBlocks.forEach(block => {
            const speaker = block.speaker || 'Unknown';
            const wordCount = block.text.split(' ').length;
            distribution[speaker] = (distribution[speaker] || 0) + wordCount;
        });

        return Object.entries(distribution)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [transcriptBlocks]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    // Data selector with fallback
    const liveSummary = store.liveSummary || { decisions: [], actionItems: [], executiveOverview: undefined };
    const executiveNarrative = liveSummary.executiveOverview || {
        context: "Waiting for AI context generation...",
        keyPoints: [],
        conclusion: "Analysis pending."
    };

    const handleExport = () => {
        // Calculate percentages for talk time
        const totalWords = voiceDistribution.reduce((acc, curr) => acc + curr.value, 0);
        const talkTimeMetrics = voiceDistribution.map(v => ({
            name: v.name,
            percentage: totalWords > 0 ? Math.round((v.value / totalWords) * 100) : 0
        }));

        const report = generateSessionReport({
            session: {
                title: sessionData.type,
                date: sessionData.date,
                duration: sessionData.duration,
                participants: sessionData.participants || []
            },
            summary: executiveNarrative,
            decisions: decisions.map((d: any) => ({
                text: d.text,
                status: 'Verified',
                timestamp: d.timestamp
            })),
            actions: actions.map((a: any) => ({
                text: a.text,
                assignee: a.suggestedAssigneeId,
                dueDate: a.suggestedDueDate
            })),
            metrics: {
                qualityScore,
                talkTime: talkTimeMetrics
            }
        });

        const blob = new Blob([report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-report-${sessionId || 'summary'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Safe Navigation
    if (!sessionId) return <div className="flex items-center justify-center h-screen text-muted-foreground">Session ID Missing</div>;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
            {/* --- Top Navigation Bar --- */}
            <div className="shrink-0 h-16 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-primary/10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            {format(sessionData.date, "MMMM d, yyyy", { locale: pt })}
                            <Badge variant="outline" className="ml-2 font-normal text-xs uppercase bg-primary/5 border-primary/20 text-primary">
                                {sessionData.type}
                            </Badge>
                        </h1>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.floor(sessionData.duration / 60)}m Session</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {participants.length} Participants</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="hidden md:flex gap-2"
                                    onClick={handleExport}
                                >
                                    <FileDown className="h-4 w-4" />
                                    Export Report
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download PDF / Markdown</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                        <Share2 className="h-4 w-4" />
                        Share
                    </Button>
                </div>
            </div>

            {/* --- Main Dashboard Area --- */}
            <div className="flex-1 min-h-0 bg-muted/10 p-4 lg:p-6 overflow-hidden flex flex-col">

                {/* Executive Header */}
                <ExecutiveAnalyticsHeader
                    qualityScore={qualityScore}
                    actionCount={actions.length}
                    decisionCount={decisions.length}
                />

                {/* --- Bento Grid --- */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 grid-rows-[auto_1fr_1fr] lg:grid-rows-2 gap-4 mt-2"
                >

                    {/* Slot A: Executive Summary (Narrative) */}
                    <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 row-span-2 h-full min-h-0">
                        <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/60 overflow-hidden">
                            <CardHeader className="pb-2">
                                <SlotHeader icon={BrainCircuit} title="Executive Narrative" />
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 p-0">
                                <ScrollArea className="h-full px-6 pb-6">
                                    <div className="space-y-6">
                                        {/* Context Section */}
                                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                            <h4 className="font-semibold text-sm text-primary mb-2 flex items-center gap-2">
                                                <Target className="h-3.5 w-3.5" />
                                                Context & Goal
                                            </h4>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {executiveNarrative.context}
                                            </p>
                                        </div>

                                        {/* Discussion Highlights - Generated from Topics if available */}
                                        <div>
                                            <h4 className="font-medium text-sm mb-3 text-foreground/80">Key Discussion Points</h4>
                                            <ul className="space-y-3">
                                                {executiveNarrative.keyPoints.map((point: string, i: number) => {
                                                    const [title, desc] = point.split(':');
                                                    const colors = ['bg-blue-400', 'bg-purple-400', 'bg-orange-400'];
                                                    return (
                                                        <li key={i} className="flex gap-3 text-sm text-muted-foreground group">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${colors[i % 3]} mt-2 block shrink-0`} />
                                                            <span className="group-hover:text-foreground transition-colors">
                                                                <strong className="text-foreground font-medium">{title}:</strong> {desc}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        {/* AI Conclusion */}
                                        <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                                            <h4 className="font-semibold text-sm mb-2">Conclusion</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {executiveNarrative.conclusion}
                                            </p>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Slot B: Decision Lineage */}
                    <motion.div variants={itemVariants} className="col-span-1 md:col-span-1 lg:col-span-1 h-full min-h-0">
                        <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/60 overflow-hidden">
                            <CardHeader className="pb-2 bg-gradient-to-r from-green-500/5 to-transparent">
                                <SlotHeader icon={CheckCircle2} title="Decision Lineage" badge={decisions.length} />
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 p-0">
                                <ScrollArea className="h-full">
                                    <div className="divide-y divide-border/40">
                                        {decisions.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm">
                                                No decisions tracked.
                                            </div>
                                        ) : decisions.map((decision: any, idx) => (
                                            <div
                                                key={idx}
                                                className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group relative"
                                                onClick={() => setSelectedDecision(decision)}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                                                        {decision.text}
                                                    </p>
                                                    <Badge variant="outline" className="shrink-0 text-[10px] h-5 border-green-500/30 text-green-600 bg-green-500/5">
                                                        VERIFIED
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    {decision.relatedBlockId && (
                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">
                                                            <PlayCircle className="h-3 w-3" />
                                                            Snippet available
                                                        </span>
                                                    )}
                                                    <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary">
                                                        View Context <ArrowLeft className="h-3 w-3 rotate-180" />
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Slot C: Smart Action Items */}
                    <motion.div variants={itemVariants} className="col-span-1 md:col-span-1 lg:col-span-1 h-full min-h-0">
                        <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/60 overflow-hidden">
                            <CardHeader className="pb-2 bg-gradient-to-r from-blue-500/5 to-transparent">
                                <SlotHeader icon={Target} title="Smart Actions" badge={actions.length} />
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 p-0">
                                <ScrollArea className="h-full">
                                    <div className="p-2 space-y-2">
                                        {actions.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm">
                                                No actions detected.
                                            </div>
                                        ) : actions.map((action: any, idx) => (
                                            <div key={idx} className="p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-card/80 transition-all flex flex-col gap-2 shadow-sm">
                                                <div className="flex items-start gap-2">
                                                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${action.confirmed ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground/30'}`} />
                                                    <span className={`text-sm ${action.confirmed ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                                                        {action.text}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between pl-6 mt-1">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {action.suggestedAssigneeId && (
                                                            <Badge variant="secondary" className="h-5 px-1.5 bg-blue-500/10 text-blue-600 border-blue-200/20">
                                                                @{action.suggestedAssigneeId}
                                                            </Badge>
                                                        )}
                                                        {action.suggestedDueDate && (
                                                            <span className="flex items-center gap-1 text-muted-foreground max-w-[80px] truncate">
                                                                <Calendar className="h-3 w-3" />
                                                                {action.suggestedDueDate}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100">
                                                        <MoreHorizontal className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Slot D: Voice Distribution (Airtime) */}
                    <motion.div variants={itemVariants} className="col-span-1 h-full min-h-0 min-h-[250px] lg:min-h-0">
                        <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/60 overflow-hidden">
                            <CardHeader className="pb-0">
                                <SlotHeader icon={Mic} title="Airtime" />
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 flex items-center justify-center p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={voiceDistribution}
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {voiceDistribution.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                            <div className="px-4 pb-4">
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {voiceDistribution.slice(0, 3).map((d, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                            {d.name.split(' ')[0]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Slot E: Sentiment Timeline */}
                    <motion.div variants={itemVariants} className="col-span-1 h-full min-h-0 min-h-[250px] lg:min-h-0">
                        <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/60 overflow-hidden">
                            <CardHeader className="pb-0">
                                <SlotHeader icon={Activity} title="Sentiment Flow" />
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={store.qualityScoreHistory.map((h, i) => ({ i, value: h.overall }))}>
                                        <defs>
                                            <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <RechartsTooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-background/80 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-xl">
                                                            <p className="text-xs font-medium">{new Date(label || Date.now()).toLocaleTimeString()}</p>
                                                            <p className="text-xs text-primary">Score: {payload[0].value}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#8b5cf6"
                                            fillOpacity={1}
                                            fill="url(#colorSentiment)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </motion.div>

                </motion.div>
            </div>

            {/* --- Modals & Portals --- */}

            {/* Decision Details Modal */}
            <Dialog open={!!selectedDecision} onOpenChange={(open) => !open && setSelectedDecision(null)}>
                <DialogContent className="sm:max-w-2xl bg-background/95 backdrop-blur-3xl border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-primary" />
                            Decision Detail
                        </DialogTitle>
                        <DialogDescription>
                            Verified decision context and lineage.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedDecision && (
                        <div className="space-y-6 pt-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <h4 className="text-lg font-medium mb-1">{selectedDecision.text}</h4>
                                <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {format(selectedDecision.timestamp || Date.now(), "h:mm a")}
                                    </span>
                                    {selectedDecision.type && <Badge variant="secondary" className="text-xs">{selectedDecision.type}</Badge>}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h5 className="text-sm font-semibold flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-muted-foreground" />
                                    Transcript Context
                                </h5>
                                <div className="p-4 rounded-lg bg-muted/40 border-l-2 border-primary text-sm leading-relaxed italic text-muted-foreground">
                                    "...okay, so based on the budget report, we are deciding to move forward with the hiring plan for Q3 immediately..."
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setSelectedDecision(null)}>Close</Button>
                                <Button className="gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Confirm to Minutes
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
