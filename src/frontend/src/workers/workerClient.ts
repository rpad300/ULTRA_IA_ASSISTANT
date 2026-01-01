import type { WorkerCommand, WorkerEvent, NetworkState } from '../types/worker';

// Singleton Worker Instance
let workerInstance: Worker | null = null;

// Listeners
const stateListeners = new Set<(state: NetworkState) => void>();
const messageListeners = new Set<(msg: any) => void>();

// Initial State
let globalState: NetworkState = {
    isConnected: false,
    latency: 0,
    status: 'disconnected',
    pendingSyncCount: 0
};

export function getWorker(): Worker {
    if (!workerInstance) {
        // We use a relative path. Note: Vite worker import might vary, 
        // but assuming standard ESM worker support.
        workerInstance = new Worker(new URL('./network.worker.ts', import.meta.url), {
            type: 'module'
        });

        workerInstance.onmessage = (event: MessageEvent<WorkerEvent>) => {
            const data = event.data;
            switch (data.type) {
                case 'STATUS_CHANGE':
                    updateState({
                        isConnected: data.status === 'connected',
                        status: data.status
                    });
                    break;
                case 'MESSAGE_RECEIVED':
                    notifyMessage(data.payload);
                    break;
                case 'LATENCY_UPDATE':
                    updateState({ latency: data.latency });
                    break;
                case 'OFFLINE_SYNC_COMPLETE':
                    console.log("[Network] Offline Sync Complete");
                    updateState({ pendingSyncCount: 0 });
                    break;
            }
        };
    }
    return workerInstance;
}

function updateState(updates: Partial<NetworkState>) {
    globalState = { ...globalState, ...updates };
    stateListeners.forEach(l => l(globalState));
}

function notifyMessage(payload: any) {
    messageListeners.forEach(l => l(payload));
}

export function subscribeToState(callback: (state: NetworkState) => void) {
    stateListeners.add(callback);
    // Emit current state immediately
    callback(globalState);
    return () => stateListeners.delete(callback);
}

export function subscribeToMessages(callback: (msg: any) => void) {
    messageListeners.add(callback);
    return () => messageListeners.delete(callback);
}

export function sendWorkerMessage(cmd: WorkerCommand) {
    const w = getWorker();
    w.postMessage(cmd);
}
