export class TranscriptionSocketManager {
    private ws: WebSocket | null = null;
    private url: string = '';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private heartbeatInterval: number | null = null;
    private storeAccessor: any = null;

    // Dependency Injection to avoid circular imports
    registerStore(store: any) {
        this.storeAccessor = store;
    }

    private getStore() {
        if (!this.storeAccessor) {
            console.error('[Socket] Store not registered! call registerStore()');
            return null;
        }
        return this.storeAccessor.getState();
    }

    // Conecta ao WebSocket do Backend (Ponte para o C#)
    connect(sessionId: string) {
        const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
        this.url = `${baseUrl}/api/ws/transcription?mode=native&session_id=${sessionId}`;

        console.log(`[Socket] Connecting to session: ${sessionId}`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => this.onOpen();
        this.ws.onmessage = (event) => this.onMessage(event);
        this.ws.onclose = (e) => this.onClose(e);
        this.ws.onerror = (err) => console.error('[Socket] Error:', err);
    }

    private onOpen() {
        console.log('[Socket] Connected and Authenticated');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
    }

    private onMessage(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data);
            const store = this.getStore();
            if (!store) return;

            // SOTA Dispatcher Pattern: Roteamento sem IF/ELSE gigante
            switch (data.type) {
                case 'Turn':
                case 'transcript':
                    console.log('[Socket] Received Transcript:', data); // Debug Log
                    store.handleTranscriptEvent(data);
                    break;

                case 'voice_identification':
                    // Quando o motor biométrico descobre quem é o orador
                    store.updateSpeakerByTrace(
                        data.trace_id,
                        data.contact_id,
                        data.contact_name
                    );
                    break;

                case 'intelligence_update':
                case 'cross_meeting_patterns':
                    // Insights enviados via Server-Push (RAG/Patterns)
                    if (store.addCrossMeetingPattern) {
                        store.addCrossMeetingPattern(data.pattern || data);
                    }
                    break;

                case 'status':
                    break;
            }
        } catch (error) {
            console.error('[Socket] Failed to parse message:', error);
        }
    }

    private onClose(event: CloseEvent) {
        this.stopHeartbeat();
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.pow(2, this.reconnectAttempts) * 1000;
            console.warn(`[Socket] Reconnecting in ${delay}ms...`);
            setTimeout(() => {
                this.reconnectAttempts++;
                const store = this.getStore();
                const sessionId = store ? store.sessionId : null;
                if (sessionId) {
                    this.connect(sessionId);
                }
            }, delay);
        }
    }

    private startHeartbeat() {
        this.heartbeatInterval = window.setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 15000); // 15 segundos
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    }

    send(data: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('[Socket] Cannot send message, socket not open');
        }
    }

    disconnect() {
        this.ws?.close(1000, 'User logged out');
        this.stopHeartbeat();
        this.ws = null;
    }
}

export const socketManager = new TranscriptionSocketManager();
