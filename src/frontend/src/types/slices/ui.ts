export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
    actionUrl?: string; // Optional link navigation
    priority?: 'low' | 'medium' | 'high';
}

export interface UISliceState {
    isModelLoading: boolean;
    modelLoadingMessage: string | null;
    notifications: Notification[];
}
