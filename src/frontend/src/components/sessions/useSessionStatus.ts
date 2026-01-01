
import { useState, useEffect, useRef, useMemo } from 'react';
import { useMeetingStore } from "@/store/meetingStore";
import { useNetworkWorker } from "@/hooks/useNetworkWorker";

// --- Types ---

export type HealthStatus = 'optimal' | 'warning' | 'critical';

export interface RemediationAction {
    label: string;
    action: 'reset_mic' | 'check_network' | 'optimize_system' | 'none';
}

export interface HealthLayer {
    status: HealthStatus;
    issues: string[]; // List of specific issues found in this layer
}

export interface SessionHealth {
    status: HealthStatus;
    message: string;
    isDeclining: boolean; // Trend analysis: true if health dropped in last 10s
    recommendedAction?: RemediationAction;
    layers: {
        hardware: HealthLayer;
        infra: HealthLayer;
        inteligencia: HealthLayer;
    };
    metrics: {
        latencyMs: number;
        jitter: 'stable' | 'high' | 'stagnant'; // Stagnant = frozen signal
    }
}

export interface SessionStatusWrapper {
    isRecording: boolean;
    isPaused: boolean;
    elapsedTime: number; // In seconds
    transcriptionStatus: { label: string; color: string };
    sessionHealth: SessionHealth;
    currentAudioLevel: number;
    isSilent: boolean; // "Smart Auto-Stop" candidate
}

// --- Constants ---

const SILENCE_THRESHOLD = 0.01; // 1% audio level
const SILENCE_DURATION_MS = 10000; // 10 seconds
const LATENCY_WARNING_THRESHOLD = 1500; // 1.5s
const JITTER_CHECK_WINDOW = 2000; // check for frozen signal every 2s

// --- Hook ---

