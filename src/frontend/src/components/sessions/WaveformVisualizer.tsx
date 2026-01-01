
import { useRef, useEffect, useState, useMemo } from "react";

interface WaveformMarker {
    time: number; // seconds
    type: 'conflict' | 'decision' | 'flag' | 'insight';
    label?: string;
}

interface WaveformVisualizerProps {
    duration: number; // total duration in seconds
    currentTime: number;
    markers?: WaveformMarker[];
    onSeek: (time: number) => void;
    height?: number;
    primaryColor?: string;
}

export function WaveformVisualizer({
    duration,
    currentTime,
    markers = [],
    onSeek,
    height = 64,
    primaryColor = "#3b82f6" // Blue-500
}: WaveformVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);

    // Generate stable "waveform" data based on simple noise
    const waveformData = useMemo(() => {
        const points = 200; // Number of bars
        const data = [];
        for (let i = 0; i < points; i++) {
            // Perlin-ish noise simulation for nice wave
            const scale = Math.sin(i * 0.1) * 0.5 + Math.sin(i * 0.3) * 0.3 + Math.random() * 0.2;
            data.push(Math.max(0.2, Math.abs(scale))); // Normalize somewhat
        }
        return data;
    }, []);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const h = canvas.offsetHeight;

        // Resize canvas to match display size * dpr for crispness
        canvas.width = width * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, h);

        const barWidth = width / waveformData.length;
        const gap = 1;
        const effectiveBarWidth = Math.max(1, barWidth - gap);
        const centerY = h / 2;

        waveformData.forEach((val, i) => {
            const x = i * barWidth;
            const barHeight = val * (h * 0.8);

            const timeAtBarBase = (i / waveformData.length) * duration;

            // Determine Color
            let color = "rgba(100, 116, 139, 0.3)"; // Slate-500 low opacity (default)

            // Played part
            if (timeAtBarBase <= currentTime) {
                color = primaryColor;
            }

            // Hover part (Aura)
            if (hoverTime !== null && timeAtBarBase <= hoverTime && timeAtBarBase > currentTime) {
                color = "rgba(59, 130, 246, 0.4)"; // Hover aura
            }

            ctx.fillStyle = color;

            // Draw symmetric bar
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, centerY - barHeight / 2, effectiveBarWidth, barHeight, 2);
            } else {
                ctx.rect(x, centerY - barHeight / 2, effectiveBarWidth, barHeight);
            }
            ctx.fill();
        });

        // Draw Markers
        markers.forEach(marker => {
            const x = (marker.time / duration) * width;
            let markerColor = "#fbbf24"; // Amber (Flag/Default)
            if (marker.type === 'conflict') markerColor = "#ef4444"; // Red
            if (marker.type === 'decision') markerColor = "#22c55e"; // Green

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.strokeStyle = markerColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 2]);
            ctx.stroke();

            // Dot on top
            ctx.beginPath();
            ctx.arc(x, 4, 3, 0, Math.PI * 2);
            ctx.fillStyle = markerColor;
            ctx.fill();
            ctx.restore();
        });

        // Current Time Playhead
        const playheadX = (currentTime / duration) * width;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    useEffect(() => {
        draw();
    }, [currentTime, duration, hoverTime, waveformData, markers]); // removed motion, ensured check

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const t = (x / rect.width) * duration;
        setHoverTime(Math.max(0, Math.min(duration, t)));
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const t = (x / rect.width) * duration;
        onSeek(t);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full cursor-crosshair group select-none"
            style={{ height }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverTime(null)}
            onClick={handleClick}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
            />

            {/* Hover Tooltip */}
            {hoverTime !== null && (
                <div
                    className="absolute top-0 pointer-events-none bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded -translate-x-1/2 -translate-y-full"
                    style={{ left: `${(hoverTime / duration) * 100}%` }}
                >
                    {Math.floor(hoverTime / 60)}:{Math.floor(hoverTime % 60).toString().padStart(2, '0')}
                </div>
            )}
        </div>
    );
}
