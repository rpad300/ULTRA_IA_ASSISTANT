export interface AudioServiceStatus {
    isCapturing: boolean;
    isConnected: boolean;
    isBackendConnected: boolean; // Legacy alias for isConnected
    isAssemblyAIConnected?: boolean;
    selectedDeviceId: string | null;

    // Modern Levels
    levels: {
        mic: number;
        system: number;
    };

    // Legacy Structure for Compatibility
    microphone?: {
        level: number;
        detectingAudio: boolean;
        deviceName: string;
    };
    systemAudio?: {
        level: number;
        detectingAudio: boolean;
        deviceName: string;
    };
}

export interface AudioDevice {
    id: string;
    name: string;
    isDefault: boolean;
    kind: 'microphone' | 'speaker';
}
