/**
 * WASAPI Loopback Capture for Windows
 * Uses native addon to capture system audio via WASAPI
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let wasapiModule: any = null;

// Try to load native WASAPI module (silently fail if not available)
try {
    // In development, the module will be in src/electron/native/build/Release/
    // In production, it should be in the same directory as the main process
    const modulePath = path.join(__dirname, 'native', 'build', 'Release', 'wasapi_capture.node');
    if (fs.existsSync(modulePath)) {
        wasapiModule = require(modulePath);
    } else {
        wasapiModule = null;
    }
} catch (error: any) {
    // Silently ignore - module not compiled, will use Python fallback
    wasapiModule = null;
}

export interface WASAPICaptureOptions {
    sampleRate?: number;
    channels?: number;
    onData?: (chunk: Buffer) => void;
    onError?: (error: Error) => void;
}

export class WASAPICapture {
    private capture: any = null;
    private options: WASAPICaptureOptions;
    private isCapturing: boolean = false;

    constructor(options: WASAPICaptureOptions = {}) {
        this.options = {
            sampleRate: options.sampleRate || 16000,
            channels: options.channels || 1,
            onData: options.onData,
            onError: options.onError,
        };
    }

    /**
     * Check if WASAPI capture is available
     */
    static isAvailable(): boolean {
        return wasapiModule !== null && os.platform() === 'win32';
    }

    /**
     * Start WASAPI loopback capture
     */
    async start(): Promise<void> {
        if (!WASAPICapture.isAvailable()) {
            throw new Error('WASAPI capture is not available. Make sure the native module is built and you are on Windows.');
        }

        if (this.isCapturing) {
            return;
        }

        try {
            this.capture = new wasapiModule.WASAPICapture(
                (data: Uint8Array) => {
                    // Convert Uint8Array to Buffer
                    const buffer = Buffer.from(data);
                    this.options.onData?.(buffer);
                },
                (error: string) => {
                    this.options.onError?.(new Error(error));
                }
            );

            const started = this.capture.start();
            if (!started) {
                throw new Error('Failed to start WASAPI capture');
            }

            this.isCapturing = true;
            console.log('WASAPI loopback capture started');
        } catch (error: any) {
            this.isCapturing = false;
            throw new Error(`Failed to start WASAPI capture: ${error.message}`);
        }
    }

    /**
     * Stop WASAPI capture
     */
    stop(): void {
        if (!this.isCapturing || !this.capture) {
            return;
        }

        try {
            this.capture.stop();
            this.capture = null;
            this.isCapturing = false;
            console.log('WASAPI loopback capture stopped');
        } catch (error: any) {
            console.error('Error stopping WASAPI capture:', error);
        }
    }

    /**
     * Check if currently capturing
     */
    isActive(): boolean {
        return this.isCapturing && this.capture?.isCapturing();
    }
}

