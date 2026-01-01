/// <reference lib="webworker" />

/*
 * SOTA Network Worker
 * Handles WebSocket connection, Jitter Buffering, and Offline Queue management.
 * Runs in a separate thread to ensure 60fps UI performance.
 */

import type { WorkerCommand, WorkerEvent } from "../types/worker";

const ctx: Worker = self as any;

// Configuration
const HEARTBEAT_INTERVAL = 5000;
const RECONNECT_BASE_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const ERROR_THRESHOLD = 5;
const ERROR_WINDOW_MS = 1000;
const JITTER_BUFFER_MS = 150;


// State
interface SocketState {
    ws: WebSocket | null;
    isConnected: boolean;
    reconnectAttempts: number;
    reconnectTimer: any;
    heartbeatTimer: any;
    url: string | null;
    token: string | null;
    sessionId: string | null;
    lastPongTime: number;
    lastSequenceId: number;
    errorCount: number;
    lastErrorTime: number;
}


const sockets = new Map<string, SocketState>();

// Helper to get or create state
function getSocketState(id: string): SocketState {
    if (!sockets.has(id)) {
        sockets.set(id, {
            ws: null,
            isConnected: false,
            reconnectAttempts: 0,
            reconnectTimer: null,
            heartbeatTimer: null,
            url: null,
            token: null,
            sessionId: null,
            lastPongTime: 0,
            lastSequenceId: 0,
            errorCount: 0,
            lastErrorTime: 0
        });
    }
    return sockets.get(id)!;
}


// Global State for Shared Logic
// let lastPongTime = 0; // Keeping global latency for simplicity for now

// Offline Queue
const offlineQueue: any[] = [];

// Jitter Buffer
// @ts-ignore
const jitterBuffer: any[] = [];
// @ts-ignore
let isPlaying = false;

// --- IndexedDB Persistence (SOTA: Robust Offline Queue) ---
const DB_NAME = 'ultra-assistant-network';
const STORE_NAME = 'offline-actions';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function persistOfflineAction(action: any) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add({ ...action, timestamp: Date.now() });
    } catch (e) {
        console.error("IDB Persist Error", e);
    }
}

async function flushOfflineActions(socketId: string) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const actions = request.result;
            if (actions && actions.length > 0) {
                console.log(`[Worker] Flushing ${actions.length} persisted actions from IDB`);
                const state = getSocketState(socketId);
                if (state.ws?.readyState === WebSocket.OPEN) {
                    actions.forEach((action: any) => {
                        state.ws!.send(JSON.stringify(action));
                    });
                    // Clear store after flush (or delete individually if strict ack required, but for bulk sync we clear safely)
                    const clearTx = db.transaction(STORE_NAME, 'readwrite');
                    clearTx.objectStore(STORE_NAME).clear();
                    emit({ type: 'OFFLINE_SYNC_COMPLETE', success: true });
                }
            }
        };
    } catch (e) {
        console.error("IDB Flush Error", e);
    }
}

function processMessageQueue(socketId: string) {
    const state = getSocketState(socketId);

    // 1. Flush Memory Queue (Immediate actions)
    if (offlineQueue.length > 0 && state.ws?.readyState === WebSocket.OPEN) {
        console.log(`[Worker] Flushing ${offlineQueue.length} offline messages for ${socketId}`);
        while (offlineQueue.length > 0) {
            const msg = offlineQueue.shift();
            state.ws.send(JSON.stringify(msg));
        }
    }

    // 2. Flush Persisted Queue (Robustness)
    if (state.ws?.readyState === WebSocket.OPEN) {
        flushOfflineActions(socketId);
    }
}

// --- WebSocket Logic ---

function emit(event: WorkerEvent) {
    ctx.postMessage(event);
}

