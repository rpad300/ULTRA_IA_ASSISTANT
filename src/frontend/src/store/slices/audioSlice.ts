import type { StateCreator } from 'zustand';
import type { MeetingState } from '../meetingStore';
import { audioServiceApi } from '@/api/client';
import type { AudioServiceStatus, AudioDevice } from '@/types/slices/audio';

export interface AudioSlice {
    // Service State
    audioServiceStatus: AudioServiceStatus | null;
    audioServiceDevices: { microphones: AudioDevice[]; speakers: AudioDevice[] }; // Renamed from audioDevices

    // Legacy / UI Flags
    isAudioCapturing: boolean;
    audioLevel: number;
    systemAudioLevel: number;
    picoVoiceStatus: 'unknown' | 'initializing' | 'ready' | 'failed';

    // Permissions
    microphonePermission: 'granted' | 'denied' | 'prompt' | 'unknown';
    systemAudioPermission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested';

    // Config State
    audioGain: number;
    selectedMicrophoneDevice: string | null;
    selectedSystemAudioDevice: string | null;
    customVocabulary: string[];
    autoStopEnabled: boolean;
    silenceTimeoutMs: number;

    startAudioService: (sysId?: string, micId?: string) => Promise<void>;
    stopAudioService: () => Promise<void>;
    // Actions
    getAudioServiceStatus: () => Promise<AudioServiceStatus | null>;
    refreshAudioStatus: () => Promise<void>;
    startNativeStream: (sessionId: string) => Promise<void>;
    stopAllAudio: () => Promise<void>;

    // Config Actions
    setGain: (gain: number) => Promise<void>;
    setAudioGain: (gain: number) => Promise<void>;
    setCustomVocabulary: (vocab: string[]) => void;
    setAutoStopEnabled: (enabled: boolean) => void;

