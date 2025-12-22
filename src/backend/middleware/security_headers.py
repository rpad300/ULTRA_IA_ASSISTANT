"""
Security Headers Middleware
Adds security headers to all responses
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from config import ENVIRONMENT


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        # Skip security headers for WebSocket connections
        # WebSocket connections are handled differently and don't need these headers
        if request.url.scheme in ('ws', 'wss') or 'websocket' in request.headers.get('upgrade', '').lower():
            return await call_next(request)
        
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Strict Transport Security (only in production with HTTPS)
        if ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy (adjust based on your needs)
        # Note: connect-src includes ws:// and wss:// for WebSocket support
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https: ws: wss:; "  # Allow WebSocket connections
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response

