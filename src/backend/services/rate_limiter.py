"""
Rate Limiter for Gemini API to prevent overuse and control costs.
Uses token bucket algorithm for smooth rate limiting.
"""

import time
import asyncio
from typing import Optional
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter for API calls.
    """
    
    def __init__(
        self,
        max_requests: int = 60,  # Requests per period
        period_seconds: int = 60,  # Time window in seconds
        burst_size: Optional[int] = None  # Allow burst up to this many requests
    ):
        self.max_requests = max_requests
        self.period_seconds = period_seconds
        self.burst_size = burst_size or max_requests
        
        # Token bucket state: {key: (tokens, last_refill_time)}
        self.buckets = defaultdict(lambda: (self.burst_size, time.time()))
        self.lock = asyncio.Lock()
    
    async def acquire(self, key: str = "default") -> bool:
        """
        Try to acquire a token. Returns True if successful, False if rate limited.
        
        Args:
            key: Identifier for different rate limit groups (e.g., "embedding", "chat")
        
        Returns:
            True if request can proceed, False if rate limited
        """
        async with self.lock:
            tokens, last_refill = self.buckets[key]
            now = time.time()
            
            # Refill tokens based on elapsed time
            elapsed = now - last_refill
            tokens_to_add = (elapsed / self.period_seconds) * self.max_requests
            tokens = min(self.burst_size, tokens + tokens_to_add)
            last_refill = now
            
            if tokens >= 1.0:
                # Consume one token
                tokens -= 1.0
                self.buckets[key] = (tokens, last_refill)
                return True
            else:
                # Rate limited
                wait_time = (1.0 - tokens) * (self.period_seconds / self.max_requests)
                logger.warning(
                    f"Rate limit exceeded for '{key}'. "
                    f"Wait {wait_time:.2f}s before retry."
                )
                return False
    
    async def wait_if_needed(self, key: str = "default") -> None:
        """
        Wait if rate limited, otherwise proceed immediately.
        """
        while not await self.acquire(key):
            # Calculate wait time
            tokens, last_refill = self.buckets[key]
            wait_time = (1.0 - tokens) * (self.period_seconds / self.max_requests)
            await asyncio.sleep(min(wait_time, 1.0))  # Max 1 second wait per check


# Global rate limiters
_embedding_rate_limiter = None
_chat_rate_limiter = None


def get_embedding_rate_limiter() -> RateLimiter:
    """Get rate limiter for embedding operations (60 req/min default)."""
    global _embedding_rate_limiter
    if _embedding_rate_limiter is None:
        # Gemini embedding API: typically 60 requests per minute
        _embedding_rate_limiter = RateLimiter(
            max_requests=60,
            period_seconds=60,
            burst_size=10  # Allow small bursts
        )
    return _embedding_rate_limiter


def get_chat_rate_limiter() -> RateLimiter:
    """Get rate limiter for chat operations (30 req/min default)."""
    global _chat_rate_limiter
    if _chat_rate_limiter is None:
        _chat_rate_limiter = RateLimiter(
            max_requests=30,
            period_seconds=60,
            burst_size=5
        )
    return _chat_rate_limiter