    // Permission Actions
    checkMicrophonePermission: () => Promise<void>;
    requestMicrophonePermission: () => Promise<void>;
    requestSystemAudioPermission: () => Promise<void>;
    setMicrophonePermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown') => void;
    setSystemAudioPermission: (permission: 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested') => void;

    // Level Acts
    setAudioLevel: (level: number) => void;
    setSystemAudioLevel: (level: number) => void;
    setAudioCapturing: (isCapturing: boolean) => void;
    setPicoVoiceStatus: (status: 'unknown' | 'initializing' | 'ready' | 'failed') => void;

    // Device Actions
    getAudioServiceDevices: () => Promise<{ microphones: AudioDevice[]; speakers: AudioDevice[] }>;
    setAudioServiceDevice: (deviceId: string) => Promise<void>;
    setSelectedMicrophoneDevice: (deviceId: string | null) => void;
    setSelectedSystemAudioDevice: (deviceId: string | null) => void;
}

export const createAudioSlice: StateCreator<MeetingState, [], [], AudioSlice> = (set, get) => ({
    audioServiceStatus: null,
    audioServiceDevices: { microphones: [], speakers: [] },

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

    getAudioServiceStatus: async () => {
        try {
            const apiStatus = await audioServiceApi.getStatus();
            const mapped: AudioServiceStatus = {
                isCapturing: apiStatus.isCapturing,
                isConnected: apiStatus.isConnected,
                isBackendConnected: apiStatus.isConnected, // Alias
                isAssemblyAIConnected: apiStatus.isAssemblyAIConnected,
                selectedDeviceId: apiStatus.selectedDeviceId,
                levels: {
                    mic: apiStatus.microphone?.level || 0,
                    system: apiStatus.systemAudio?.level || 0
                },
                // Legacy Compat
                microphone: {
                    level: apiStatus.microphone?.level || 0,
                    detectingAudio: (apiStatus.microphone?.level || 0) > 0,
                    deviceName: apiStatus.microphone?.deviceName || 'Standard Mic'
                },
                systemAudio: {
                    level: apiStatus.systemAudio?.level || 0,
                    detectingAudio: (apiStatus.systemAudio?.level || 0) > 0,
                    deviceName: apiStatus.systemAudio?.deviceName || 'System Audio'
                }
            };
            set({ audioServiceStatus: mapped });
            return mapped;
        } catch (e) {
            set({ audioServiceStatus: null });
            return null;
        }
    },

    refreshAudioStatus: async () => {
        await get().getAudioServiceStatus();
    },

    startNativeStream: async (sessionId: string) => {
        let micId = get().selectedMicrophoneDevice || get().audioServiceStatus?.selectedDeviceId;
        let sysId = get().selectedSystemAudioDevice;

        // Auto-select first microphone
        if (!micId) {
            const devices = await get().getAudioServiceDevices();
            if (devices.microphones.length > 0) {
                micId = devices.microphones[0].id;
                set({ selectedMicrophoneDevice: micId });
                console.log("[AudioSlice] Auto-selected Microphone:", devices.microphones[0].name);
            }

            // Auto-select first System Audio (Speaker) for Loopback
            if (!sysId && devices.speakers.length > 0) {
                sysId = devices.speakers[0].id;
                set({ selectedSystemAudioDevice: sysId });
                console.log("[AudioSlice] Auto-selected System Audio:", devices.speakers[0].name);
            }
        }


        // Read preference from localStorage (set by SettingsView)
        const pref = localStorage.getItem('transcription_preference');
        const useAssemblyAI = pref !== 'whisper'; // Default to true unless explicitly whisper

        const payload = {
            sessionId,
            micId: micId || undefined,
            sysId: sysId || undefined,
            useAssemblyAI
        };
        await audioServiceApi.startStreaming(payload.sysId, payload.micId, [], sessionId, payload.useAssemblyAI);
        set({ isAudioCapturing: true });
    },

    startAudioService: async (sysId?: string, micId?: string) => {
        // Compatibility: Allow passing device IDs, set them in state, then start
        if (sysId) set({ selectedSystemAudioDevice: sysId });
        if (micId) set({ selectedMicrophoneDevice: micId });

        // Retrieve sessionId from the root store (SessionSlice)
        // We cast to any to access sibling slices in the monolithic store
        const sessionId = (get() as any).sessionId;
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
        set({ audioServiceStatus: null, isAudioCapturing: false });
    },

    stopAudioService: async () => {
        return get().stopAllAudio();
    },

    setGain: async (gain: number) => {
        if (get().audioServiceStatus?.isConnected) {
            await audioServiceApi.setGain(gain);
        }
        set({ audioGain: gain });
    },

    setAudioGain: async (gain: number) => {
        if (get().audioServiceStatus?.isConnected) {
            await audioServiceApi.setGain(gain);
        }
        set({ audioGain: gain });
    },

    setCustomVocabulary: (vocab) => set({ customVocabulary: vocab }),
    setAutoStopEnabled: (enabled) => set({ autoStopEnabled: enabled }),

    checkMicrophonePermission: async () => {
        // Mock implementation for browser permission check
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            set({ microphonePermission: 'granted' });
        } catch (e) {
            set({ microphonePermission: 'denied' });
        }
    },

    requestMicrophonePermission: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            set({ microphonePermission: 'granted' });
        } catch (e) {
            set({ microphonePermission: 'denied' });
        }
    },

    requestSystemAudioPermission: async () => {
        // Mock - typically requires screen sharing or specific API
        set({ systemAudioPermission: 'granted' });
    },

    setMicrophonePermission: (p) => set({ microphonePermission: p }),
    setSystemAudioPermission: (p) => set({ systemAudioPermission: p }),

    setAudioLevel: (l) => set({ audioLevel: l }),
    setSystemAudioLevel: (l) => set({ systemAudioLevel: l }),
    setAudioCapturing: (c) => set({ isAudioCapturing: c }),
    setPicoVoiceStatus: (s) => set({ picoVoiceStatus: s }),

    getAudioServiceDevices: async () => {
        try {
            const response = await audioServiceApi.getDevices();
            const { microphones, speakers } = response.devices;

            // Map to store AudioDevice type which requires isDefault and kind
            const mapDevice = (d: any, kind: 'microphone' | 'speaker'): AudioDevice => ({
                id: d.id,
                name: d.name,
                isDefault: !!d.isDefault,
                kind: kind
            });

            const mappedMics = microphones.map(d => mapDevice(d, 'microphone'));
            const mappedSpeakers = speakers.map(d => mapDevice(d, 'speaker'));

            set({ audioServiceDevices: { microphones: mappedMics, speakers: mappedSpeakers } });
            return { microphones: mappedMics, speakers: mappedSpeakers };
        } catch (e) {
            console.error("Failed to fetch devices", e);
            return { microphones: [], speakers: [] };
        }
    },

    setAudioServiceDevice: async (_deviceId) => {
        // Logic to call API if backend supports setting device explicitly
        // or just update local selection state
        // backend startStreaming takes deviceId, so we just update state here.
    },

    setSelectedMicrophoneDevice: (id) => set({ selectedMicrophoneDevice: id }),
    setSelectedSystemAudioDevice: (id) => set({ selectedSystemAudioDevice: id }),
});
