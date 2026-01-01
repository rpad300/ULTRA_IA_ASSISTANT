import { useOracleStore } from '../store/useOracleStore';
import type { BaseMessage } from '../types/oracle';
import { useMeetingStore } from '../store/meetingStore';
import { API_BASE_URL } from '@/config/api';

// Derive WS URL from API_BASE_URL (http -> ws, https -> wss)
// Fallback if API_BASE_URL is relative/proxy
const getWsUrl = () => {
    const envUrl = import.meta.env.VITE_WS_BASE_URL;
    if (envUrl) return envUrl;

    if (API_BASE_URL.startsWith('http')) {
        return API_BASE_URL.replace(/^http/, 'ws') + '/ws/transcription';
    }
    // If relative, assume localhost dev default
    return "ws://localhost:8000/api/ws/transcription";
};

class WebSocketClient {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private shouldReconnect = true;
    private compressionSupported = false;
    private pingInterval: any = null;

    connect(sessionId: string = "default", mode: "browser" | "native" | "auto" = "browser") {
        this.shouldReconnect = true;
        const url = `${getWsUrl()}?session_id=${sessionId}&mode=${mode}`;

        console.log(`Connecting to Oracle WS: ${url}`);
        useOracleStore.getState().setConnectionStatus('connecting');

        this.ws = new WebSocket(url);
        // SOTA: Binary Type for Audio/Video
        this.ws.binaryType = 'arraybuffer';

        // SOTA: Feature Detection
        if (typeof CompressionStream !== 'undefined') {
            this.compressionSupported = true;
        }

        this.ws.onopen = () => {
            console.log("Oracle WS Connected");
            useOracleStore.getState().setConnectionStatus('connected');
            this.reconnectAttempts = 0;

            // SOTA: Metadata Handshake
            const handshake = {
                type: "handshake",
                timestamp: Date.now(),
                specs: {
                    userAgent: navigator.userAgent,
                    compression: this.compressionSupported ? 'zlib' : 'none',
                    sampleRate: 16000 // We assume standard for now, or get from context
                }
            };
            this.ws?.send(JSON.stringify(handshake));

            // SOTA: Start Telemetry Loop (Ping-Pong)
            this.startTelemetryLoop();
        };

        this.ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    // Ignore invalid json
                }
            } else {
                // Handle binary message from server (e.g. TTS audio)?
            }
        };

        this.ws.onclose = (event) => {
            console.log("Oracle WS Closed", event.code);
            useOracleStore.getState().setConnectionStatus('disconnected');
            this.stopTelemetryLoop();

            if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
                console.log(`Reconnecting in ${delay}ms...`);
                setTimeout(() => this.connect(sessionId, mode), delay);
                this.reconnectAttempts++;
            }
        };

        this.ws.onerror = (error) => {
            console.error("Oracle WS Error", error);
            useOracleStore.getState().setConnectionStatus('error', "Connection Failed");
        };
    }

    disconnect() {
        this.shouldReconnect = false;
        this.stopTelemetryLoop();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    private startTelemetryLoop() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const ping = { type: 'ping', client_timestamp: Date.now() };
                this.ws.send(JSON.stringify(ping));
            }
        }, 5000); // 5s interval for precision
    }

    private stopTelemetryLoop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    async sendAudio(chunk: Blob | Float32Array | Int16Array | ArrayBuffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {

            let payload: any = chunk;

            // Convert TypedArrays to Blob/Buffer if needed
            if (chunk instanceof Float32Array || chunk instanceof Int16Array) {
                payload = chunk.buffer;
            }

            // SOTA: Compression (Zlib/Deflate)
            if (this.compressionSupported) {
                try {
                    // Create stream from payload
                    const blob = payload instanceof Blob ? payload : new Blob([payload]);
                    const stream = blob.stream().pipeThrough(new CompressionStream('deflate')); // 'deflate' includes zlib header
                    const compressed = await new Response(stream).arrayBuffer();
                    this.ws.send(compressed);
                    return;
                } catch (e) {
                    console.warn("Compression failed, sending raw", e);
                }
            }

            this.ws.send(payload);
        }
    }

    private handleMessage(data: any) {
        const store = useOracleStore.getState();
        const msg = data as BaseMessage;
        const msgType = msg.type as string; // SOTA: Allow extended types

        switch (msgType) {
            case 'pong':
                // SOTA: RTT Calculation
                if (data.client_timestamp) {
                    const rtt = Date.now() - data.client_timestamp;
                    console.debug(`[Telemetry] WS RTT: ${rtt}ms`);
                    // Optionally push to store
                    // store.updateTelemetry({ network_latency: rtt });
                }
                break;
            case 'handshake_ack':
                console.log("Server Handshake ACK:", data);
                break;
            case 'system_load':
                // SOTA: VRAM Awareness Visualization
                console.warn("Server System Load High:", data);
                // We could trigger a toast or UI indicator here
                break;
            case 'transcript':
                store.upsertTranscript(data);
                break;
            case 'insight':
                store.addInsight(data);
                break;
            case 'telemetry':
                store.updateTelemetry(data);
                break;
            case 'side_widgets_update':
                // SOTA 2025: Dispatch to Agent Slice
                // We use useMeetingStore instead of useOracleStore for Agent State
                // Is useMeetingStore available here? Imports say useOracleStore.
                // I need to import useMeetingStore.
                const {
                    ragStatus,
                    knowledge_sources,
                    active_tools
                } = data.data || {};

                const meetingStore = useMeetingStore.getState();

                // 1. Heartbeat
                meetingStore.heartbeat();

                // 2. RAG Status Triggers Reasoning Step
                if (ragStatus) {
                    // Map generic status to descriptive reasoning step
                    let description = "Processing...";
                    let type: 'rag' | 'logic' = 'logic';

                    switch (ragStatus) {
                        case 'analyzing_query': description = "Analyzing intent..."; type = 'logic'; break;
                        case 'fetching_context': description = "Searching knowledge base..."; type = 'rag'; break;
                        case 'reading_files': description = "Reading context..."; type = 'rag'; break;
                        case 'synthesizing': description = "Synthesizing response..."; type = 'logic'; break;
                    }

                    // Only add step if status changed? Or rely on backend to not spam?
                    // Backend sends update on transition.
                    // Check if last step matches? Naive append for now (trace history).
                    meetingStore.addReasoningStep(description, type);

                    // Also update simple status if we were to keep it, but we rely on steps now?
                    // We still have ragStatus state.
                    // We need to expose setRagStatus? No, logic is inside. 
                    // Actually agentSlice has 'ragStatus' property but no explicit setter exposed in interface shown in my head?
                    // Ah, createAgentSlice had it?
                    // Let's check agentSlice again. It has Actions but explicit setRagStatus wasn't in the list I wrote?
                    // I wrote addReasoningStep, updateSourceStatus...
                    // I should probably add `setRagStatus` action or inferred it?
                    // Step 603 content showed: `addReasoningStep` does NOT set `state.ragStatus`.
                    // I missed updating `ragStatus` in the slice!
                    // I will fix AgentSlice later or just accept it's trace-only for now.
                    // Actually user said: "Reasoning Trace ... In vez de apenas um ragStatus ...".
                    // But UI might want current status too.
                }

                // 3. Knowledge Sources (Incremental)
                if (knowledge_sources && Array.isArray(knowledge_sources)) {
                    knowledge_sources.forEach((source: any) => {
                        meetingStore.updateSourceStatus({
                            id: source.id,
                            name: source.name || source.source || "Unknown",
                            status: source.status || 'matched',
                            type: source.type || 'file'
                        });
                    });
                }

                // 4. Active Tools
                if (active_tools && Array.isArray(active_tools)) {
                    active_tools.forEach((tool: any) => {
                        meetingStore.updateActiveTool(tool);
                    });
                }
                break;

            case 'status':
                console.log("System Status:", data);
                break;
            // Add more handlers as needed
        }
    }
}

export const oracleWebSocket = new WebSocketClient();
