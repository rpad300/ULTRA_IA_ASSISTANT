/**
 * Type definitions for Electron APIs exposed via preload
 */

export interface ElectronAPI {
    audioCapture: {
        start: (options?: { sampleRate?: number; channels?: number; format?: 'pcm' | 'wav'; deviceName?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
        stop: () => Promise<{ success: boolean; message?: string; error?: string }>;
        status: () => Promise<{ isCapturing: boolean }>;
        test: () => Promise<{ success: boolean; error?: string; message?: string; isActive?: boolean }>;
        listDevices: () => Promise<{ success: boolean; devices?: Array<{ name: string; altName?: string; type: 'loopback' | 'input' | 'output' }>; error?: string }>;
        onData: (callback: (chunk: Uint8Array) => void) => void;
        onError: (callback: (error: string) => void) => void;
        removeListeners: () => void;
    };
    isElectron: boolean;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