function connect(socketId: string, url: string, token?: string, sessionId?: string) {
    const state = getSocketState(socketId);
    // SOTA: Idempotency Check
    // If we are already connected/connecting to the same URL/Token, ignore duplicates.
    const normalizedToken = token || null;
    const sameUrl = state.url === url;
    const sameToken = state.token === normalizedToken;
    const isActive = state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING);

    if (isActive && sameUrl && sameToken) {
        console.log(`[Worker] Connection Idempotent: Already active for ${socketId}`);
        // Ensure we emit status to sync the requesting component (in case it mounted late)
        emit({ type: 'STATUS_CHANGE', socketId, status: state.isConnected ? 'connected' : 'connecting' });
        return;
    }

    state.url = url;
    state.token = normalizedToken;
    state.sessionId = sessionId || null;
    state.errorCount = 0;
    state.lastErrorTime = 0;

    if (state.ws) {
        console.warn(`[Worker] Force-Closing existing connection for ${socketId} (New Config)`);
        state.ws.close();
        state.ws = null;
    }

    emit({ type: 'STATUS_CHANGE', socketId, status: 'connecting' });

    let wsUrl = url;
    if (token) {
        const separator = wsUrl.includes('?') ? '&' : '?';
        wsUrl = `${wsUrl}${separator}token=${token}`;
    }

    // SOTA DEBUG
    console.log(`[Worker] Connecting to: ${url} (Token present: ${!!token})`);

    try {
        const ws = new WebSocket(wsUrl);
        state.ws = ws;

        ws.onopen = () => {
            state.isConnected = true;
            state.reconnectAttempts = 0;
            emit({ type: 'STATUS_CHANGE', socketId, status: 'connected' });

            startHeartbeat(socketId);
            if (socketId === 'main') processMessageQueue(socketId);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'pong') {
                    state.lastPongTime = Date.now();
                    // calculateLatency(); // Global latency
                    return;
                }

                if (data.type === 'transcript' || data.type === 'Turn') {
                    // Jitter Buffer only for transcription socket
                    if (socketId.includes('transcription')) {
                        handleJitterBuffer(socketId, data);
                    } else {
                        emit({ type: 'MESSAGE_RECEIVED', socketId, payload: data });
                    }
                } else {
                    emit({ type: 'MESSAGE_RECEIVED', socketId, payload: data });
                }

            } catch (e) {
                console.error("Worker: JSON Parse Error", e);
            }
        };

        ws.onclose = (event) => {
            console.log(`[NetworkWorker] WS Closed (${socketId}): Code=${event.code} Reason=${event.reason} WasClean=${event.wasClean}`);
            state.isConnected = false;
            stopHeartbeat(socketId);

            if (event.code === 1000) {
                emit({ type: 'STATUS_CHANGE', socketId, status: 'disconnected' });
            } else {
                emit({ type: 'STATUS_CHANGE', socketId, status: 'reconnecting' });
                scheduleReconnect(socketId);
            }
        };

        ws.onerror = (error) => {
            console.error(`Worker: WS Error (${socketId})`, { error, url: wsUrl });

            // Circuit Breaker
            const now = Date.now();
            if (now - state.lastErrorTime < ERROR_WINDOW_MS) {
                state.errorCount++;
            } else {
                state.errorCount = 1;
                state.lastErrorTime = now;
            }

            if (state.errorCount > ERROR_THRESHOLD) {
                console.warn(`Worker: Too many errors for ${socketId}. Pausing reconnects for 10s.`);
                state.reconnectAttempts += 5;
            }
        };

    } catch (e) {
        console.error("Worker: Connect Exception", e);
        scheduleReconnect(socketId);
    }
}

function scheduleReconnect(socketId: string) {
    const state = getSocketState(socketId);
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(1.5, state.reconnectAttempts), MAX_RECONNECT_DELAY);
    state.reconnectAttempts++;
    console.log(`Worker: Reconnecting ${socketId} in ${delay}ms... (Attempt ${state.reconnectAttempts})`);

    const jitter = Math.random() * 500;

    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(() => {
        if (state.url) connect(socketId, state.url, state.token || undefined, state.sessionId || undefined);
    }, delay + jitter);
}

// --- Heartbeat ---

function startHeartbeat(socketId: string) {
    stopHeartbeat(socketId);
    const state = getSocketState(socketId);

    state.lastPongTime = Date.now(); // Initialize last pong time for this socket
    state.heartbeatTimer = setInterval(() => {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

        const now = Date.now();
        // Check for stale connection (no pong in 10s)
        if (now - state.lastPongTime > 10000) {
            console.warn(`Worker: Heartbeat timeout for ${socketId}, forcing reconnect`);
            state.ws.close(); // Will trigger onclose -> reconnect
            return;
        }

        state.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat(socketId: string) {
    const state = getSocketState(socketId);
    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
}



// --- Jitter Buffer ---

function handleJitterBuffer(socketId: string, message: any) {
    // Use JITTER_BUFFER_MS to delay if needed
    if (JITTER_BUFFER_MS > 0) {
        // Placeholder for real buffer logic
    }
    emit({ type: 'MESSAGE_RECEIVED', socketId, payload: message });
}

// --- Handler ---

ctx.onmessage = (e: MessageEvent<WorkerCommand>) => {
    const cmd = e.data;
    switch (cmd.type) {
        case 'CONNECT':
            console.log('[Worker] CONNECT Request:', { socketId: cmd.socketId, url: cmd.url });
            connect(cmd.socketId, cmd.url, cmd.token, (cmd as any).sessionId); // Cast to any to access sessionId if not explicitly in WorkerCommand
            break;
        case 'DISCONNECT':
            const state = getSocketState(cmd.socketId);
            if (state.ws) state.ws.close();
            stopHeartbeat(cmd.socketId);
            emit({ type: 'STATUS_CHANGE', socketId: cmd.socketId, status: 'disconnected' });
            break;
        case 'SEND_MESSAGE':
            const sendState = getSocketState(cmd.socketId!);
            if (sendState?.ws?.readyState === WebSocket.OPEN) {
                sendState.ws.send(JSON.stringify(cmd.payload));
            } else {
                console.log("Worker: Offline, queuing message", cmd.payload);
                offlineQueue.push(cmd.payload);
                persistOfflineAction(cmd.payload); // SOTA: Durable Persistence
            }
            break;
    }
};
