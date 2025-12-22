"""
Global Rate Limiting Middleware
Protects API from abuse and ensures fair usage
"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from config import ENVIRONMENT

# Simple in-memory rate limiter (use Redis in production)
_rate_limit_store = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    Limits: 100 requests per minute per IP (adjustable)
    """
    
    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        # Skip in development
        if ENVIRONMENT == "development":
            return await call_next(request)
        
        # Get client identifier (IP address)
        client_ip = request.client.host if request.client else "unknown"
        
        # Check rate limit
        now = time.time()
        window_start = now - self.window_seconds
        
        # Clean old entries
        _rate_limit_store[client_ip] = [
            timestamp for timestamp in _rate_limit_store[client_ip]
            if timestamp > window_start
        ]
        
        # Check if limit exceeded
        if len(_rate_limit_store[client_ip]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(self.window_seconds)}
            )
        
        # Record this request
        _rate_limit_store[client_ip].append(now)
        
        # Process request
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            self.requests_per_minute - len(_rate_limit_store[client_ip])
        )
        
        return response





