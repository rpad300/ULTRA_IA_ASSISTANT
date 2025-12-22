// Preload script - Exposes Electron APIs to renderer
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // System audio capture APIs
    audioCapture: {
        start: (options?: { sampleRate?: number; channels?: number; format?: 'pcm' | 'wav'; deviceName?: string }) => 
            ipcRenderer.invoke('audio-capture:start', options),
        stop: () => 
            ipcRenderer.invoke('audio-capture:stop'),
        status: () => 
            ipcRenderer.invoke('audio-capture:status'),
        test: () => 
            ipcRenderer.invoke('audio-capture:test'),
        listDevices: () => 
            ipcRenderer.invoke('audio-capture:list-devices'),
        onData: (callback: (chunk: Uint8Array) => void) => {
            ipcRenderer.on('audio-capture:data', (event, chunk: Buffer) => {
                // Convert Node.js Buffer to Uint8Array for frontend
                callback(new Uint8Array(chunk));
            });
        },
        onError: (callback: (error: string) => void) => {
            ipcRenderer.on('audio-capture:error', (event, error) => callback(error));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('audio-capture:data');
            ipcRenderer.removeAllListeners('audio-capture:error');
        },
    },
    
    // Check if running in Electron
    isElectron: true,
});

// Note: process.versions is not available when contextIsolation is enabled
// If you need version info, expose it via contextBridge
