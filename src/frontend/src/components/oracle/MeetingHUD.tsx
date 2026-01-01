
import React, { useEffect } from 'react';
import { oracleWebSocket } from '../../services/WebSocketClient';
import { useOracleStore } from '../../store/useOracleStore';
import { useMeetingStore } from '../../store/meetingStore';
import { TranscriptionPanel } from './TranscriptionPanel';
import { InsightSidebar } from './InsightSidebar';
import { AcousticTelemetryBar } from './AcousticTelemetryBar';
import { Loader2, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog';
import { AIGovernanceDashboard } from './governance/AIGovernanceDashboard';
import OracleGraphHUD from './OracleGraphHUD';

export const MeetingHUD: React.FC = () => {
    const connection = useOracleStore(state => state.connection);

    // Initialize Connection on Mount
    const { sessionId } = useMeetingStore();

    // Initialize Connection on Mount
    useEffect(() => {
        // SOTA: Use active session ID if available, else fail gracefully or use demo
        const targetSessionId = sessionId || "ORACLE_DEMO_SESSION";
        console.log(`[MeetingHUD] Connecting to Session: ${targetSessionId}`);

        oracleWebSocket.connect(targetSessionId, "auto");

        return () => {
            oracleWebSocket.disconnect();
        };
    }, [sessionId]);

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">

            {/* Header / Top Bar */}
            <header className="h-12 border-b border-slate-800 bg-slate-950 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold tracking-wider text-sm">ORACLE HUD</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono border border-slate-700">
                        V3.0 ALPHA
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {connection.status === 'connecting' && (
                        <div className="flex items-center gap-2 text-xs text-amber-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            CONNECTING...
                        </div>
                    )}
                    {connection.status === 'error' && (
                        <span className="text-xs text-red-500 animate-pulse">
                            CONNECTION LOST
                        </span>
                    )}


                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                                <Settings className="w-4 h-4" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="p-0 bg-transparent border-none max-w-fit">
                            <AIGovernanceDashboard />
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main: Transcription */}
                <div className="flex-1 relative flex flex-col">
                    <div className="flex-1 flex">
                        <TranscriptionPanel />
                        {/* Optional Graph Panel (Hidden logic for now or split view) */}
                        {/* We use a simple Absolute overlay or Split for Graph */}
                        <div className="hidden lg:block w-[400px] border-l border-slate-800 bg-slate-900/50">
                            <OracleGraphHUD companyId="SOTA_CORP_A" />
                        </div>
                    </div>
                    <AcousticTelemetryBar />
                </div>

                {/* Sidebar: Insights */}
                <InsightSidebar />
            </div>

        </div>
    );
};
