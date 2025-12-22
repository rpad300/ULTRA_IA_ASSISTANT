/**
 * System Audio Capture Service for Electron
 * Captures system audio (loopback) using platform-specific methods
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WASAPICapture } from './wasapiCapture';
import { WASAPICapturePython } from './wasapiCapturePython';

export interface AudioCaptureOptions {
    sampleRate?: number;
    channels?: number;
    format?: 'pcm' | 'wav';
    deviceName?: string; // Specific device to use (optional)
    onData?: (chunk: Buffer) => void;
    onError?: (error: Error) => void;
}

export interface AudioDevice {
    name: string;
    altName?: string;
    type: 'loopback' | 'input' | 'output';
    isDefault?: boolean;
}

export class SystemAudioCapture {
    private process: ChildProcess | null = null;
    private isCapturing: boolean = false;
    private options: AudioCaptureOptions;
    private tempFile: string | null = null;

    constructor(options: AudioCaptureOptions = {}) {
        this.options = {
            sampleRate: options.sampleRate ?? 16000,
            channels: options.channels ?? 1,
            format: options.format ?? 'pcm',
            deviceName: options.deviceName, // Optional - specific device to use
            onData: options.onData,
            onError: options.onError,
        };
    }

    /**
     * Start capturing system audio
     */
    async start(): Promise<void> {
        if (this.isCapturing) {
            throw new Error('Audio capture is already running');
        }

        const platform = os.platform();
        
        try {
            // Set isCapturing BEFORE starting capture to ensure data is processed
            this.isCapturing = true;
            
            if (platform === 'win32') {
                await this.startWindowsCapture();
            } else if (platform === 'darwin') {
                await this.startMacOSCapture();
            } else if (platform === 'linux') {
                await this.startLinuxCapture();
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            
            console.log('System audio capture started');
        } catch (error) {
            this.isCapturing = false;
            this.options.onError?.(error as Error);
            throw error;
        }
    }

    /**
     * Stop capturing system audio
     */
    stop(): void {
        if (!this.isCapturing) {
            return;
        }

        // Stop WASAPI Python capture if active
        if (this.wasapiCapturePython) {
            this.wasapiCapturePython.stop();
            this.wasapiCapturePython = null;
        }

        // Stop WASAPI native capture if active
        if (this.wasapiCapture) {
            this.wasapiCapture.stop();
            this.wasapiCapture = null;
        }

        // Stop FFmpeg process if active
        if (this.process) {
            this.process.kill();
            this.process = null;
        }

        // Clean up temp file
        if (this.tempFile && fs.existsSync(this.tempFile)) {
            try {
                fs.unlinkSync(this.tempFile);
            } catch (err) {
                console.warn('Failed to delete temp file:', err);
            }
            this.tempFile = null;
        }

        this.isCapturing = false;
        console.log('System audio capture stopped');
    }

    /**
     * Check if currently capturing
     */
    isActive(): boolean {
        return this.isCapturing;
    }

    private wasapiCapture: WASAPICapture | null = null;

    private wasapiCapturePython: WASAPICapturePython | null = null;

    /**
     * Windows: Try WASAPI native first (if compiled), then DirectShow
     * Note: Python WASAPI (sounddevice) doesn't support loopback, so we skip it
     * DirectShow is the reliable solution that works with Stereo Mix or VB-Audio Cable
     */
    private async startWindowsCapture(): Promise<void> {
        // Try WASAPI native capture first (if compiled)
        // This is the only way to get true WASAPI loopback without configuration
        if (WASAPICapture.isAvailable()) {
            try {
                console.log('Attempting WASAPI native capture...');
                await this.startWASAPINativeCapture();
                return;
            } catch (error: any) {
                console.warn('WASAPI native capture failed, falling back to DirectShow:', error.message);
                // Fall through to DirectShow
            }
        }

        // Use DirectShow (reliable solution - works with Stereo Mix or VB-Audio Cable)
        // Note: Python WASAPI (sounddevice) doesn't support loopback, so we use DirectShow directly
        console.log('Using DirectShow capture (works with Stereo Mix or VB-Audio Cable)');
        const ffmpegPath = await this.findFFmpeg();
        if (!ffmpegPath) {
            throw new Error('FFmpeg not found. Please install FFmpeg and add it to PATH, or place ffmpeg.exe in the project root.');
        }
        await this.startDirectShowCapture(ffmpegPath);
    }

    /**
     * Windows: Use Python WASAPI capture (no compilation needed!)
     */
    private async startWASAPIPythonCapture(): Promise<void> {
        this.wasapiCapturePython = new WASAPICapturePython({
            sampleRate: this.options.sampleRate,
            channels: this.options.channels,
            onData: (chunk: Buffer) => {
                if (this.isCapturing) {
                    this.options.onData?.(chunk);
                }
            },
            onError: (error: Error) => {
                this.options.onError?.(error);
            },
        });

        this.isCapturing = true;
        await this.wasapiCapturePython.start();
        console.log('WASAPI Python capture started successfully');
    }

    /**
     * Windows: Use native WASAPI capture (no FFmpeg needed, no configuration needed)
     */
    private async startWASAPINativeCapture(): Promise<void> {
        this.wasapiCapture = new WASAPICapture({
            sampleRate: this.options.sampleRate,
            channels: this.options.channels,
            onData: (chunk: Buffer) => {
                if (this.isCapturing) {
                    this.options.onData?.(chunk);
                }
            },
            onError: (error: Error) => {
                this.options.onError?.(error);
            },
        });

        this.isCapturing = true;
        await this.wasapiCapture.start();
        console.log('WASAPI native capture started successfully');
    }

    /**
     * Windows: Use DirectShow for loopback capture (Stereo Mix, VB-Audio Cable, etc.)
     * Note: WASAPI is not yet implemented in FFmpeg (see https://fftrac-bg.ffmpeg.org/ticket/9408)
     * DirectShow requires a loopback device like "Stereo Mix" or "VB-Audio Cable"
     */
    private async startDirectShowCapture(ffmpegPath: string): Promise<void> {
        // DirectShow loopback device name (usually "Stereo Mix", "VB-Audio Cable", or "What U Hear")
        // Priority: VB-Audio Cable > Stereo Mix > Other loopback devices
        // We'll try to find it automatically or use default
        const deviceName = await this.findDirectShowLoopbackDevice(ffmpegPath);

        // Create temp file for output
        this.tempFile = path.join(os.tmpdir(), `ultra-audio-${Date.now()}.${this.options.format === 'wav' ? 'wav' : 'raw'}`);

        // FFmpeg command for DirectShow loopback capture
        // DirectShow ALWAYS requires the format: audio=device_name or audio=@alternative_name
        // The audio= prefix is mandatory for audio devices
        // NOTE: When using spawn() with shell: false, we do NOT include quotes around the device name
        // because the arguments are passed directly to the executable without shell interpretation.
        // Including quotes would make them part of the literal device name, causing "device not found" errors.
        const deviceInput = `audio=${deviceName}`;
        
        const args = [
            '-f', 'dshow',                     // Input format: DirectShow
            '-i', deviceInput,                 // Input device (loopback)
            '-ar', (this.options.sampleRate ?? 16000).toString(),  // Sample rate
            '-ac', (this.options.channels ?? 1).toString(),    // Channels
            '-f', this.options.format === 'wav' ? 'wav' : 's16le',  // Output format
            '-',                                // Output to stdout
        ];

        console.log('Starting FFmpeg with command:', ffmpegPath);
        console.log('FFmpeg args:', args.join(' '));
        console.log('Device input:', deviceInput);
        console.log('Full command:', `${ffmpegPath} ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`);
        console.log('[SystemAudioCapture] Setting isCapturing = true BEFORE starting FFmpeg process');

        // Set isCapturing BEFORE starting the process to ensure all chunks are processed
        this.isCapturing = true;
        console.log('[SystemAudioCapture] isCapturing is now:', this.isCapturing);

        // Don't use shell - pass arguments directly
        this.process = spawn(ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
        });
        
        // Log process start
        console.log(`FFmpeg process started (PID: ${this.process.pid}), isCapturing: ${this.isCapturing}`);

        // Handle stdout (audio data)
        let chunkCount = 0;
        let totalBytes = 0;
        let lastLogTime = Date.now();
        
        this.process.stdout?.on('data', (chunk: Buffer) => {
            if (this.isCapturing) {
                chunkCount++;
                totalBytes += chunk.length;
                const now = Date.now();
                
                // Calculate audio level from chunk for debugging
                let maxAmplitude = 0;
                let nonZeroSamples = 0;
                let sumSquared = 0;
                if (chunk.length >= 2) {
                    for (let i = 0; i < chunk.length - 1; i += 2) {
                        const sample = chunk[i] | (chunk[i + 1] << 8);
                        const signedSample = sample > 32767 ? sample - 65536 : sample;
                        const amplitude = Math.abs(signedSample);
                        if (amplitude > 0) nonZeroSamples++;
                        maxAmplitude = Math.max(maxAmplitude, amplitude);
                        sumSquared += signedSample * signedSample;
                    }
                }
                const rms = chunk.length >= 2 ? Math.sqrt(sumSquared / Math.floor(chunk.length / 2)) : 0;
                
                // For very low signals, use a more sensitive calculation
                let level = 0;
                if (maxAmplitude > 0) {
                    if (maxAmplitude < 100) {
                        // Very quiet signal - use logarithmic scale for better visibility
                        level = Math.max(1, Math.round((maxAmplitude / 100) * 10));
                    } else {
                        // Normal signal - use standard calculation
                        level = Math.round((Math.max(maxAmplitude, rms * 2) / 32767) * 100);
                    }
                }
                
                // Log first chunk and every 100 chunks or every 5 seconds
                if (chunkCount === 1 || chunkCount % 100 === 0 || (now - lastLogTime) > 5000) {
                    const warning = maxAmplitude < 10 ? ' (VERY QUIET - check Stereo Mix volume!)' : '';
                    console.log(`[SystemAudioCapture] Chunk #${chunkCount}: ${chunk.length} bytes, total: ${totalBytes} bytes, maxAmplitude: ${maxAmplitude}, RMS: ${rms.toFixed(2)}, level: ${level}%, nonZero: ${nonZeroSamples}/${Math.floor(chunk.length/2)}${warning}`);
                    if (maxAmplitude < 10 && chunkCount % 100 === 0) {
                        console.warn(`[SystemAudioCapture] WARNING: Audio level is very low (maxAmplitude: ${maxAmplitude}). Please check:`);
                        console.warn(`  1. Is audio playing on your system?`);
                        console.warn(`  2. Stereo Mix volume level (should be 100%)`);
                        console.warn(`  3. System volume is not muted`);
                    }
                    lastLogTime = now;
                }
                
                this.options.onData?.(chunk);
            } else {
                console.warn(`[SystemAudioCapture] Received chunk but isCapturing is false`);
            }
        });

        // Collect stderr messages for better error reporting
        let stderrBuffer = '';
        
        // Handle stderr (FFmpeg logs)
        this.process.stderr?.on('data', (data: Buffer) => {
            // FFmpeg outputs everything to stderr, including errors
            const message = data.toString();
            stderrBuffer += message;
            
            // Log all stderr for debugging
            console.log('FFmpeg stderr:', message);
            
            // Check for common errors
            if (message.includes('error') || message.includes('Error') || 
                message.includes('Could not') || message.includes('No such') ||
                message.includes('Device not found') || message.includes('Cannot')) {
                console.error('FFmpeg error detected:', message);
            }
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
            this.isCapturing = false;
            
            if (code !== 0 && code !== null) {
                // Convert Windows exit code to signed integer for better error messages
                const signedCode = code > 2147483647 ? code - 4294967296 : code;
                
                // Build detailed error message
                let errorMessage = `FFmpeg exited with code ${code} (signed: ${signedCode})`;
                
                // Add signal if present
                if (signal) {
                    errorMessage += `, signal: ${signal}`;
                }
                
                // Add stderr output if available
                if (stderrBuffer) {
                    errorMessage += `\n\nFFmpeg output:\n${stderrBuffer}`;
                    
                    // Provide helpful suggestions based on error content
                    if (stderrBuffer.includes('Could not find DirectShow device') || 
                        stderrBuffer.includes('No such device') ||
                        stderrBuffer.includes('Device not found')) {
                        errorMessage += '\n\nSugestao: Verifique se "Stereo Mix" esta ativado nas configuracoes de audio do Windows.';
                        errorMessage += '\nConfiguracoes > Sistema > Som > Configuracoes de som > Gravação';
                    } else if (stderrBuffer.includes('Permission denied') || 
                               stderrBuffer.includes('Access denied')) {
                        errorMessage += '\n\nSugestao: Verifique as permissoes de audio do Windows.';
                    } else if (stderrBuffer.includes('Device is busy') || 
                              stderrBuffer.includes('already in use')) {
                        errorMessage += '\n\nSugestao: O dispositivo de audio pode estar em uso por outro aplicativo.';
                    }
                }
                
                console.error('FFmpeg exit error:', errorMessage);
                this.options.onError?.(new Error(errorMessage));
            } else {
                console.log('FFmpeg exited successfully');
            }
        });

        this.process.on('error', (error) => {
            this.options.onError?.(error);
            this.isCapturing = false;
        });
    }

    /**
     * macOS: Use ffmpeg with CoreAudio
     */
    private async startMacOSCapture(): Promise<void> {
        const ffmpegPath = await this.findFFmpeg();
        if (!ffmpegPath) {
            throw new Error('FFmpeg not found. Please install FFmpeg: brew install ffmpeg');
        }

        // macOS uses CoreAudio, device name is usually "BlackHole" or similar
        // For now, we'll use the default device
        const args = [
            '-f', 'avfoundation',              // Input format: AVFoundation (macOS)
            '-i', ':0',                        // Capture audio from default device
            '-ar', (this.options.sampleRate ?? 16000).toString(),
            '-ac', (this.options.channels ?? 1).toString(),
            '-f', this.options.format === 'wav' ? 'wav' : 's16le',
            '-',
        ];

        this.process = spawn(ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.process.stdout?.on('data', (chunk: Buffer) => {
            if (this.isCapturing) {
                this.options.onData?.(chunk);
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString();
            if (message.includes('error') || message.includes('Error')) {
                console.error('FFmpeg error:', message);
            }
        });

        this.process.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                this.options.onError?.(new Error(`FFmpeg exited with code ${code}`));
            }
            this.isCapturing = false;
        });

        this.process.on('error', (error) => {
            this.options.onError?.(error);
            this.isCapturing = false;
        });
    }

    /**
     * Linux: Use ffmpeg with PulseAudio
     */
    private async startLinuxCapture(): Promise<void> {
        const ffmpegPath = await this.findFFmpeg();
        if (!ffmpegPath) {
            throw new Error('FFmpeg not found. Please install FFmpeg: sudo apt install ffmpeg');
        }

        // Linux uses PulseAudio, device name is usually "monitor" or similar
        const args = [
            '-f', 'pulse',                     // Input format: PulseAudio
            '-i', 'default',                   // Input device (default monitor)
            '-ar', (this.options.sampleRate ?? 16000).toString(),
            '-ac', (this.options.channels ?? 1).toString(),
            '-f', this.options.format === 'wav' ? 'wav' : 's16le',
            '-',
        ];

        this.process = spawn(ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.process.stdout?.on('data', (chunk: Buffer) => {
            if (this.isCapturing) {
                this.options.onData?.(chunk);
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString();
            if (message.includes('error') || message.includes('Error')) {
                console.error('FFmpeg error:', message);
            }
        });

        this.process.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                this.options.onError?.(new Error(`FFmpeg exited with code ${code}`));
            }
            this.isCapturing = false;
        });

        this.process.on('error', (error) => {
            this.options.onError?.(error);
            this.isCapturing = false;
        });
    }

    /**
     * Find FFmpeg executable (public static method for use in listDevices)
     */
    static async findFFmpeg(): Promise<string | null> {
        return new Promise((resolve) => {
            // Try common locations
            const possiblePaths = [
                'ffmpeg',  // In PATH
                path.join(process.cwd(), 'ffmpeg.exe'),  // Windows local
                path.join(process.cwd(), 'ffmpeg'),      // Unix local
                'C:\\ffmpeg\\bin\\ffmpeg.exe',          // Windows common install
            ];

            let checked = 0;
            for (const testPath of possiblePaths) {
                const testProcess = spawn(testPath, ['-version'], {
                    stdio: 'ignore',
                    shell: false,
                });

                testProcess.on('error', () => {
                    checked++;
                    if (checked === possiblePaths.length) {
                        resolve(null);
                    }
                });

                testProcess.on('exit', (code) => {
                    if (code === 0) {
                        resolve(testPath);
                    } else {
                        checked++;
                        if (checked === possiblePaths.length) {
                            resolve(null);
                        }
                    }
                });
            }
        });
    }

    /**
     * List all available DirectShow audio devices (static method)
     */
    static async listDirectShowDevices(ffmpegPath: string): Promise<AudioDevice[]> {
        return new Promise((resolve, reject) => {
            const listProcess = spawn(ffmpegPath, [
                '-f', 'dshow',
                '-list_devices', 'true',
                '-i', 'dummy'
            ], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
            });

            let output = '';
            listProcess.stderr?.on('data', (data: Buffer) => {
                output += data.toString('utf8');
            });

            listProcess.on('exit', (code) => {
                console.log('FFmpeg list devices exit code:', code);
                console.log('FFmpeg output length:', output.length);
                console.log('FFmpeg output (first 2000 chars):', output.substring(0, 2000));
                
                // FFmpeg returns non-zero exit code even on success for list_devices
                // (because "dummy" input doesn't exist, but that's expected)
                // So we check if we got any output instead
                if (!output || output.length === 0) {
                    console.error('No output from FFmpeg');
                    reject(new Error('No output from FFmpeg. Make sure FFmpeg is installed and DirectShow is available.'));
                    return;
                }
                
                // Check if we have any audio devices in the output
                if (!output.includes('DirectShow audio devices') && !output.includes('(audio)')) {
                    console.warn('No audio devices section found in FFmpeg output');
                    // Still try to parse - maybe the format is different
                }

                const devices: AudioDevice[] = [];
                const lines = output.split('\n');
                
                console.log('Total lines in output:', lines.length);
                
                // Log all lines that contain "audio" or "dshow" for debugging
                console.log('Lines with "audio" or "dshow":');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes('audio') || line.includes('dshow')) {
                        console.log(`  Line ${idx}: ${line.substring(0, 100)}`);
                    }
                });
                
                let currentSection: 'video' | 'audio' | null = null;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Detect section - FFmpeg may not have explicit section headers
                    // So we detect by looking for device patterns
                    if (line.includes('DirectShow video devices') || 
                        (line.includes('dshow') && line.includes('(video)'))) {
                        currentSection = 'video';
                        console.log('Found video section at line', i, ':', line.substring(0, 80));
                        continue;
                    } else if (line.includes('DirectShow audio devices') || 
                               (line.includes('dshow') && line.includes('(audio)'))) {
                        currentSection = 'audio';
                        console.log('Found audio section at line', i, ':', line.substring(0, 80));
                        // Don't continue - this line might also contain a device
                    }
                    
                    // If we haven't found a section yet but see an audio device, assume we're in audio section
                    if (currentSection === null && line.includes('(audio)')) {
                        currentSection = 'audio';
                        console.log('Auto-detected audio section at line', i, ':', line.substring(0, 80));
                    }
                    
                    // Parse device line - look for audio devices directly
                    // Format: [dshow @ ...] "Device Name" (audio)
                    if (line.includes('(audio)') && line.includes('"')) {
                        // Try multiple regex patterns to match device name
                        // Pattern 1: [dshow @ ...] "Device Name" (audio)
                        let match = line.match(/\[dshow @[^\]]+\]\s+"([^"]+)"\s*\(audio\)/);
                        
                        // Pattern 2: More flexible - any text in quotes before (audio)
                        if (!match) {
                            match = line.match(/"([^"]+)"\s*\(audio\)/);
                        }
                        
                        if (match) {
                            const deviceName = match[1].trim();
                            // Skip if this looks like an alternative name line
                            if (deviceName.startsWith('@device_')) {
                                continue;
                            }
                            
                            console.log('Found audio device at line', i, ':', deviceName);
                            console.log('  Full line:', line.substring(0, 150));
                            
                            // Try to get alternative name (if available on next line)
                            let altName: string | undefined;
                            if (i < lines.length - 1) {
                                const nextLine = lines[i + 1];
                                // Look for "Alternative name" or "@device_" pattern
                                if (nextLine.includes('Alternative name')) {
                                    const altMatch = nextLine.match(/Alternative name\s+"(@device_[^"]+)"/);
                                    if (altMatch) {
                                        altName = altMatch[1];
                                        console.log('  Alternative name:', altName);
                                    } else {
                                        // Try without quotes
                                        const altMatch2 = nextLine.match(/Alternative name\s+(@device_[^\s"]+)/);
                                        if (altMatch2) {
                                            altName = altMatch2[1];
                                            console.log('  Alternative name (no quotes):', altName);
                                        }
                                    }
                                } else if (nextLine.includes('@device_')) {
                                    // Alternative name might be on the same line or next line
                                    const altMatch = nextLine.match(/"(@device_[^"]+)"/);
                                    if (altMatch) {
                                        altName = altMatch[1];
                                        console.log('  Alternative name (direct):', altName);
                                    } else {
                                        // Try without quotes
                                        const altMatch2 = nextLine.match(/(@device_[^\s"]+)/);
                                        if (altMatch2) {
                                            altName = altMatch2[1];
                                            console.log('  Alternative name (no quotes, direct):', altName);
                                        }
                                    }
                                }
                            }
                            
                            // Determine device type
                            const nameLower = deviceName.toLowerCase();
                            let deviceType: 'loopback' | 'input' | 'output' = 'input';
                            
                            // Check for loopback keywords
                            const loopbackKeywords = ['mix', 'mistura', 'cable', 'loopback', 'monitor', 'what u hear'];
                            const inputKeywords = ['microphone', 'microfone', 'mic ', 'capacete', 'headset', 'headphone'];
                            
                            if (loopbackKeywords.some(kw => nameLower.includes(kw))) {
                                deviceType = 'loopback';
                                console.log('  -> Type: loopback');
                            } else if (inputKeywords.some(kw => nameLower.includes(kw))) {
                                deviceType = 'input';
                                console.log('  -> Type: input');
                            } else {
                                console.log('  -> Type: input (default)');
                            }
                            
                            devices.push({
                                name: deviceName,
                                altName,
                                type: deviceType,
                            });
                            console.log('  -> Added device to list');
                        } else {
                            // Log if we found a line with (audio) but couldn't parse it
                            if (line.includes('(audio)')) {
                                console.log('  -> Could not parse audio device line:', line.substring(0, 100));
                            }
                        }
                    }
                }
                
                console.log('Total devices found:', devices.length);
                resolve(devices);
            });

            listProcess.on('error', reject);
        });
    }

    /**
     * Find FFmpeg executable (instance method)
     */
    private async findFFmpeg(): Promise<string | null> {
        return new Promise((resolve) => {
            // Try common locations
            const possiblePaths = [
                'ffmpeg',  // In PATH
                path.join(process.cwd(), 'ffmpeg.exe'),  // Windows local
                path.join(process.cwd(), 'ffmpeg'),      // Unix local
                'C:\\ffmpeg\\bin\\ffmpeg.exe',          // Windows common install
            ];

            const tryPath = (index: number) => {
                if (index >= possiblePaths.length) {
                    resolve(null);
                    return;
                }

                const testPath = possiblePaths[index];
                const testProcess = spawn(testPath, ['-version'], { stdio: 'ignore' });
                
                testProcess.on('exit', (code) => {
                    if (code === 0) {
                        resolve(testPath);
                    } else {
                        tryPath(index + 1);
                    }
                });

                testProcess.on('error', () => {
                    tryPath(index + 1);
                });
            };

            tryPath(0);
        });
    }

    /**
     * Find DirectShow loopback device on Windows
     */
    private async findDirectShowLoopbackDevice(ffmpegPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log('Listing DirectShow audio devices...');
            
            // List DirectShow devices
            const listProcess = spawn(ffmpegPath, ['-f', 'dshow', '-list_devices', 'true', '-i', 'dummy'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let output = '';
            listProcess.stderr?.on('data', (data: Buffer) => {
                // Use UTF-8 encoding to properly handle special characters
                output += data.toString('utf8');
            });

            listProcess.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`FFmpeg list devices exited with code ${code}`);
                    console.error('Output:', output);
                    reject(new Error(
                        `Falha ao listar dispositivos DirectShow. ` +
                        `FFmpeg retornou codigo ${code}. ` +
                        `Verifique se o FFmpeg esta instalado corretamente.`
                    ));
                    return;
                }
                
                console.log('DirectShow devices output:', output);
                
                // Parse output to find loopback device
                // DirectShow devices are listed with "(audio)" suffix
                // Look for common loopback device names in multiple languages
                const lines = output.split('\n');
                
                // High-priority keywords (must match these first)
                // Priority order: VB-Audio Cable (most reliable) > Stereo Mix > Other loopback devices
                const highPriorityKeywords = [
                    // VB-Audio Cable (highest priority - most reliable)
                    'cable', 'vb-audio', 'vb audio', 'vb-audio cable',
                    // English
                    'stereo mix', 'what u hear', 'wave out mix',
                    // Portuguese
                    'mistura estéreo', 'mistura estereo', 'mistura stereo', 'mistura',
                    // Spanish
                    'mezcla estéreo', 'mezcla stereo', 'mezcla',
                    // French
                    'mixage stéréo', 'mixage stereo', 'mixage',
                    // German
                    'stereo-mix',
                    // Generic but specific
                    'loopback', 'monitor'
                ];
                
                // Low-priority keywords (only if high-priority not found)
                const lowPriorityKeywords = ['stereo', 'mix'];
                
                // Keywords that indicate input devices (exclude these)
                const inputDeviceKeywords = [
                    'microphone', 'microfone', 'mic ', 'capacete', 'headset', 
                    'headphone', 'fone', 'input', 'entrada'
                ];
                
                // First pass: collect all devices with their alternative names
                const devices: Array<{ name: string; altName?: string }> = [];
                let currentDevice: { name?: string; altName?: string } | null = null;
                
                for (const line of lines) {
                    // Check if this is a device name line
                    if (line.includes('(audio)') && line.includes('"')) {
                        // Save previous device if exists
                        if (currentDevice && currentDevice.name) {
                            devices.push({
                                name: currentDevice.name,
                                altName: currentDevice.altName
                            });
                        }
                        
                        // Extract device name (usually in quotes)
                        const match = line.match(/"([^"]+)"/);
                        if (match && match[1]) {
                            const deviceName = match[1].trim();
                            currentDevice = {
                                name: deviceName,
                                altName: undefined
                            };
                            console.log(`Found audio device: "${deviceName}"`);
                        }
                    }
                    
                    // Check if this is an alternative name line
                    if (line.includes('Alternative name') && currentDevice && currentDevice.name) {
                        const altMatch = line.match(/Alternative name "([^"]+)"/);
                        if (altMatch && altMatch[1]) {
                            currentDevice.altName = altMatch[1].trim();
                            console.log(`  -> Alternative name: "${currentDevice.altName}"`);
                        }
                    }
                }
                
                // Save last device
                if (currentDevice && currentDevice.name) {
                    devices.push({
                        name: currentDevice.name,
                        altName: currentDevice.altName
                    });
                }
                
                // Second pass: find loopback device
                let highPriorityMatch: { name: string; altName?: string } | null = null;
                let lowPriorityMatch: { name: string; altName?: string } | null = null;
                
                for (const device of devices) {
                    const lowerDeviceName = device.name.toLowerCase();
                    
                    // Skip input devices
                    let isInputDevice = false;
                    for (const inputKeyword of inputDeviceKeywords) {
                        if (lowerDeviceName.includes(inputKeyword)) {
                            isInputDevice = true;
                            console.log(`  -> Skipping "${device.name}" (input device: contains "${inputKeyword}")`);
                            break;
                        }
                    }
                    
                    if (!isInputDevice) {
                        // Check high-priority keywords first
                        for (const keyword of highPriorityKeywords) {
                            if (lowerDeviceName.includes(keyword.toLowerCase())) {
                                highPriorityMatch = device;
                                console.log(`  -> High-priority match: "${device.name}" (keyword: "${keyword}")`);
                                if (device.altName) {
                                    console.log(`     Alternative name: "${device.altName}"`);
                                }
                                break;
                            }
                        }
                        
                        // If no high-priority match, check low-priority
                        if (!highPriorityMatch) {
                            for (const keyword of lowPriorityKeywords) {
                                if (lowerDeviceName.includes(keyword.toLowerCase())) {
                                    if (!lowPriorityMatch) {
                                        lowPriorityMatch = device;
                                        console.log(`  -> Low-priority match: "${device.name}" (keyword: "${keyword}")`);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Prefer high-priority match
                if (highPriorityMatch) {
                    // Use alternative name if available to avoid encoding issues with special characters
                    // The alternative name is a stable identifier that works regardless of encoding
                    const deviceToUse = highPriorityMatch.altName || highPriorityMatch.name;
                    console.log(`Selected loopback device (high-priority): "${highPriorityMatch.name}"`);
                    if (highPriorityMatch.altName) {
                        console.log(`Using alternative name: "${highPriorityMatch.altName}" (to avoid encoding issues)`);
                    }
                    resolve(deviceToUse);
                    return;
                }
                
                // Fallback to low-priority match (but warn)
                if (lowPriorityMatch) {
                    const deviceToUse = lowPriorityMatch.altName || lowPriorityMatch.name;
                    console.warn(`Selected loopback device (low-priority, may not work): "${lowPriorityMatch.name}"`);
                    if (lowPriorityMatch.altName) {
                        console.log(`Using alternative name: "${lowPriorityMatch.altName}"`);
                    }
                    console.warn('Consider using a device with "Stereo Mix" or "Mistura estéreo" in the name');
                    resolve(deviceToUse);
                    return;
                }
                
                // If no loopback device found, DO NOT use microphone as fallback
                // Microphones cannot capture system audio
                console.error('========================================');
                console.error('ERRO: Nenhum dispositivo de loopback encontrado!');
                console.error('========================================');
                const deviceNames = devices.map(d => d.name);
                console.error('Dispositivos encontrados:', deviceNames.join(', ') || 'nenhum');
                console.error('');
                console.error('Para capturar audio do sistema, voce precisa:');
                console.error('1. Ativar "Stereo Mix" nas configuracoes do Windows:');
                console.error('   Configuracoes > Sistema > Som > Configuracoes de som > Gravação');
                console.error('   Clique com botao direito > Mostrar dispositivos desabilitados');
                console.error('   Ative "Stereo Mix"');
                console.error('');
                console.error('OU');
                console.error('');
                console.error('2. Instalar VB-Audio Cable (gratuito):');
                console.error('   https://vb-audio.com/Cable/');
                console.error('   Configure "CABLE Output" como saida de audio');
                console.error('   Configure o sistema para capturar de "CABLE Input"');
                console.error('========================================');
                
                // Throw error instead of using microphone
                reject(new Error(
                    'Nenhum dispositivo de loopback encontrado. ' +
                    'Por favor, ative "Stereo Mix" nas configuracoes de audio do Windows ou instale VB-Audio Cable. ' +
                    'Dispositivos encontrados: ' + (devices.map(d => d.name).join(', ') || 'nenhum')
                ));
            });

            listProcess.on('error', (error) => {
                console.error('Failed to list DirectShow devices:', error);
                reject(new Error(
                    `Falha ao executar FFmpeg para listar dispositivos: ${error.message}. ` +
                    `Verifique se o FFmpeg esta instalado e no PATH.`
                ));
            });
        });
    }
}

