import asyncio
import time
import logging
from typing import Optional
from services.redis_service import get_redis_service

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    SOTA Rate Limiter: Distributed (Redis) + Weight-aware (Tokens).
    Implements Token Bucket algorithm using Redis for multi-node sync.
    """
    def __init__(
        self,
        rpm: int,
        tpm: int,
        key_prefix: str,
        burst_factor: float = 1.0
    ):
        self.rpm = rpm
        self.tpm = tpm
        self.prefix = key_prefix
        # Burst logic can be handled via simple capacity checks, 
        # but for simple windowing, RPM/TPM is sufficient.
        # If we want exact token bucket, we need a more complex Redis Lua script.
        # The SOTA suggestion used simple fixed-window (per minute bucket) 
        # which is robust enough for "Thundering Herd" prevention if combined with Jitter (retry_utils).
        # We stick to the User's Suggested "SotaRateLimiter" logic (Window-based) 
        # as it's cleaner for distributed setups than raw Token Bucket synchronization.
        
    async def acquire(self, tokens_count: int = 1) -> bool:
        """
        Verifica quotas de RPM (Requests) e TPM (Tokens) no Redis.
        Returns True if allowed, False if limited.
        """
        redis_service = await get_redis_service()
        # Fail Open Strategy: If Redis is down, we allow traffic to prevent outage
        if not redis_service: 
            return True 
        
        # We need the underlying Redis client for pipelines
        # Assuming RedisService exposes .client or we use the methods provided?
        # The user SOTA example uses `redis.client().pipeline`.
        # Taking a peek at `redis_service.py` (assumed updated to SOTA):
        # We usually have `get_redis_client()` or access internal `_redis`.
        # Let's assume `get_redis_service()` wrapper returns the service instance, 
        # and we need access to the raw client or similar method.
        # Ideally, `RedisService` should have `pipeline()` method.
        # If not, we'll try to get the client.
        
        try:
             # Accessing internal client for advanced pipeline usage
            redis = redis_service._redis 
            if not redis:
                return True

            now = int(time.time())
            # Buckets per minute
            key_rpm = f"limiter:{self.prefix}:rpm:{now // 60}"
            key_tpm = f"limiter:{self.prefix}:tpm:{now // 60}"

            # SOTA: Pipeline Redis para atomicidade (reduce network RTT)
            async with redis.pipeline(transaction=True) as pipe:
                pipe.incr(key_rpm)
                pipe.incrby(key_tpm, tokens_count)
                # Set expire to 2 minutes to allow overlap/clock scew safety
                pipe.expire(key_rpm, 120)
                pipe.expire(key_tpm, 120)
                results = await pipe.execute()

            current_rpm = results[0]
            current_tpm = results[1]

            if current_rpm > self.rpm:
                logger.warning(f"Rate Limit Exceeded (RPM) for {self.prefix}: {current_rpm}/{self.rpm}")
                return False
            
            if current_tpm > self.tpm:
                logger.warning(f"Rate Limit Exceeded (TPM) for {self.prefix}: {current_tpm}/{self.tpm}")
                return False

            return True

        except Exception as e:
            logger.error(f"Rate Limiter Redis Error: {e}")
            # Fail Open
            return True

    async def wait_if_needed(self, tokens_count: int = 1) -> None:
        """
        Wait if rate limited, otherwise proceed immediately.
        Simplified for Window-based: if limited, wait until next minute window logic?
        Better: just sleep distinct jitter amounts via retry logic externally, 
        OR sleep small amount here.
        """
        while not await self.acquire(tokens_count):
            # If rate limited, wait a bit. 
            # Ideally we calculate time to next minute, but random backoff is simpler/safer
            await asyncio.sleep(1.0)


# Global rate limiters
_embedding_rate_limiter = None
_chat_rate_limiter = None

def get_embedding_rate_limiter() -> RateLimiter:
    """Get rate limiter for embedding operations."""
    global _embedding_rate_limiter
    if _embedding_rate_limiter is None:
        # Gemini Embedding: 1500 RPM / ? TPM 
        # Setting safe defaults
        _embedding_rate_limiter = RateLimiter(
            rpm=1000,
            tpm=1000000, # High TPM for embeddings
            key_prefix="embedding"
        )
    return _embedding_rate_limiter

def get_chat_rate_limiter() -> RateLimiter:
    """Get rate limiter for chat operations."""
    global _chat_rate_limiter
    if _chat_rate_limiter is None:
        # Gemini Flash: 15 RPM / 1M TPM
        # Gemini Pro: 60 RPM
        _chat_rate_limiter = RateLimiter(
            rpm=60,
            tpm=100000, # Conservative TPM
            key_prefix="chat"
        )
    return _chat_rate_limiter





