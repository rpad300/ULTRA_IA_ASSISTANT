
import React, { useEffect, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
// import cytoscape from 'cytoscape'; // Optional if registering extensions

// Layout extensions if needed (fcose is good but generic cose works)

interface OracleGraphHUDProps {
    companyId: string;
}

import { workspaceApi } from '@/api/client';

const OracleGraphHUD: React.FC<OracleGraphHUDProps> = ({ companyId }) => {
    const [graphData, setGraphData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchGraph = async () => {
            try {
                const data = await workspaceApi.getGraphVisualization(companyId);

                if (isMounted) {
                    if (data.elements) {
                        setGraphData(data.elements);
                    } else if (data.nodes || data.edges) {
                        setGraphData(CytoscapeComponent.normalizeElements(data));
                    } else if (data.error) {
                        console.warn("Oracle Graph Warning:", data.error);
                        setGraphData([]);
                    } else {
                        setGraphData(CytoscapeComponent.normalizeElements(data));
                    }
                    setError(null);
                }
            } catch (err: any) {
                console.error("Failed to load Oracle Brain:", err);
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchGraph();
        const interval = setInterval(fetchGraph, 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [companyId]);

    if (loading && !graphData) {
        return (
            <div className="h-full w-full flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <Card className="h-full min-h-[350px] bg-slate-950/50 border-slate-800 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,204,0.05)] overflow-hidden">
            <CardContent className="relative h-full p-0">

                {/* Header HUD Element */}
                <div className="absolute top-3 left-4 z-10 select-none pointer-events-none">
                    <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-emerald-500/80 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                        ORACLE_BRAIN // {companyId}
                    </span>
                </div>

                {error ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-400 gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-xs font-mono">OFFLINE // {error}</span>
                    </div>
                ) : graphData ? (
                    <CytoscapeComponent
                        elements={graphData}
                        style={{ width: '100%', height: '100%' }}
                        layout={{ name: 'cose', animate: true, animationDuration: 500 }}
                        stylesheet={[
                            {
                                selector: 'node',
                                style: {
                                    'background-color': '#10b981', // emerald-500
                                    'label': 'data(id)',
                                    'color': '#cbd5e1', // slate-300
                                    'text-outline-color': '#0f172a', // slate-900
                                    'text-outline-width': 2,
                                    'font-size': 10,
                                    'width': 20,
                                    'height': 20,
                                    "text-valign": "bottom",
                                    "text-margin-y": 4,
                                    "font-family": "monospace"
                                }
                            },
                            {
                                selector: 'edge',
                                style: {
                                    'width': 1,
                                    'line-color': '#334155', // slate-700
                                    'target-arrow-color': '#334155',
                                    'target-arrow-shape': 'triangle',
                                    'curve-style': 'bezier',
                                    'label': 'data(label)',
                                    'color': '#64748b', // slate-500
                                    'font-size': 8,
                                    'text-background-color': '#020617', // slate-950
                                    'text-background-opacity': 0.8,
                                    'text-background-padding': 2,
                                    'font-family': "monospace"
                                }
                            },
                            {
                                selector: ':selected',
                                style: {
                                    'background-color': '#d946ef', // fuchsia-500
                                    'line-color': '#d946ef',
                                    'target-arrow-color': '#d946ef',
                                    'source-arrow-color': '#d946ef',
                                    'color': '#fff'
                                }
                            }
                        ]}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-600">
                        <span className="text-xs font-mono">AWAITING INTELLIGENCE_</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default OracleGraphHUD;
