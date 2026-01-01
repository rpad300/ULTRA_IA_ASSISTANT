
export type WorkerCommand =
    | { type: 'CONNECT'; socketId: string; url: string; token?: string; sessionId?: string }
    | { type: 'DISCONNECT'; socketId: string }
    | { type: 'SEND_MESSAGE'; socketId: string; payload: any }
    | { type: 'SYNC_OFFLINE_ACTIONS'; actions: any[] }
    | { type: 'CHECK_LATENCY' };

export type WorkerEvent =
    | { type: 'STATUS_CHANGE'; socketId: string; status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'offline' }
    | { type: 'MESSAGE_RECEIVED'; socketId: string; payload: any }
    | { type: 'ERROR'; socketId: string; error: string }
    | { type: 'LATENCY_UPDATE'; latency: number }
    | { type: 'JITTER_WARNING'; isStable: boolean }
    | { type: 'OFFLINE_SYNC_COMPLETE'; success: boolean };

export interface NetworkState {
    isConnected: boolean;
    latency: number;
    status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'offline';
    pendingSyncCount: number;
}
