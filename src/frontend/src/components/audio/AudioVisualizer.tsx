import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';

interface AudioVisualizerProps {
    deviceId?: string;
    isEnabled: boolean;
    className?: string;
    barColor?: string; // CSS color or Tailwind class
}

export function AudioVisualizer({ deviceId, isEnabled, className }: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { getWaveformData } = useAudioVisualizer({ enabled: isEnabled, deviceId });
    const animationRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!isEnabled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;

            // Get Time Domain Data (Waveform)
            const waveform = getWaveformData();

            // Clear
            ctx.clearRect(0, 0, width, height);

            // Draw Waveform
            ctx.lineWidth = 2;
            // Gradient Stroke
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
            gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)'); // Purple
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.5)');
            ctx.strokeStyle = gradient;

            ctx.beginPath();
            const sliceWidth = width * 1.0 / waveform.length;
            let x = 0;

            let maxAmplitude = 0;

            for (let i = 0; i < waveform.length; i++) {
                const v = waveform[i] / 128.0; // 0..2 float centered at 1
                const y = v * height / 2;

                // Track amplitude for glow effect
                const amplitude = Math.abs(waveform[i] - 128);
                if (amplitude > maxAmplitude) maxAmplitude = amplitude;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();

            // SOTA Glow Effect based on volume
            // If loud, add a blur
            if (maxAmplitude > 20) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
            } else {
                ctx.shadowBlur = 0;
            }

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            // Check if animationRef.current is defined before cancelling
            if (typeof animationRef.current === 'number') {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isEnabled, getWaveformData]);

    return (
        <div className={cn("relative w-full h-32 bg-zinc-950/50 rounded-lg overflow-hidden border border-zinc-800", className)}>
            {/* Grid overlay for "Lab" feel */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'linear-gradient(to right, #3f3f46 1px, transparent 1px), linear-gradient(to bottom, #3f3f46 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            />
            <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full h-full relative z-10"
            />
        </div>
    );
}

export function AudioPowerMeter({ deviceId, isEnabled }: { deviceId?: string, isEnabled: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { getFrequencyData } = useAudioVisualizer({ enabled: isEnabled, deviceId });

    useEffect(() => {
        if (!isEnabled || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        let frameId: number | undefined;

        const render = () => {
            const data = getFrequencyData();
            // Calculate RMS or average volume
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            const average = sum / data.length; // 0..255

            // Draw vertical bar
            const h = canvasRef.current!.height;
            const w = canvasRef.current!.width;

            // Normalize 0..1
            const value = Math.min(average / 100, 1);

            ctx.clearRect(0, 0, w, h);

            const barHeight = value * h;

            // Clipping Color (OKLCH Red) vs Normal
            // If value > 0.8 (simulated clipping)
            let color = '#6366f1'; // Indigo
            if (value > 0.8) color = '#ef4444'; // Red-500

            ctx.fillStyle = color;
            // Draw from bottom
            ctx.fillRect(0, h - barHeight, w, barHeight);

            frameId = requestAnimationFrame(render);
        };
        render();
        if (frameId !== undefined) cancelAnimationFrame(frameId);
    }, [isEnabled, getFrequencyData]);

    return (
        <div className="h-48 w-4 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 relative shadow-inner">
            <canvas ref={canvasRef} width={16} height={192} className="w-full h-full" />
        </div>
    );
}
