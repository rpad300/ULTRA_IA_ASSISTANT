
import React from 'react';
import { useOracleStore } from '../../store/useOracleStore';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader } from '../ui/card';
import { AlertTriangle, Lightbulb, CheckSquare, BrainCircuit } from 'lucide-react';
import type { InsightMessage } from '../../types/oracle';

export const InsightSidebar: React.FC = () => {
    const insights = useOracleStore(state => state.insights);

    const renderIcon = (type: InsightMessage['insight_type']) => {
        switch (type) {
            case 'conflict': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'solution': return <Lightbulb className="w-4 h-4 text-blue-500" />;
            case 'action': return <CheckSquare className="w-4 h-4 text-amber-500" />;
            default: return <BrainCircuit className="w-4 h-4 text-purple-500" />;
        }
    };

    const getBorderColor = (type: InsightMessage['insight_type']) => {
        switch (type) {
            case 'conflict': return "border-red-500/50 hover:border-red-500";
            case 'solution': return "border-blue-500/50 hover:border-blue-500";
            case 'action': return "border-amber-500/50 hover:border-amber-500";
            default: return "border-slate-800";
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 w-[350px]">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur z-10">
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-purple-500" />
                    LIVE INTELLIGENCE
                </h2>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-4 pb-24">
                    {insights.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-2">
                            <BrainCircuit className="w-8 h-8 opacity-20" />
                            <span className="text-xs">Waiting for insights...</span>
                        </div>
                    )}

                    {insights.map((insight, idx) => (
                        <Card
                            key={idx}
                            className={cn("bg-slate-900 transition-all duration-300 animate-in slide-in-from-right-4", getBorderColor(insight.insight_type))}
                        >
                            <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    {renderIcon(insight.insight_type)}
                                    <span className="text-xs font-bold uppercase text-slate-200">
                                        {insight.insight_type}
                                    </span>
                                </div>
                                <Badge variant="outline" className="text-[10px] h-5 border-slate-700 text-slate-500">
                                    {Math.round(insight.confidence * 100)}%
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-3">
                                <p className="text-sm text-slate-300 leading-snug">
                                    {insight.text}
                                </p>

                                {insight.source_link && (
                                    <div className="mt-2 pt-2 border-t border-slate-800/50">
                                        {insight.source_link.startsWith('http') ? (
                                            <a
                                                href={insight.source_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                                            >
                                                SOURCE REFERENCE ↗
                                            </a>
                                        ) : (
                                            <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                                                [{insight.source_link}]
                                            </span>
                                        )}
                                    </div>
                                )}

                                {insight.related_fact && (
                                    <div className="mt-2 p-2 bg-red-950/20 rounded border border-red-900/30">
                                        <p className="text-[10px] text-red-300">
                                            <span className="font-bold">CONTRADICTS:</span> {insight.related_fact}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};
