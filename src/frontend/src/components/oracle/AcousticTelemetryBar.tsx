
import React from 'react';
import { useOracleStore } from '../../store/useOracleStore';
import { cn } from '../../lib/utils';
import { Mic, Activity, AlertCircle } from 'lucide-react';

export const AcousticTelemetryBar: React.FC = () => {
    const telemetry = useOracleStore(state => state.telemetry);
    const connection = useOracleStore(state => state.connection);

    if (!telemetry || connection.status !== 'connected') return null;

    // RMS is 0.0 - 1.0 (float)
    // Convert to percentage for width
    const volumePercent = Math.min(100, Math.max(0, telemetry.rms * 500));
    // Heuristic multiplication to make it visible

    const isClipping = telemetry.is_clipping;
    const snr = telemetry.snr; // Decibels roughly

    // VAD Probability color
    const vadColor = telemetry.vad_prob > 0.5 ? "bg-emerald-500" : "bg-slate-700";

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-slate-950/90 backdrop-blur border-t border-slate-800 flex items-center px-6 gap-6 z-50 animate-in slide-in-from-bottom-2">

            {/* VAD & Volume Meter */}
            <div className="flex items-center gap-3 w-64">
                <div className={cn("w-3 h-3 rounded-full transition-colors duration-200", vadColor)} />
                <Mic className="w-4 h-4 text-slate-400" />

                <div className="h-2 flex-1 bg-slate-800 rounded-full overflow-hidden relative">
                    <div
                        className={cn("h-full transition-all duration-75 ease-linear",
                            isClipping ? "bg-red-500" : "bg-blue-500"
                        )}
                        style={{ width: `${volumePercent}%` }}
                    />
                </div>
                {isClipping && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-6 text-xs font-mono text-slate-400 border-l border-slate-800 pl-6">
                <div className="flex flex-col">
                    <span className="opacity-50">SNR</span>
                    <span className={cn(snr < 10 ? "text-red-400" : "text-emerald-400")}>
                        {snr.toFixed(1)} dB
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="opacity-50">RMS</span>
                    <span>{telemetry.db.toFixed(1)} dB</span>
                </div>
                <div className="flex flex-col">
                    <span className="opacity-50">VAD</span>
                    <span>{(telemetry.vad_prob * 100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Connection Status */}
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <Activity className="w-3 h-3" />
                <span>LATENCY: {connection.latency || "0"}ms</span>
                <span className={cn("w-2 h-2 rounded-full ml-2",
                    connection.status === 'connected' ? "bg-emerald-500" : "bg-amber-500"
                )} />
            </div>
        </div>
    );
};
