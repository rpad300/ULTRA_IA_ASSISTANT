import type { MeetingSlice, AudioSlice } from '../types';
import { audioServiceApi } from '@/api/client';
import type { AudioServiceStatus, AudioDevice, CaptureState, Infrastructure } from '@/types/slices/audio';
import { toDeviceId } from '@/types/slices/audio';

export const createAudioSlice: MeetingSlice<AudioSlice> = (set, get) => ({
    audioServiceStatus: null,
    audioServiceDevices: { microphones: [], speakers: [] },

    // Legacy / Convenience flags (computed or synced)
    isAudioCapturing: false,
    audioLevel: 0,
    systemAudioLevel: 0,
    picoVoiceStatus: 'unknown',

    microphonePermission: 'unknown',
    systemAudioPermission: 'unknown',

    // Config Defaults
    audioGain: 1.0,
    selectedMicrophoneDevice: null,
    selectedSystemAudioDevice: null,
    customVocabulary: [],
    autoStopEnabled: true,
    silenceTimeoutMs: 5000,

    // Internal State for Sticky Clipping
    _lastMicClipTime: 0,
    _lastSystemClipTime: 0,

    // --- Actions ---

    setSignalStability: (stability: number) => set((s) => {
        if (s.audioServiceStatus) {
            s.audioServiceStatus.signalStability = stability;
        }
    }),

    measureBackendLatency: async () => {
        const start = performance.now();
        try {
            await audioServiceApi.getStatus(); // Simple ping
            const latency = Math.round(performance.now() - start);
            return latency > 0 ? latency : 1;
        } catch {
            return -1;
        }
    },

    getAudioServiceStatus: async () => {
        const startLatency = performance.now();
        try {
            const apiStatus = await audioServiceApi.getStatus();
            const latency = Math.round(performance.now() - startLatency);

            // --- SOTA Mapping Logic ---

            // 1. Capture State
            let captureState: CaptureState;
            if (apiStatus.isCapturing) {
                captureState = { status: 'capturing' };
            } else {
                captureState = { status: 'idle' };
            }

            // 2. Infrastructure
            const infra: Infrastructure = {
                backend: {
                    status: apiStatus.isBackendConnected || apiStatus.isConnected ? 'connected' : 'disconnected',
                    latencyMs: latency
                },
                provider: {
                    status: apiStatus.isAssemblyAIConnected ? 'connected' : 'disconnected',
                    latencyMs: undefined // Cloud latency unknown for now
                },
                localService: {
                    status: 'connected',
                    latencyMs: 5 // IPC overhead
                }
            };

            // 3. Telemetry & Sticky Clipping
            const now = Date.now();
            const micLevelVal = apiStatus.microphone?.level || 0;
            const sysLevelVal = apiStatus.systemAudio?.level || 0;

            // Mic Clipping
            const isMicClippingRaw = micLevelVal > 0.95;
            const currentLastMicClip = (get() as any)._lastMicClipTime || 0;
            let micClipping = isMicClippingRaw;
            let newLastMicClip = currentLastMicClip;

            if (isMicClippingRaw) {
                newLastMicClip = now;
            } else if (now - currentLastMicClip < 500) {
                micClipping = true; // Hold
            }

            // System Clipping
            const isSysClippingRaw = sysLevelVal > 0.95;
            const currentLastSysClip = (get() as any)._lastSystemClipTime || 0;
            let sysClipping = isSysClippingRaw;
            let newLastSysClip = currentLastSysClip;

            if (isSysClippingRaw) {
                newLastSysClip = now;
            } else if (now - currentLastSysClip < 500) {
                sysClipping = true; // Hold
            }

            // Construct SOTA Status Object
            const sotaStatus: AudioServiceStatus = {
                status: captureState,
                infrastructure: infra,
                selectedDeviceId: apiStatus.selectedDeviceId ? toDeviceId(apiStatus.selectedDeviceId) : null,
                levels: {
                    mic: {
                        rms: micLevelVal,
                        peak: micLevelVal,
                        clipping: micClipping
                    },
                    system: {
                        rms: sysLevelVal,
                        peak: sysLevelVal,
                        clipping: sysClipping
                    }
                },
                signalStability: 1.0 // This will be updated by the runtime hook, start with ideal
            };

            set((state: any) => {
                state.audioServiceStatus = sotaStatus;
                // Update legacy flags
                state.isAudioCapturing = apiStatus.isCapturing;
                state._lastMicClipTime = newLastMicClip;
                state._lastSystemClipTime = newLastSysClip;
            });

            return sotaStatus;
        } catch (e) {
            set((state) => {
                const errorState: AudioServiceStatus = {
                    status: {
                        status: 'error',
                        error: {
                            code: 'CONNECTION_FAILED',
                            message: 'Could not reach audio service',
                            recoverable: true
                        }
                    },
                    infrastructure: {
                        backend: { status: 'failed', latencyMs: 0 },
                        provider: { status: 'disconnected', latencyMs: 0 },
                        localService: { status: 'failed', latencyMs: 0 }
                    },
                    selectedDeviceId: null,
                    levels: {
                        mic: { rms: 0, peak: 0, clipping: false },
                        system: { rms: 0, peak: 0, clipping: false }
                    },
                    signalStability: 0
                };

                state.audioServiceStatus = errorState;
                state.isAudioCapturing = false;
            });
            return null;
        }
    },

    refreshAudioStatus: async () => {
        await get().getAudioServiceStatus();
    },

    startNativeStream: async (sessionId: string) => {
        const state = get();
        set((s) => {
            if (s.audioServiceStatus) {
                s.audioServiceStatus.status = { status: 'initializing' };
            }
        });

        let micId = state.selectedMicrophoneDevice || state.audioServiceStatus?.selectedDeviceId;
        let sysId = state.selectedSystemAudioDevice;

        // Auto-select logic
        if (!micId) {
            const devices = await state.getAudioServiceDevices();
            if (devices.microphones.length > 0) {
                micId = devices.microphones[0].id;
                set((s) => { s.selectedMicrophoneDevice = micId!; });
            }
            if (!sysId && devices.speakers.length > 0) {
                sysId = devices.speakers[0].id;
                set((s) => { s.selectedSystemAudioDevice = sysId!; });
            }
        }

        const pref = localStorage.getItem('transcription_preference');
        const useAssemblyAI = pref !== 'whisper';

        try {
            await audioServiceApi.startStreaming(sysId || undefined, micId || undefined, [], sessionId, useAssemblyAI);
            set((s) => {
                s.isAudioCapturing = true;
                if (s.audioServiceStatus) {
                    s.audioServiceStatus.status = { status: 'capturing' };
                    s.audioServiceStatus.infrastructure.backend.status = 'connected';
                    s.audioServiceStatus.infrastructure.provider.status = 'connected';
                }
            });
        } catch (e) {
            set((s) => {
                if (s.audioServiceStatus) {
                    s.audioServiceStatus.status = {
                        status: 'error',
                        error: { code: 'START_FAILED', message: 'Failed to start stream', recoverable: true }
                    };
                }
            });
        }
    },

    startAudioService: async (sysId?: string, micId?: string) => {
        if (sysId) set((s) => { s.selectedSystemAudioDevice = sysId; });
        if (micId) set((s) => { s.selectedMicrophoneDevice = micId; });

        const sessionId = get().sessionId;
        if (!sessionId) {
            console.warn("Cannot start audio service: No active session ID");
            return;
        }
        return get().startNativeStream(sessionId);
    },

    stopAllAudio: async () => {
        await audioServiceApi.stopStreaming();
        if ((window as any).__nativeTranscriptionWs) {
            (window as any).__nativeTranscriptionWs.close();
            (window as any).__nativeTranscriptionWs = null;
        }
        set((s) => {
            s.isAudioCapturing = false;
            // Update SOTA status
            if (s.audioServiceStatus) {
                s.audioServiceStatus.status = { status: 'idle' };
                // Reset levels
                s.audioServiceStatus.levels.mic = { rms: 0, peak: 0, clipping: false };
                s.audioServiceStatus.levels.system = { rms: 0, peak: 0, clipping: false };
            }
        });
    },

    stopAudioService: async () => {
        return get().stopAllAudio();
    },

    setGain: async (gain: number) => {
        if (get().audioServiceStatus?.infrastructure.backend.status === 'connected') {
            await audioServiceApi.setGain(gain);
        }
        set((s) => { s.audioGain = gain; });
    },

    setAudioGain: async (gain: number) => {
        if (get().audioServiceStatus?.infrastructure.backend.status === 'connected') {
            await audioServiceApi.setGain(gain);
        }
        set((s) => { s.audioGain = gain; });
    },

    setCustomVocabulary: (vocab) => set((s) => { s.customVocabulary = vocab; }),
    setAutoStopEnabled: (enabled) => set((s) => { s.autoStopEnabled = enabled; }),

    checkMicrophonePermission: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            set((s) => { s.microphonePermission = 'granted'; });
        } catch (e) {
            set((s) => { s.microphonePermission = 'denied'; });
        }
    },

    requestMicrophonePermission: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            set((s) => { s.microphonePermission = 'granted'; });
        } catch (e) {
            set((s) => { s.microphonePermission = 'denied'; });
        }
    },

    requestSystemAudioPermission: async () => {
        set((s) => { s.systemAudioPermission = 'granted'; });
    },

    setMicrophonePermission: (p) => set((s) => { s.microphonePermission = p; }),
    setSystemAudioPermission: (p) => set((s) => { s.systemAudioPermission = p; }),

    setAudioLevel: (l) => set((s) => { s.audioLevel = l; }),
    setSystemAudioLevel: (l) => set((s) => { s.systemAudioLevel = l; }),

    setAudioCapturing: (c) => set((s) => { s.isAudioCapturing = c; }),
    setPicoVoiceStatus: (status) => set((s) => { s.picoVoiceStatus = status; }),

    getAudioServiceDevices: async () => {
        try {
            const response = await audioServiceApi.getDevices();
            const { microphones, speakers } = response.devices;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapDevice = (d: any, kind: 'microphone' | 'speaker'): AudioDevice => ({
                id: toDeviceId(d.id),
                name: d.name,
                isDefault: !!d.isDefault,
                kind: kind,
                capabilities: {
                    noiseSuppression: false,
                    echoCancellation: false,
                    autoGainControl: false
                },
                sampleRate: 0, // Unknown
                channels: 0    // Unknown
            });

            const mappedMics = microphones.map(d => mapDevice(d, 'microphone'));
            const mappedSpeakers = speakers.map(d => mapDevice(d, 'speaker'));

            set((s) => { s.audioServiceDevices = { microphones: mappedMics, speakers: mappedSpeakers }; });
            return { microphones: mappedMics, speakers: mappedSpeakers };
        } catch (e) {
            console.error("Failed to fetch devices", e);
            return { microphones: [], speakers: [] };
        }
    },

    setAudioServiceDevice: async (_deviceId) => {
        // Placeholder for explicit device setting if supported by backend
    },

    setSelectedMicrophoneDevice: (id) => set((s) => { s.selectedMicrophoneDevice = id; }),
    setSelectedSystemAudioDevice: (id) => set((s) => { s.selectedSystemAudioDevice = id; }),
});
