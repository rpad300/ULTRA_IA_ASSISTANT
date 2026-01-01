
import { useState, useEffect, useRef } from "react";

export interface AudioSyncState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isReady: boolean;
    error: string | null;
}

export interface AudioSyncControls {
    play: () => Promise<void>;
    pause: () => void;
    toggle: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    skipForward: (amount?: number) => void;
    skipBack: (amount?: number) => void;
}

export function useAudioSync(src: string | null) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [state, setState] = useState<AudioSyncState>({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isReady: false,
        error: null,
    });

    useEffect(() => {
        if (!src) return;

        const audio = new Audio(src);
        audioRef.current = audio;

        // Handlers
        const onLoadedMetadata = () => {
            setState(prev => ({ ...prev, duration: audio.duration, isReady: true, error: null }));
        };

        const onTimeUpdate = () => {
            setState(prev => ({ ...prev, currentTime: audio.currentTime }));
        };

        const onPlay = () => setState(prev => ({ ...prev, isPlaying: true }));
        const onPause = () => setState(prev => ({ ...prev, isPlaying: false }));
        const onError = (e: Event) => {
            console.error("Audio Error:", e);
            setState(prev => ({ ...prev, error: "Failed to load audio" }));
        };
        const onEnded = () => setState(prev => ({ ...prev, isPlaying: false }));

        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("error", onError);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("error", onError);
            audio.removeEventListener("ended", onEnded);
            audio.pause();
            audioRef.current = null;
        };
    }, [src]);

    const controls: AudioSyncControls = {
        play: async () => {
            try {
                await audioRef.current?.play();
            } catch (err) {
                console.error("Play failed:", err);
            }
        },
        pause: () => audioRef.current?.pause(),
        toggle: () => {
            if (audioRef.current?.paused) audioRef.current.play();
            else audioRef.current?.pause();
        },
        seek: (time: number) => {
            if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration));
            }
        },
        setVolume: (val: number) => {
            if (audioRef.current) {
                audioRef.current.volume = Math.max(0, Math.min(1, val));
                setState(prev => ({ ...prev, volume: val }));
            }
        },
        skipForward: (amount = 10) => {
            if (audioRef.current) {
                audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + amount);
            }
        },
        skipBack: (amount = 10) => {
            if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - amount);
            }
        }
    };

    return { state, controls };
}
