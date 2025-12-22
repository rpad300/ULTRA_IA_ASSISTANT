/**
 * API Configuration
 * Centralized configuration for API endpoints and WebSocket URLs
 */

// Get API base URL from environment or use default
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
            return `${protocol}//${window.location.host}`; // e.g. ws://localhost:5999 (which delegates to proxy -> 8000)
            // NOTE: Vite proxy supports WS forwarding if configured.
            // If not, we might need to hardcode 'ws://localhost:8000' during dev if proxy fails for WS.
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

