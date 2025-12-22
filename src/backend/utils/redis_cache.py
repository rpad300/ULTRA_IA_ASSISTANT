"""
Redis Cache Utilities
Provides distributed caching using Redis
"""

import json
import logging
from typing import Optional, Any
from functools import wraps
import os

logger = logging.getLogger(__name__)

# Try to import redis, fallback to in-memory cache if not available
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, using in-memory cache")

# In-memory fallback cache
_memory_cache: dict = {}


def get_redis_client():
    """Get Redis client or None if not configured."""
    if not REDIS_AVAILABLE:
        return None
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        return redis.from_url(redis_url, decode_responses=True)
    except Exception as e:
        logger.warning(f"Failed to connect to Redis: {e}")
        return None


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate cache key from prefix and arguments."""
    key_parts = [prefix]
    if args:
        key_parts.extend(str(arg) for arg in args)
    if kwargs:
        key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
    return ":".join(key_parts)


def get_cache(key: str, default: Any = None) -> Optional[Any]:
    """Get value from cache."""
    redis_client = get_redis_client()
    
    if redis_client:
        try:
            value = redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
    
    # Fallback to memory cache
    return _memory_cache.get(key, default)


def set_cache(key: str, value: Any, ttl: int = 3600):
    """Set value in cache with TTL."""
    redis_client = get_redis_client()
    
    if redis_client:
        try:
            redis_client.setex(key, ttl, json.dumps(value))
        except Exception as e:
            logger.error(f"Redis set error: {e}")
    
    # Fallback to memory cache
    _memory_cache[key] = value


def delete_cache(key: str):
    """Delete key from cache."""
    redis_client = get_redis_client()
    
    if redis_client:
        try:
            redis_client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
    
    # Fallback to memory cache
    _memory_cache.pop(key, None)


def cached(ttl: int = 3600, key_prefix: str = "cache"):
    """
    Decorator for caching function results.
    
    Usage:
        @cached(ttl=300, key_prefix="companies")
        async def get_companies():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            key = cache_key(key_prefix, func.__name__, *args, **kwargs)
            cached_value = get_cache(key)
            if cached_value is not None:
                return cached_value
            
            result = await func(*args, **kwargs)
            set_cache(key, result, ttl)
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            key = cache_key(key_prefix, func.__name__, *args, **kwargs)
            cached_value = get_cache(key)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            set_cache(key, result, ttl)
            return result
        
        # Return appropriate wrapper based on function type
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator





