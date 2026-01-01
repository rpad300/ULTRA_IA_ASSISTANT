import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Square, Save, RefreshCw, Loader2, CheckCircle2, AlertCircle, AudioWaveform, UploadCloud, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { type Contact, audioServiceApi } from '@/api/client';
import { useMeetingStore } from '@/store/meetingStore';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2, Volume2, Mic2, Speaker } from 'lucide-react';
import { cn } from "@/lib/utils";
// Native Audio State
interface VoiceEnrollmentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact;
}

export const VoiceEnrollmentDialog: React.FC<VoiceEnrollmentDialogProps> = ({ isOpen, onClose, contact }) => {
    // Local Type Definition if not imported
    type EnrollmentStatus = 'idle' | 'recording' | 'recorded' | 'success' | 'error';

    const [isRecording, setIsRecording] = useState(false);
    const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [transcript, setTranscript] = useState<string>("");

    // Native Audio State
    const { audioServiceStatus, getAudioServiceStatus } = useMeetingStore();
    // Use store status for availability, or local state if we want to override/check manually? 
    // The store is more reliable for global status.
    const isNativeAvailable = audioServiceStatus?.infrastructure.backend.status === 'connected';
    const [nativeFilePath, setNativeFilePath] = useState<string | null>(null);
    const [isNativeRecording, setIsNativeRecording] = useState(false);
    const [transcriptionService, setTranscriptionService] = useState<'assemblyai' | 'whisper'>('assemblyai');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Visualizer Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Speech Ref for "Web" mode fallback
    const recognitionRef = useRef<any>(null);
    const recordingStatusRef = useRef<EnrollmentStatus>('idle');

    const timerRef = useRef<number | null>(null);

    // Web Socket for Native Transcription
    const nativeWsRef = useRef<WebSocket | null>(null);
    const committedTranscriptRef = useRef<string>(""); // Track committed text to avoid duplication
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showSettings, setShowSettings] = useState(false);

    // Store access for device config
    const {
        audioServiceDevices,
        getAudioServiceDevices,
        setAudioServiceDevice,
        audioGain,
        setAudioGain,
        selectedMicrophoneDevice,
        selectedSystemAudioDevice
    } = useMeetingStore();

    // Initial check for status
    useEffect(() => {
        getAudioServiceStatus().catch(console.error);
    }, []);
    useEffect(() => {
        if (isOpen) {
            getAudioServiceDevices().catch(console.error);
        }
    }, [isOpen, getAudioServiceDevices]);

    const [profileStatus, setProfileStatus] = useState<{ hasProfile: boolean } | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const checkStatus = React.useCallback(async () => {
        if (!contact.id) return;
        setIsLoadingStatus(true);
        try {
            const res = await fetch(`/api/voice-profiles/${contact.id}/status`);
            if (res.ok) {
                const data = await res.json();
                setProfileStatus({ hasProfile: data.has_profile });
            }
        } catch (e) {
            console.error("Failed to check status", e);
        } finally {
            setIsLoadingStatus(false);
        }
    }, [contact.id]);

    useEffect(() => {
        if (isOpen) {
            checkStatus();
            // Refresh service status when opening
            getAudioServiceStatus().catch(() => { });
        }
    }, [isOpen, checkStatus]);

    useEffect(() => {
        if (!isOpen) {
            stopRecording();
            setEnrollmentStatus('idle');
            setRecordingBlob(null);
            setRecordingDuration(0);
            setErrorMessage(null);
            setFiles([]);
            setTranscript("");
            setProfileStatus(null);
        }
    }, [isOpen]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            stopRecording();
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const setupVisualizer = (stream: MediaStream) => {
        if (!canvasRef.current) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;
        // Check if stream is active
        if (stream.getAudioTracks().length === 0) return;

        analyserRef.current = audioContext.createAnalyser();
        // Use a new source for the visualizer to avoid interference with recorder if possible, 
        // but typically sharing the stream is fine.
        try {
            sourceRef.current = audioContext.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);
        } catch (err) {
            console.error("Error creating media stream source", err);
            return;
        }

        analyserRef.current.fftSize = 256;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');

        if (!canvasCtx) return;

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);

            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);

            // Clear with transparency
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 1.5; // Scale down slightly

                // Gradient color - Evolutive Style
                // Low freq = Blue/Indigo, High freq = Purple/Pink
                const r = 50 + (i * 2);
                const g = 50;
                const b = 255 - (i);

                canvasCtx.fillStyle = `rgba(${r},${g},${b}, 0.8)`;

                // Rounded tops
                canvasCtx.beginPath();
                canvasCtx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
                canvasCtx.fill();

                x += barWidth + 2; // More spacing
            }
        };

        draw();
    };

    // Refactored Speech Recognition Setup
    const setupSpeechRecognition = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                console.log("[VoiceEnrollment] Speech recognition started");
            };

            recognition.onerror = (event: any) => {
                if (event.error === 'no-speech') {
                    // Ignore, allows auto-restart/timeout handling
                    return;
                }
                console.error("[VoiceEnrollment] Speech recognition error", event.error);
            };

            recognition.onend = () => {
                console.log("[VoiceEnrollment] Speech recognition ended");
                // Auto-restart if we are still recording (check ref)
                if (recordingStatusRef.current === 'recording') {
                    console.log("[VoiceEnrollment] Restarting speech recognition...");
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("[VoiceEnrollment] Failed to restart recognition:", e);
                    }
                }
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript || interimTranscript) {
                    setTranscript(prev => prev + finalTranscript + interimTranscript);
                }
            };

            recognition.start();
        }
    };

    // Shared Browser Capture (Visualizer + Script)
    const startBrowserCapture = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setupVisualizer(stream);
        setupSpeechRecognition();
        return stream;
    };

    const startRecording = async () => {
        // Mode Selection: Native vs Web
        if (isNativeAvailable) {
            await startNativeRecording();
        } else {
            await startWebRecording();
        }
    };

    const startNativeRecording = async () => {
        try {
            setErrorMessage(null);
            setEnrollmentStatus('recording');
            recordingStatusRef.current = 'recording'; // Sync ref
            setRecordingDuration(0);
            setIsNativeRecording(true);
            setNativeFilePath(null);
            setTranscript("");
            committedTranscriptRef.current = "";

            // Start Local Feedback (Visualizer + Transcription)
            // This runs in parallel with native recording
            await startBrowserCapture().catch(e => console.warn("Could not start local feedback:", e));

            // Start Timer
            timerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            // Start Native Backend Recording
            // The backend/C# service will return the session ID it created (or we could pass one)
            const res = await audioServiceApi.startTestRecording(
                undefined,
                selectedMicrophoneDevice, // Pass selected microphone
                selectedSystemAudioDevice, // Pass selected system audio
                undefined,
                transcriptionService
            );

            if (res.success && res.path) {
                setNativeFilePath(res.path);

                // Connect to Native WS for Transcription
                // Use the session ID returned by the service, or fallback to 'TEST_SESSION' if missing
                const sessionId = res.sessionId || 'TEST_SESSION';
                console.log(`[VoiceEnrollment] Connecting to Native/Backend WS with Session ID: ${sessionId}`);

                try {
                    // Connect to universal transcription endpoint in 'native' mode to receive C# events
                    const wsUrl = `ws://localhost:8000/api/ws/transcription?session_id=${sessionId}&mode=native`;
                    const ws = new WebSocket(wsUrl);
                    nativeWsRef.current = ws;

                    ws.onopen = () => {
                        console.log("[VoiceEnrollment] Connected to Transcription WS (Native Mode)");
                    };

                    ws.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);

                            // Handling AssemblyAI / Streaming Partial Results to avoid duplication
                            if (data.message_type === 'FinalTranscript') {
                                // Commit the final text
                                committedTranscriptRef.current += (committedTranscriptRef.current ? " " : "") + data.text;
                                setTranscript(committedTranscriptRef.current);
                            } else if (data.message_type === 'PartialTranscript') {
                                // Show committed + partial
                                setTranscript(committedTranscriptRef.current + (committedTranscriptRef.current ? " " : "") + data.text);
                            } else if (data.type === 'transcript' && data.text) {
                                // Fallback for simple/native backend (e.g. Whisper default) or if keys are stripped
                                // Check if we already have this text to avoid duplication if back-to-back
                                const current = committedTranscriptRef.current;
                                if (!current.endsWith(data.text)) {
                                    // Simple append if not sophisticated
                                    // But for robustness, let's treat it as final if we don't know better
                                    committedTranscriptRef.current += (committedTranscriptRef.current ? "\n" : "") + data.text;
                                    setTranscript(committedTranscriptRef.current);
                                }
                            }
                        } catch (e) {
                            console.error("[VoiceEnrollment] Failed to parse WS message", e);
                        }
                    };

                    ws.onerror = (e) => {
                        console.error("[VoiceEnrollment] Native WS Error", e);
                    };

                } catch (wsErr) {
                    console.error("[VoiceEnrollment] Failed to clear native WS", wsErr);
                }

            } else {
                throw new Error(res.message || "Failed to start native recording");
            }

        } catch (error: any) {
            console.error('Error starting native recording:', error);
            setErrorMessage('Could not access Ultra Audio Engine. ' + error.message);
            stopRecording();
        }
    };

    const startWebRecording = async () => {
        try {
            setErrorMessage(null);
            setTranscript("");

            // Get stream and setup Viz/Transcription
            const stream = await startBrowserCapture();

            // Robust mimeType selection
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";

            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                setRecordingBlob(blob);
                setEnrollmentStatus('recorded');
                recordingStatusRef.current = 'recorded';

                // Cleanup is handled by stopRecording shared logic or here?
                // stopRecording calls this onstop usually? No, stop() triggers onstop.
                // We shouldn't duplicate cleanup here if stopRecording does it.
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setEnrollmentStatus('recording');
            recordingStatusRef.current = 'recording';

            // Start timer
            setRecordingDuration(0);
            timerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error: any) {
            console.error('Error starting recording:', error);
            setErrorMessage('Could not access microphone. Please check permissions.');
            toast.error("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = async () => {
        // Sync Status Ref
        recordingStatusRef.current = 'idle';

        // 1. Stop Native Recording if active
        if (isNativeAvailable && isNativeRecording) {
            await stopNativeRecording();
            // Don't return, allow fall-through to cleanup local capture
        }

        // 2. Stop Web Recording (creates blob)
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }

        // 3. Shared Cleanup (Browsers Tracks & Scripts)
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        if (nativeWsRef.current) {
            nativeWsRef.current.close();
            nativeWsRef.current = null;
        }
    };

    const stopNativeRecording = async () => {
        try {
            await audioServiceApi.stopTestRecording();
            setIsNativeRecording(false);
            setEnrollmentStatus('recorded');

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        } catch (e) {
            console.error("Failed to stop native recording", e);
        }
    };



    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            setEnrollmentStatus('recorded');
        }
    };

    const handleSave = async () => {
        // Fix: Allow save if nativeFilePath is present (Native Mode) OR recordingBlob (Web Mode) OR files
        const hasRecording = recordingBlob !== null || (isNativeAvailable && nativeFilePath !== null);
        if ((!hasRecording && files.length === 0) || !contact.id) {
            console.warn("Save blocked: No recording/file or contact ID missing");
            return;
        }

        try {
            setIsProcessing(true);
            let apiResponse: Response | any; // Declare response outside the if/else

            // NATIVE MODE SAVE
            if (isNativeAvailable && nativeFilePath) {
                console.log(`[VoiceEnrollment] Submitting Native Recording: ${nativeFilePath}`);
                apiResponse = await audioServiceApi.enrollNative(contact.id, nativeFilePath, transcript);

                // audioServiceApi.enrollNative returns data directly, creates error on fail?
                // Let's assume it throws if fail, or returns object. 
                // It returns the JSON body.
                if (apiResponse.status !== 'success') {
                    throw new Error(apiResponse.message || "Native enrollment failed");
                }

            } else {
                // WEB MODE SAVE
                // Create FormData
                const formData = new FormData();

                if (recordingBlob) {
                    console.log(`[VoiceEnrollment] Preparing blob for upload. Size: ${recordingBlob.size} bytes, Type: ${recordingBlob.type}`);
                    // Picovoice recommends > 10 seconds of audio, ideally ~30s.
                    // We will send what we have. API expects 'files' list
                    // Convert blob to file
                    const file = new File([recordingBlob], "enrollment_recording.webm", { type: "audio/webm" });
                    formData.append('files', file);

                    if (transcript) {
                        formData.append('transcript', transcript);
                    }
                }

                if (files.length > 0) {
                    files.forEach((file) => {
                        formData.append('files', file);
                    });
                }

                // We need to fetch directly because client methods might not support file upload specific to this new endpoint easily
                // assuming a fetch helper exists or raw fetch
                const token = localStorage.getItem('auth_token'); // Retrieve token if needed

                apiResponse = await fetch(`/api/voice-profiles/enroll/${contact.id}`, {
                    method: 'POST',
                    headers: {
                        // 'Content-Type': 'multipart/form-data', // Do NOT set this manually, browser sets boundary
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: formData
                });

                if (!apiResponse.ok) {
                    const errorData = await apiResponse.json().catch(() => ({}));
                    throw new Error(errorData.detail || "Upload failed");
                }
            }

            // Handle response for both native and web modes
            const data = (apiResponse instanceof Response) ? await apiResponse.json() : apiResponse;

            setEnrollmentStatus('success');

            const durationMsg = data.audio_duration_ms
                ? ` (${(data.audio_duration_ms / 1000).toFixed(1)}s audio processed)`
                : "";

            toast.success(`Voice Profile Enrolled: Successfully created voice profile for ${contact.name}${durationMsg}`);

            checkStatus(); // Refresh status badge

            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (error: any) {
            console.error('Enrollment error:', error);
            // Extract detailed error message from backend if available
            const backendError = error.response?.data?.detail || error.message || 'Failed to save voice profile';
            setErrorMessage(backendError);
            setEnrollmentStatus('error');
            toast.error(backendError);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!contact.id || !confirm("Are you sure you want to delete this voice profile? This action cannot be undone.")) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/voice-profiles/${contact.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error("Failed to delete profile");

            toast.success("Voice Profile deleted.");
            setProfileStatus({ hasProfile: false });
            setEnrollmentStatus('idle');
            setFiles([]);
            setRecordingBlob(null);
            setTranscript("");

            checkStatus();
        } catch (e: any) {
            console.error("Delete failed", e);
            toast.error("Failed to delete voice profile");
        } finally {
            setIsDeleting(false);
        }
    };

    const resetRecording = () => {
        setRecordingBlob(null);
        setFiles([]);
        setTranscript("");
        setEnrollmentStatus('idle');
        setErrorMessage(null);
        setRecordingDuration(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mic className="h-5 w-5 text-indigo-500" />
                        Voice Enrollment
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Create a voice profile for <span className="text-zinc-100 font-medium">{contact.name}</span>.
                    </DialogDescription>

                    <div className="mt-2 flex items-center gap-2">
                        {isLoadingStatus ? (
                            <div className="h-5 w-24 bg-zinc-800 animate-pulse rounded" />
                        ) : profileStatus?.hasProfile ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/30 text-emerald-400 text-xs rounded border border-emerald-900/50">
                                <ShieldCheck className="h-3 w-3" />
                                <span>Voice Profile Active</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 text-zinc-500 text-xs rounded border border-zinc-700/50">
                                <ShieldAlert className="h-3 w-3" />
                                <span>Not Enrolled</span>
                            </div>
                        )}

                        {profileStatus?.hasProfile && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2 ml-auto"
                            >
                                <Trash2 className="h-3 w-3 mr-1.5" />
                                {isDeleting ? "Deleting..." : "Delete Profile"}
                            </Button>
                        )}


                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("ml-auto text-zinc-400 hover:text-white", showSettings && "bg-zinc-800 text-white")}
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            <Settings2 className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {/* Device Configuration Panel */}
                    {showSettings && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4 animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                                    <Mic2 className="h-3 w-3" /> Microphone
                                </label>
                                <Select
                                    value={selectedMicrophoneDevice ? String(selectedMicrophoneDevice) : undefined}
                                    onValueChange={(val) => setAudioServiceDevice(val)}
                                >
                                    <SelectTrigger className="h-8 text-xs bg-zinc-950 border-zinc-800">
                                        <SelectValue placeholder="Select Microphone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {audioServiceDevices?.microphones.map(d => (
                                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                                    <Speaker className="h-3 w-3" /> System Audio
                                </label>
                                <Select
                                    value={selectedSystemAudioDevice ? String(selectedSystemAudioDevice) : undefined}
                                    onValueChange={(val) => setAudioServiceDevice(val)}
                                >
                                    <SelectTrigger className="h-8 text-xs bg-zinc-950 border-zinc-800">
                                        <SelectValue placeholder="Select System Audio" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {audioServiceDevices?.speakers.map(d => (
                                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-zinc-800">
                                <label className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                                    <Volume2 className="h-3 w-3" /> Audio Gain: {audioGain.toFixed(1)}x
                                </label>
                                <Slider
                                    value={[audioGain]}
                                    min={0.1}
                                    max={5.0}
                                    step={0.1}
                                    onValueChange={(vals: number[]) => setAudioGain(vals[0])}
                                />
                            </div>

                            {/* Service Selection */}
                            <div className="space-y-3 pt-2 border-t border-zinc-800">
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Transcription Engine</label>
                                <Select value={transcriptionService} onValueChange={(val: any) => setTranscriptionService(val)}>
                                    <SelectTrigger className="w-full bg-zinc-900 border-zinc-700">
                                        <SelectValue placeholder="Select Service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="assemblyai">AssemblyAI (Cloud - High Accuracy)</SelectItem>
                                        <SelectItem value="whisper">Whisper (Local - Private)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                        <p className="text-sm text-zinc-400 mb-2">Please read the following text clearly:</p>
                        <p className="text-lg font-medium leading-relaxed italic text-zinc-200">
                            "Hello, my name is {contact.name}, and I am providing this voice sample to securely enroll in the Ultra AI Assistant's auditory identification system. By reading this passage, I am enabling the system to learn the unique spectral features of my voice, ensuring accurate and personalized speaker recognition during our future interactive sessions and professional meetings."
                        </p>
                    </div>

                    {/* Visualization Area */}
                    <div className="space-y-2">
                        <div className="relative h-48 bg-zinc-900 rounded-lg overflow-hidden flex flex-col items-center justify-center border border-zinc-800">
                            <canvas
                                ref={canvasRef}
                                width="450"
                                height="192"
                                className="absolute inset-0 w-full h-full opacity-80 pointer-events-none"
                            />

                            {/* Transcript Overlay - Scrollable Menu Fill */}
                            {transcript && enrollmentStatus === 'recording' && (
                                <ScrollArea className="absolute inset-4 z-20 h-[calc(100%-2rem)] pr-4">
                                    <p className="text-zinc-100 text-lg font-medium leading-relaxed drop-shadow-md whitespace-pre-wrap">
                                        {transcript}
                                    </p>
                                </ScrollArea>
                            )}

                            {enrollmentStatus === 'idle' && (
                                <div className="z-10 text-zinc-500 flex flex-col items-center gap-3">
                                    <AudioWaveform className="h-8 w-8" />

                                    {/* Connection Status / Native Badge */}
                                    {!audioServiceStatus && (
                                        <div className="text-xs text-zinc-500 animate-pulse">
                                            Checking audio engine...
                                        </div>
                                    )}

                                    {isNativeAvailable && (
                                        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 flex gap-2 items-center py-1">
                                                <AudioWaveform className="h-3 w-3" />
                                                Native Audio Engine Active
                                            </Badge>
                                        </div>
                                    )}

                                    <span className="text-sm mt-1">Ready to record</span>
                                </div>
                            )}

                            {enrollmentStatus === 'recorded' && (
                                <div className="z-10 text-emerald-500 flex flex-col items-center">
                                    <CheckCircle2 className="h-10 w-10 mb-2" />
                                    <span className="text-sm font-medium">Recording Complete</span>
                                    <span className="text-xs text-zinc-500 mt-1">{formatTime(recordingDuration)}</span>
                                </div>
                            )}

                            {enrollmentStatus === 'success' && (
                                <div className="z-10 text-indigo-500 flex flex-col items-center">
                                    <CheckCircle2 className="h-12 w-12 mb-2" />
                                    <span className="text-lg font-bold">Profile Created!</span>
                                </div>
                            )}

                            {enrollmentStatus === 'error' && (
                                <div className="z-10 text-red-500 flex flex-col items-center">
                                    <AlertCircle className="h-10 w-10 mb-2" />
                                    <span className="text-sm font-medium">Error</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50 gap-4 relative overflow-hidden">
                            {/* Status Indicators */}
                            <div className="text-red-400 text-sm text-center bg-red-950/20 p-2 rounded border border-red-900/50">
                                {errorMessage}
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    {enrollmentStatus !== 'success' && (
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-2xl font-mono text-zinc-300">
                                {files.length > 0 ? (
                                    <div className="text-base text-zinc-400 font-sans flex flex-col items-center">
                                        <span className="font-medium text-zinc-200">{files.length} file(s) selected</span>
                                        <span className="text-xs text-zinc-500 max-w-[200px] truncate">
                                            {files.map(f => f.name).join(', ')}
                                        </span>
                                    </div>
                                ) : (
                                    formatTime(recordingDuration)
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                {enrollmentStatus === 'idle' || enrollmentStatus === 'error' ? (
                                    <>
                                        <Button
                                            size="lg"
                                            className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all hover:scale-105"
                                            onClick={startRecording}
                                        >
                                            <Mic className="h-6 w-6" />
                                        </Button>

                                        <div className="flex items-center">
                                            <input
                                                type="file"
                                                multiple
                                                accept="audio/*"
                                                className="hidden"
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-zinc-400 hover:text-zinc-200 gap-2 mt-4 absolute bottom-4 right-4"
                                                onClick={triggerFileInput}
                                            >
                                                <UploadCloud className="h-4 w-4" />
                                                Import Audio
                                            </Button>
                                        </div>
                                    </>
                                ) : enrollmentStatus === 'recording' ? (
                                    <Button
                                        size="lg"
                                        className="h-14 w-14 rounded-full bg-zinc-700 hover:bg-zinc-600 animate-pulse"
                                        onClick={stopRecording}
                                    >
                                        <Square className="h-6 w-6 fill-current" />
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-12 w-12 rounded-full border-zinc-700 hover:bg-zinc-800"
                                            onClick={resetRecording}
                                            disabled={isProcessing}
                                        >
                                            <RefreshCw className="h-5 w-5" />
                                        </Button>

                                        <Button
                                            size="lg"
                                            className="px-8 rounded-full bg-indigo-600 hover:bg-indigo-700"
                                            onClick={handleSave}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Save Profile
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>

                            {enrollmentStatus === 'idle' && (
                                <p className="text-xs text-zinc-500">
                                    Press the microphone to start recording. Please record for at least 10 seconds.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
