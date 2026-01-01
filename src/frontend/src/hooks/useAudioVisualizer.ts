import { useEffect, useRef, useState } from 'react';

interface UseAudioVisualizerOptions {
    fftSize?: number;
    smoothingTimeConstant?: number;
    enabled?: boolean;
    deviceId?: string; // Optional: specify device ID
}

export function useAudioVisualizer({
    fftSize = 2048,
    smoothingTimeConstant = 0.8,
    enabled = true,
    deviceId
}: UseAudioVisualizerOptions = {}) {
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const requestRef = useRef<number | null>(null);
    const [isAudioInitialized, setIsAudioInitialized] = useState(false);

    // Provide a reactive data source for components to poll or bind to
    // Note: In React, we usually don't want to set state every requestAnimationFrame (60fps)
    // as it triggers too many rerenders. Instead, we expose a ref or a getter.
    // However, to make it easy for the component, we can return the analyzer node 
    // and let the component drive the animation loop.

    useEffect(() => {
        if (!enabled) {
            cleanup();
            return;
        }

        const initAudio = async () => {
            try {
                // Cleanup previous
                cleanup();

                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as any;
                const ctx = new AudioContextClass();
                audioContextRef.current = ctx;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = fftSize;
                analyser.smoothingTimeConstant = smoothingTimeConstant;
                analyserRef.current = analyser;

                dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: deviceId ? { exact: deviceId } : undefined,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: false
                    }
                });

                const source = ctx.createMediaStreamSource(stream);
                source.connect(analyser);
                sourceRef.current = source;

                // setAudioContext(ctx);
                setIsAudioInitialized(true);

            } catch (err) {
                console.error("Failed to initialize audio visualizer:", err);
                setIsAudioInitialized(false);
            }
        };

        initAudio();

        return () => cleanup();
    }, [enabled, deviceId, fftSize, smoothingTimeConstant]);

    const cleanup = () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        if (sourceRef.current) {
            sourceRef.current.mediaStream.getTracks().forEach(track => track.stop());
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        setIsAudioInitialized(false);
    };

    // Helper to get current frequency data
    const getFrequencyData = () => {
        if (!analyserRef.current || !dataArrayRef.current) return new Uint8Array(0);
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
        // dataArrayRef.current is Uint8Array, it should be compatible.
        // If there's a strict type error, we return the ref content directly.
        return dataArrayRef.current as any;
    };

    // Helper to get current waveform data (time domain)
    const getWaveformData = () => {
        if (!analyserRef.current) return new Uint8Array(0);
        // We reuse the buffer if possible or create new one matching fft
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);
        return dataArray;
    };

    return {
        isAudioInitialized,
        getFrequencyData,
        getWaveformData,
        analyser: analyserRef.current
    };
}
