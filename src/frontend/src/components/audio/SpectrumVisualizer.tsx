
import { useRef, useEffect } from 'react';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { cn } from '@/lib/utils';

interface SpectrumVisualizerProps {
    deviceId?: string;
    isActive: boolean;
    className?: string;
}

export function SpectrumVisualizer({ deviceId, isActive, className }: SpectrumVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { getWaveformData } = useAudioVisualizer({ enabled: isActive, deviceId, fftSize: 256 });
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            const waveform = getWaveformData();

            ctx.clearRect(0, 0, width, height);

            // Style: Neutral Zinc-500, simple line
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#71717a'; // zinc-500

            ctx.beginPath();
            const sliceWidth = width * 1.0 / waveform.length;
            let x = 0;

            let hasSignal = false;

            for (let i = 0; i < waveform.length; i++) {
                const v = waveform[i] / 128.0;
                const y = v * height / 2;

                if (Math.abs(128 - waveform[i]) > 2) hasSignal = true;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }

            ctx.stroke();

            // Tiny Glow if signal detected
            if (hasSignal) {
                ctx.shadowBlur = 4;
                ctx.shadowColor = '#a1a1aa'; // zinc-400
            } else {
                ctx.shadowBlur = 0;
            }

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isActive, getWaveformData]);

    return (
        <div className={cn("relative overflow-hidden bg-zinc-900/50 rounded-md border border-zinc-800", className)}>
            <canvas
                ref={canvasRef}
                width={120}
                height={40}
                className="w-full h-full opacity-60"
            />
            {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-[1px] w-full bg-zinc-800" />
                </div>
            )}
        </div>
    );
}
