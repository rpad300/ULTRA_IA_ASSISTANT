// Branded Types for Safety
export type DeviceId = string & { readonly __brand: 'DeviceId' };

// Utility to cast string to DeviceId
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toDeviceId = (id: string): DeviceId => id as any;

// Connection Status for Infrastructure Nodes
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'failed';

export interface InfrastructureNode {
    status: ConnectionStatus;
    latencyMs?: number; // Real-time latency for SOTA diagnostics
}

export interface Infrastructure {
    backend: InfrastructureNode;
    provider: InfrastructureNode; // e.g. AssemblyAI
    localService?: InfrastructureNode; // Native C# Service
}

// Telemetry Types
export interface AudioLevel {
    rms: number; // Normalized 0-1
    peak: number; // Normalized 0-1 (Peak Holding support)
    clipping: boolean; // Sticky (holds true for 500ms)
}

// State Machine
export type CaptureState =
    | { status: 'idle' }
    | { status: 'initializing' }
    | { status: 'capturing' }
    | { status: 'paused' }
    | {
        status: 'error';
        error: {
            code: string;
            message: string;
            recoverable: boolean;
        };
    };

export interface AudioDevice {
    id: DeviceId;
    name: string;
    isDefault: boolean;
    kind: 'microphone' | 'speaker';
    // Deep Diagnostics
    capabilities?: {
        noiseSuppression?: boolean;
        echoCancellation?: boolean;
        autoGainControl?: boolean;
    };
    sampleRate?: number;
    channels?: number; // 1 = Mono, 2 = Stereo
}

export interface AudioServiceStatus {
    // State & Infra
    status: CaptureState;
    infrastructure: Infrastructure;

    // Selection
    selectedDeviceId: DeviceId | null;

    // SOTA Telemetry
    levels: {
        mic: AudioLevel;
        system: AudioLevel;
    };

    // Signal Health (0-1, 1 = perfect stream, 0 = high jitter/packet loss)
    signalStability: number;
}
