/**
 * API Configuration
 * Centralized configuration for API endpoints and WebSocket URLs
 */

// Get API base URL from environment or use default
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const AUDIO_SERVICE_BASE_URL = import.meta.env.VITE_AUDIO_SERVICE_URL || 'http://127.0.0.1:8001/api/audio-service';

// Get WebSocket base URL (convert http to ws)
// Remove /api from the end if present, then convert http to ws
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ||
    (() => {
        if (API_BASE_URL.startsWith('http')) {
            const base = API_BASE_URL.replace(/\/api$/, '');
            return base.replace(/^http/, 'ws');
        } else {
            // For relative paths, construct WS URL from current window location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

            // SOTA: Direct Connection Bypass for Local Dev/Build (Ports 5999/5173)
            // This avoids Proxy middleware issues for WebSockets
            if (window.location.port === '5999' || window.location.port === '5173') {
                return `${protocol}//${window.location.hostname}:8000`;
            }

            return `${protocol}//${window.location.host}`;
        }
    })();

/**
 * Get full API endpoint URL
 */
export function getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Get full WebSocket URL
 */
export function getWebSocketUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${WS_BASE_URL}${cleanPath}`;
}

