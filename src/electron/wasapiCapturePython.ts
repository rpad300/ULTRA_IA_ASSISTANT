/**
 * WASAPI Loopback Capture using Python (no native compilation needed!)
 * Uses sounddevice library which supports WASAPI loopback
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface WASAPICaptureOptions {
    sampleRate?: number;
    channels?: number;
    onData?: (chunk: Buffer) => void;
    onError?: (error: Error) => void;
}

export class WASAPICapturePython {
    private process: ChildProcess | null = null;
    private options: WASAPICaptureOptions;
    private isCapturing: boolean = false;
    private pythonScript: string;

    constructor(options: WASAPICaptureOptions = {}) {
        this.options = {
            sampleRate: options.sampleRate || 16000,
            channels: options.channels || 1,
            onData: options.onData,
            onError: options.onError,
        };

        // Path to Python script
        // In development: src/electron/wasapi_capture.py
        // In production: dist/electron/wasapi_capture.py
        // Try both locations
        const devPath = path.join(__dirname, 'wasapi_capture.py');
        const prodPath = path.join(__dirname, '..', 'electron', 'wasapi_capture.py');
        this.pythonScript = fs.existsSync(devPath) ? devPath : prodPath;
        
        // If still not found, try relative to project root
        if (!fs.existsSync(this.pythonScript)) {
            this.pythonScript = path.join(process.cwd(), 'src', 'electron', 'wasapi_capture.py');
        }
    }

    /**
     * Check if Python WASAPI capture is available
     */
    static async isAvailable(): Promise<boolean> {
        try {
            // Check if Python is available
            const pythonCheck = spawn('python', ['--version'], { stdio: 'pipe' });
            await new Promise<void>((resolve, reject) => {
                pythonCheck.on('exit', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error('Python not found'));
                });
                pythonCheck.on('error', reject);
            });

            // Check if sounddevice is installed
            const sounddeviceCheck = spawn('python', ['-c', 'import sounddevice'], { stdio: 'pipe' });
            await new Promise<void>((resolve, reject) => {
                sounddeviceCheck.on('exit', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error('sounddevice not installed'));
                });
                sounddeviceCheck.on('error', reject);
            });

            return os.platform() === 'win32';
        } catch {
            return false;
        }
    }

    /**
     * Start WASAPI loopback capture
     */
    async start(): Promise<void> {
        if (this.isCapturing) {
            return;
        }

        // Check if Python script exists
        if (!fs.existsSync(this.pythonScript)) {
            throw new Error(`Python script not found: ${this.pythonScript}`);
        }

        // Check if sounddevice is installed
        const checkSounddevice = spawn('python', ['-c', 'import sounddevice'], { stdio: 'pipe' });
        await new Promise<void>((resolve, reject) => {
            checkSounddevice.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error('sounddevice not installed. Run: pip install sounddevice'));
                } else {
                    resolve();
                }
            });
            checkSounddevice.on('error', reject);
        });

        this.isCapturing = true;

        // Start Python script
        this.process = spawn('python', [
            this.pythonScript,
            '--sample-rate', this.options.sampleRate!.toString(),
            '--channels', this.options.channels!.toString(),
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Handle stdout (audio data as binary)
        this.process.stdout?.on('data', (chunk: Buffer) => {
            if (this.isCapturing) {
                this.options.onData?.(chunk);
            }
        });

        // Handle stderr (errors and logs)
        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString();
            console.log('Python WASAPI:', message);
            
            if (message.includes('error') || message.includes('Error') || message.includes('Exception')) {
                this.options.onError?.(new Error(message));
            }
        });

        // Handle process exit
        this.process.on('exit', (code) => {
            this.isCapturing = false;
            if (code !== 0 && code !== null) {
                this.options.onError?.(new Error(`Python process exited with code ${code}`));
            }
        });

        this.process.on('error', (error) => {
            this.isCapturing = false;
            this.options.onError?.(error);
        });

        console.log('Python WASAPI loopback capture started');
    }

    /**
     * Stop WASAPI capture
     */
    stop(): void {
        if (!this.isCapturing || !this.process) {
            return;
        }

        this.process.kill();
        this.process = null;
        this.isCapturing = false;
        console.log('Python WASAPI loopback capture stopped');
    }

    /**
     * Check if currently capturing
     */
    isActive(): boolean {
        return this.isCapturing;
    }
}

