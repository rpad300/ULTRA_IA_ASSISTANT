import { useState, useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/store/meetingStore';

// Smart polling configuration
const POLLING_INTERVAL_ACTIVE = 1000;
const POLLING_INTERVAL_IDLE = 3000;
const POLLING_INTERVAL_ERROR = 5000;

interface AudioDevice {
    id: string;
    name: string;
    type: 'input' | 'loopback';
}

export function useAudioServiceRuntime(isOpen: boolean) {
    const getAudioServiceStatus = useMeetingStore(state => state.getAudioServiceStatus);
    const getAudioServiceDevices = useMeetingStore(state => state.getAudioServiceDevices);
    const setAudioServiceDevice = useMeetingStore(state => state.setAudioServiceDevice);
    const startAudioService = useMeetingStore(state => state.startAudioService);
    const stopAudioService = useMeetingStore(state => state.stopAudioService);
    const audioServiceStatus = useMeetingStore(state => state.audioServiceStatus);
    const selectedMicrophoneDevice = useMeetingStore(state => state.selectedMicrophoneDevice);
    const selectedSystemAudioDevice = useMeetingStore(state => state.selectedSystemAudioDevice);
    const setSelectedMicrophoneDevice = useMeetingStore(state => state.setSelectedMicrophoneDevice);
    const setSelectedSystemAudioDevice = useMeetingStore(state => state.setSelectedSystemAudioDevice);
    const audioGain = useMeetingStore(state => state.audioGain);
    const setAudioGain = useMeetingStore(state => state.setAudioGain);
    const setSignalStability = useMeetingStore(state => state.setSignalStability);

    const [devices, setDevices] = useState<{ inputs: AudioDevice[], loopbacks: AudioDevice[] }>({ inputs: [], loopbacks: [] });
    const [loading, setLoading] = useState(false);
    const [serviceError, setServiceError] = useState<boolean>(false);
    // Removed isPolling state as it is no longer used

    // Signal Health Logic
    const [signalHealth, setSignalHealth] = useState<'excellent' | 'good' | 'poor' | 'none'>('none');
    const silenceStartRef = useRef<number | null>(null);

    // 1. Device Loading with Memoization & Hot-Plugging
    const loadDevices = useCallback(async () => {
        try {
            const rawDevices = await getAudioServiceDevices();
            if (rawDevices.microphones.length > 0 || rawDevices.speakers.length > 0) {
                const inputs: AudioDevice[] = rawDevices.microphones.map(d => ({ id: d.id, name: d.name, type: 'input' }));
                const loopbacks: AudioDevice[] = rawDevices.speakers.map(d => ({ id: d.id, name: d.name, type: 'loopback' }));

                // Only update if changed (simple length/id check could be better but this is safe)
                setDevices({ inputs, loopbacks });
            }
        } catch (error) {
            console.error("Failed to load devices", error);
        }
    }, [getAudioServiceDevices]);

    // Hot-Plugging Listener
    useEffect(() => {
        if (!isOpen) return;

        const handleDeviceChange = () => {
            // eslint-disable-next-line no-console
            console.log("[AudioRuntime] Hardware change detected, refreshing list...");
            loadDevices();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        loadDevices(); // Initial load

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [isOpen, loadDevices]);


    // 2. Smart Polling for Status
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        let timeoutId: any;

        const loop = async () => {
            if (!isMounted) return;

            // Fetch status
            let isError = false;
            try {
                // We use the store action access via hook, but we need to ensure we don't depend on it changing often.
                // Actually start/stop/get actions are usually stable in Zustand.
                const status = await getAudioServiceStatus();
                if (status) {
                    setServiceError(false);
                } else {
                    setServiceError(true);
                    isError = true;
                }
            } catch (error) {
                setServiceError(true);
                isError = true;
            }

            if (!isMounted) return;

            // Determine next interval using current state (via store direct access if needed, or just the local result)
            // We use the result of the call we just made, so we don't need to depend on store state
            const currentStatus = useMeetingStore.getState().audioServiceStatus;

            let nextInterval = POLLING_INTERVAL_ACTIVE;
            if (isError) nextInterval = POLLING_INTERVAL_ERROR;
            else if (currentStatus?.status.status !== 'capturing') nextInterval = POLLING_INTERVAL_IDLE; // SOTA: Check status object

            timeoutId = setTimeout(loop, nextInterval);
        };

        loop();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isOpen, getAudioServiceStatus]);


    // 3. Signal Health Calculation
    useEffect(() => {
        if (audioServiceStatus?.status.status !== 'capturing') { // SOTA: Status check
            setSignalHealth('none');
            silenceStartRef.current = null;
            return;
        }

        // SOTA: Use RMS for signal presence
        const micLevel = audioServiceStatus.levels.mic.rms;

        if (micLevel > 0) {
            setSignalHealth(micLevel > 10 ? 'excellent' : 'good');
            setSignalStability(micLevel > 10 ? 1.0 : 0.9); // Sync to store
            silenceStartRef.current = null;
        } else {
            // Silence detected
            if (silenceStartRef.current === null) {
                silenceStartRef.current = Date.now();
                setSignalStability(0.8);
            } else {
                const diff = Date.now() - silenceStartRef.current;
                if (diff > 3000) { // 3 seconds of silence/dropout
                    setSignalHealth('poor');
                    setSignalStability(0.2); // Critical drop
                }
            }
        }
    }, [audioServiceStatus, setSignalStability]);

    // 4. True Auto-Calibration
    const calibrationBufferRef = useRef<number[]>([]);

    // Monitor levels during calibration
    useEffect(() => {
        if (!loading || audioServiceStatus?.status.status !== 'capturing') return; // SOTA: Status check

        // Push current level to buffer if calibrating
        // SOTA: Use RMS
        const currentLevel = audioServiceStatus.levels.mic.rms;
        calibrationBufferRef.current.push(currentLevel);
    }, [audioServiceStatus, loading]);

    const autoCalibrate = async () => {
        if (audioServiceStatus?.status.status !== 'capturing') return 1.0; // SOTA: Status check

        setLoading(true);
        calibrationBufferRef.current = [];

        // Sampling duration: 3 seconds
        // We rely on the useEffect above to collect samples while we wait
        await new Promise(r => setTimeout(r, 3000));

        setLoading(false);

        const samples = calibrationBufferRef.current;
        if (samples.length === 0) return audioGain; // No audio detected

        // Find peak in the captured window
        // We ignore low noise floor (< 5%)
        const peak = Math.max(...samples);

        if (peak < 5) return audioGain; // Too quiet to calibrate reliably

        // Target: We want the peak to hit roughly 80% (Sweet spot)
        // Current: Peak * CurrentGain = ActualOutput (Conceptually)
        // Actually, the 'level' we receive might already be post-gain or pre-gain depending on backend.
        // Assuming 'level' is visually linear 0-100 for UI.

        // Logic:
        // If peak is 20%, we want it to be 80%. Multiplier needed = 4x.
        // If peak is 95%, we want it to be 80%. Multiplier needed = 0.84x.

        const targetLevel = 80;
        const adjustmentRatio = targetLevel / peak;

        // Apply to current gain
        const newRawGain = audioGain * adjustmentRatio;

        // Safety Clamps (0.1x to 4.0x)
        const newGain = Math.min(Math.max(newRawGain, 0.1), 4.0);

        // Round to 2 decimals
        const finalGain = Math.round(newGain * 100) / 100;

        await setAudioGain(finalGain);
        return finalGain;
    };

    const forceReconnect = async () => {
        setLoading(true);
        await getAudioServiceStatus();
        // Maybe try to fetch devices again to wake it up
        await loadDevices();
        setLoading(false);
    }

    return {
        devices,
        audioServiceStatus,
        serviceError,
        loading,
        signalHealth,
        selectedMicrophoneDevice,
        selectedSystemAudioDevice,
        audioGain,
        actions: {
            setSelectedMicrophoneDevice,
            setSelectedSystemAudioDevice,
            setAudioServiceDevice,
            startStreaming: startAudioService,
            stopStreaming: stopAudioService,
            autoCalibrate,
            setGain: setAudioGain,
            forceReconnect
        }
    };
}