export const useSessionStatus = (): SessionStatusWrapper => {
    // 1. Granular Selectors to optimize performance
    const isRecording = useMeetingStore(s => s.isRecording);
    const isPaused = useMeetingStore(s => s.isPaused);
    const elapsedTime = useMeetingStore(s => s.elapsedTime);
    const micPermission = useMeetingStore(s => s.microphonePermission);
    const systemPermission = useMeetingStore(s => s.systemAudioPermission);
    const picoVoiceStatus = useMeetingStore(s => s.picoVoiceStatus);
    const audioServiceStatus = useMeetingStore(s => s.audioServiceStatus);
    const audioLevel = useMeetingStore(s => s.audioLevel);
    const systemAudioLevel = useMeetingStore(s => s.systemAudioLevel);

    // 2. Local State for calculated metrics
    const [networkLatency, setNetworkLatency] = useState<number>(50); // Base optimism
    const [isSilent, setIsSilent] = useState(false);
    const [jitterStatus, setJitterStatus] = useState<'stable' | 'high' | 'stagnant'>('stable');

    // Refs for Analysis (Non-rendering state)
    const lastAudioLevel = useRef<number>(0);
    const lastAudioChangeTime = useRef<number>(Date.now());
    const silenceStartRef = useRef<number | null>(null);
    const historyRef = useRef<{ time: number, status: HealthStatus, latency?: number }[]>([]);

    // Unified Audio Level
    const currentAudioLevel = Math.max(audioLevel, systemAudioLevel || 0);

    // NEW (SOTA): Sticky Instability for Hysteresis
    const [stickyInstability, setStickyInstability] = useState(false);
    const instabilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 3. Jitter & Silence Detection (Ref-based loop or Effect on level change)
    useEffect(() => {
        if (!isRecording || isPaused) {
            setJitterStatus('stable');
            setIsSilent(false);
            return;
        }

        const now = Date.now();

        // --- Silence Detection ---
        if (currentAudioLevel < SILENCE_THRESHOLD) {
            if (!silenceStartRef.current) silenceStartRef.current = now;
            else if (now - silenceStartRef.current > SILENCE_DURATION_MS) {
                setIsSilent(true);
            }
        } else {
            silenceStartRef.current = null;
            if (isSilent) setIsSilent(false);
        }

        // --- Jitter/Stagnation Detection ---
        // If level hasn't changed AT ALL (strictly equal) for > 500ms while recording, it's suspicious (hardware freeze?)
        // Real mics always have noise.
        if (currentAudioLevel === lastAudioLevel.current && currentAudioLevel > 0) {
            if (now - lastAudioChangeTime.current > JITTER_CHECK_WINDOW) {
                setJitterStatus('stagnant');
            }
        } else {
            lastAudioLevel.current = currentAudioLevel;
            lastAudioChangeTime.current = now;
            if (jitterStatus === 'stagnant') setJitterStatus('stable');
        }

    }, [currentAudioLevel, isRecording, isPaused]);

    // 4. Latency Estimation (Network RTT + Heuristic)
    // SOTA: Use Network Worker Status
    const sessionId = useMeetingStore(s => s.sessionId);
    const socketId = `transcription-${sessionId || 'default'}`;
    const { status: workerStatus } = useNetworkWorker(socketId);

    useEffect(() => {
        // ... existing latency logic ...
        const nav = navigator as any;
        if (!nav.connection) return;

        const updateLatency = () => {
            const rtt = nav.connection.rtt || 50;
            // Add "Model Processing Overhead" heuristic (e.g. +100ms standard, +300ms if '4g')
            const overhead = 150;
            const newLatency = rtt + overhead;
            setNetworkLatency(newLatency);

            // Track latency history for predictive trend
            historyRef.current.push({ time: Date.now(), status: 'optimal', latency: newLatency });
        };

        updateLatency();
        // Poll regularly or listen to events
        const interval = setInterval(updateLatency, 2000); // Faster polling for trend detection
        return () => clearInterval(interval);
    }, []);

    // NEW (SOTA): Instability Watcher with Debounce/Hysteresis
    useEffect(() => {
        const checkInstability = () => {
            const recentLatencies = historyRef.current.slice(-5).map(h => h.latency || 0);
            // Strict rising trend check
            const isLatencyRising = recentLatencies.length >= 5
                && recentLatencies.every((val, i, arr) => i === 0 || val >= arr[i - 1])
                && recentLatencies[4] > recentLatencies[0] + 50;

            if (isLatencyRising) {
                setStickyInstability(true);
                // Clear any pending reset
                if (instabilityTimer.current) clearTimeout(instabilityTimer.current);
                // Set decay timer (5s hold)
                instabilityTimer.current = setTimeout(() => {
                    setStickyInstability(false);
                }, 5000);
            }
        };

        const interval = setInterval(checkInstability, 1000);
        return () => {
            clearInterval(interval);
            if (instabilityTimer.current) clearTimeout(instabilityTimer.current);
        };
    }, []);

    // 5. Diagnostic Engine (Memoized)
    const sessionHealth = useMemo((): SessionHealth => {
        const hardwareIssues: string[] = [];
        const infraIssues: string[] = [];
        const intelligenceIssues: string[] = [];

        // --- Layer 1: Hardware ---
        if (micPermission === 'denied') hardwareIssues.push('Mic Access Denied');
        if (micPermission === 'prompt') hardwareIssues.push('Mic Permission Needed');
        // Check local sample rate if available (mocked check for now as we don't have direct access to AudioContext here without store expansion)
        // heuristic: if audioLevel never moves from 0 but permission is granted -> Hardware Sample Mismatch potential
        if (micPermission === 'granted' && currentAudioLevel === 0 && isRecording && !isPaused && elapsedTime > 5) {
            hardwareIssues.push('No Signal Detected (Check Input Device)');
        }

        // --- Layer 2: Infra & Latency Prediction ---
        if (!audioServiceStatus && workerStatus === 'disconnected') infraIssues.push('Audio Service Disconnected');
        if (workerStatus === 'reconnecting') infraIssues.push('Network Reconnecting...');
        if (workerStatus === 'connecting') infraIssues.push('Connecting to Service...');

        // Latency Trend Analysis
        // SOTA: Use Sticky State to prevent flickering
        if (networkLatency > LATENCY_WARNING_THRESHOLD) {
            infraIssues.push('High Latency');
        } else if (stickyInstability) {
            infraIssues.push('Network Instability Detected');
        }

        // Check simple online status
        if (!navigator.onLine) infraIssues.push('Offline');

        // --- Layer 3: Intelligence ---
        if (picoVoiceStatus === 'failed') intelligenceIssues.push('Speaker ID Failed');
        if (jitterStatus === 'stagnant') intelligenceIssues.push('Audio Signal Frozen');

        // --- Aggregation ---
        let status: HealthStatus = 'optimal';
        let message = 'Systems Nominal';
        let action: RemediationAction | undefined;

        if (hardwareIssues.length > 0) {
            status = 'critical';
            message = hardwareIssues[0];
            if (message.includes('Mic')) action = { label: 'Fix Mic', action: 'reset_mic' };
        } else if (infraIssues.length > 0) {
            status = infraIssues.includes('Offline') || !audioServiceStatus ? 'critical' : 'warning';
            message = infraIssues[0];

            // Smart Action for Infra
            if (message.includes('Audio Service') || message.includes('Instability')) {
                action = { label: 'Reconnect', action: 'check_network' };
            } else {
                action = { label: 'Optimize Info', action: 'check_network' };
            }

        } else if (intelligenceIssues.length > 0) {
            status = 'warning';
            message = intelligenceIssues[0];
            action = { label: 'Restart Engine', action: 'optimize_system' };
        }

        return {
            status,
            message,
            isDeclining: false, // Calculated in effect below
            recommendedAction: action,
            layers: {
                hardware: { status: hardwareIssues.length ? 'critical' : 'optimal', issues: hardwareIssues },
                infra: { status: infraIssues.length ? 'warning' : 'optimal', issues: infraIssues },
                inteligencia: { status: intelligenceIssues.length ? 'warning' : 'optimal', issues: intelligenceIssues }
            },
            metrics: {
                latencyMs: networkLatency,
                jitter: jitterStatus
            }
        };
    }, [micPermission, systemPermission, currentAudioLevel, isRecording, isPaused, audioServiceStatus, networkLatency, picoVoiceStatus, jitterStatus, elapsedTime]);

    // 6. Trend Analysis (Is it getting worse?)
    // Using a ref to track the previous status to set 'isDeclining'
    // We update a history buffer in ref, then derived `isDeclining`
    // Actually, to make `isDeclining` reactive in the return object, we need it in state or effect loop.
    // Simplifying: Compare current calculated status to "status 10s ago".
    // Since we can't travel time, we keep a timestamped log in a Ref.



    // Extend the sessionHealth object with the historical data analysis
    const augmentedHealth = useMemo(() => {
        const now = Date.now();
        // Add current point
        historyRef.current.push({ time: now, status: sessionHealth.status });
        // Prune > 20s
        historyRef.current = historyRef.current.filter(h => now - h.time < 20000);

        // Find status ~10s ago
        const tenSecAgo = historyRef.current.find(h => now - h.time >= 10000); // oldest closest to 10s window

        let isDeclining = false;
        if (tenSecAgo) {
            if (tenSecAgo.status === 'optimal' && sessionHealth.status !== 'optimal') isDeclining = true;
            if (tenSecAgo.status === 'warning' && sessionHealth.status === 'critical') isDeclining = true;
        }

        return { ...sessionHealth, isDeclining };
    }, [sessionHealth]);


    const getTranscriptionStatus = () => {
        if (!isRecording) return { label: "Ready", color: "text-muted-foreground" };
        if (isPaused) return { label: "Paused", color: "text-amber-500" };

        // Dynamic status based on health
        if (augmentedHealth.status === 'critical') return { label: "Error", color: "text-red-500" };
        if (augmentedHealth.status === 'warning') return { label: "Degraded", color: "text-yellow-500" };

        return { label: "Live", color: "text-emerald-500" };
    };

    return {
        isRecording,
        isPaused,
        elapsedTime,
        transcriptionStatus: getTranscriptionStatus(),
        sessionHealth: augmentedHealth,
        currentAudioLevel,
        isSilent
    };
};

