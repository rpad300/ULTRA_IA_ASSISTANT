"""
Rate Limiting by User Middleware
Extends rate limiting to support per-user limits
"""

import time
from collections import defaultdict
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from config import ENVIRONMENT
from middleware.auth import get_current_user
from utils.redis_cache import get_redis_client, get_cache, set_cache

# In-memory fallback (use Redis in production)
_rate_limit_store_user = defaultdict(list)


class UserRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware with user-based limits.
    Limits: 200 requests per minute per authenticated user, 100 per IP for anonymous
    """
    
    def __init__(self, app, authenticated_limit: int = 200, anonymous_limit: int = 100):
        super().__init__(app)
        self.authenticated_limit = authenticated_limit
        self.anonymous_limit = anonymous_limit
        self.window_seconds = 60
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        # Skip rate limiting for health checks
        if request.url.path.startswith("/health") or request.url.path.startswith("/api/health") or request.url.path in ["/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        # Skip in development
        if ENVIRONMENT == "development":
            return await call_next(request)
        
        # Try to get user ID from auth
        user_id = None
        try:
            # Try to extract user from request state (set by auth middleware)
            if hasattr(request.state, "user"):
                user_id = request.state.user.get("user_id")
        except:
            pass
        
        # Determine limit and identifier
        if user_id:
            limit = self.authenticated_limit
            identifier = f"user:{user_id}"
        else:
            limit = self.anonymous_limit
            client_ip = request.client.host if request.client else "unknown"
            identifier = f"ip:{client_ip}"
        
        # Check rate limit
        now = time.time()
        window_start = now - self.window_seconds
        
        # Try Redis first
        redis_client = get_redis_cache()
        if redis_client:
            try:
                key = f"ratelimit:{identifier}"
                count = redis_client.get(key)
                if count and int(count) >= limit:
                    raise HTTPException(
                        status_code=429,
                        detail="Rate limit exceeded. Please try again later.",
                        headers={
                            "Retry-After": str(self.window_seconds),
                            "X-RateLimit-Limit": str(limit),
                            "X-RateLimit-Remaining": "0"
                        }
                    )
                # Increment count
                redis_client.incr(key)
                redis_client.expire(key, self.window_seconds)
                remaining = limit - int(redis_client.get(key) or 0)
            except Exception as e:
                # Fallback to memory
                pass
        
        # Fallback to memory-based rate limiting
        _rate_limit_store_user[identifier] = [
            timestamp for timestamp in _rate_limit_store_user[identifier]
            if timestamp > window_start
        ]
        
        if len(_rate_limit_store_user[identifier]) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        _rate_limit_store_user[identifier].append(now)
        remaining = limit - len(_rate_limit_store_user[identifier])
        
        # Process request
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        if user_id:
            response.headers["X-RateLimit-User-Limit"] = str(self.authenticated_limit)
            response.headers["X-RateLimit-User-Remaining"] = str(remaining)
        
        return response


def get_redis_cache():
    """Get Redis client for rate limiting."""
    try:
        from utils.redis_cache import get_redis_client
        return get_redis_client()
    except:
        return None





