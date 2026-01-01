import { useEffect, useState } from 'react';

// --- OKLCH Color System ---

/**
 * Generates a unique, accessible color for a user based on their ID using OKLCH.
 * Ensures good contrast and vibrancy.
 */
export function getUserColor(userId: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use the hash to pick a hue [0-360]
    const hue = Math.abs(hash % 360);

    // OKLCH format: oklch(Lightness Chroma Hue)
    // L: 65% for good visibility on dark/light
    // C: 0.16 for vibrant but not neon
    return `oklch(0.65 0.16 ${hue})`;
}

/**
 * Returns a variant of the user color with different opacity/lightness for backgrounds/borders.
 */
export function getUserColorVariant(userId: string, variant: 'bg' | 'border' | 'glow'): string {
    const baseColor = getUserColor(userId);
    if (variant === 'bg') {
        // Lower opacity for background
        return baseColor.replace(')', ' / 15%)');
    }
    if (variant === 'glow') {
        // Higher lightness or opacity for glow
        return baseColor.replace(')', ' / 60%)');
    }
    return baseColor; // default border is base
}

// --- Activity Sensing ---

export type PresenceStatus = 'active' | 'idle' | 'do_not_disturb' | 'offline';
export type ActivityContext = 'Viewing' | 'Typing' | 'Editing' | 'Thinking' | 'Idle';

export interface PresenceState {
    status: PresenceStatus;
    context: ActivityContext;
    lastActive: number;
}

/**
 * Hook to track local user activity (Mouse, Keyboard)
 * Returns the current inferred status.
 */
export function useLocalPresence(timeoutMs = 120000) { // 2 mins default
    const [status, setStatus] = useState<PresenceStatus>('active');

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            if (status !== 'active') setStatus('active');
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => setStatus('idle'), timeoutMs);
        };

        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('click', resetTimer);

        // Init timer
        resetTimer();

        return () => {
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('click', resetTimer);
            clearTimeout(timeoutId);
        };
    }, [status, timeoutMs]);

    return status;
}

/**
 * Mocks reliable connectivity status based on random latency simulation (if real data missing)
 */
export function getConnectivityStatus(latencyMs: number): 'good' | 'fair' | 'poor' {
    if (latencyMs < 100) return 'good';
    if (latencyMs < 300) return 'fair';
    return 'poor';
}

export function getConnectivityColor(status: 'good' | 'fair' | 'poor'): string {
    switch (status) {
        case 'good': return 'text-emerald-500';
        case 'fair': return 'text-amber-500';
        case 'poor': return 'text-red-500';
    }
}
