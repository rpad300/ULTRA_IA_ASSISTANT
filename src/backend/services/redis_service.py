import os
import json
import logging
import asyncio
from typing import Optional, Any, Union
from datetime import timedelta
from dotenv import load_dotenv
from contextlib import asynccontextmanager

import redis.asyncio as redis
# SOTA: Binary Serialization
try:
    import msgpack
except ImportError:
    msgpack = None

logger = logging.getLogger(__name__)

class RedisService:
    _instance = None
    _client: Optional[redis.Redis] = None
    _namespace: str = "ultra_ai:v1:"

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Allow lazy init
        self._lock = asyncio.Lock()
        pass

    async def connect(self):
        # SOTA: Critical Section Lock to prevent Race Conditions during Startup
        async with self._lock:
            if self._client:
                return

            load_dotenv()
            
            # Support both URL or Host/Port
            redis_url = os.getenv("REDIS_URL")
            host = os.getenv("REDIS_HOST")
            port = os.getenv("REDIS_PORT")
            password = os.getenv("REDIS_PASSWORD")

            try:
                # SOTA: Connection Pooling & Binary Mode
                # decode_responses=False because we use msgpack (binary)
                # SOTA: timeouts set to 5s to prevent hanging indefinitely
                pool_config = {
                    "max_connections": 50,
                    "socket_timeout": 5.0,
                    "socket_connect_timeout": 5.0, 
                    "health_check_interval": 30
                }
                
                if redis_url:
                    self._client = redis.from_url(redis_url, decode_responses=False, **pool_config)
                elif host and port:
                    self._client = redis.Redis(
                        host=host, 
                        port=int(port), 
                        password=password, 
                        decode_responses=False,
                        **pool_config
                    )
                else:
                    logger.warning("No Redis configuration found. Caching disabled.")
                    return

                # Test connection
                await self._client.ping()
                logger.info("Connected to Redis Cache (Binary/SOTA).")
            except Exception as e:
                logger.error(f"❌ Failed to connect to Redis: {e}")
                self._client = None
            
    def _get_namespaced_key(self, key: str) -> str:
        return f"{self._namespace}{key}"

    async def get_json(self, key: str) -> Optional[Any]:
        """Retrieve and deserialize data from cache (MsgPack or JSON fallback)."""
        if not self._client: return None
        safe_key = self._get_namespaced_key(key)
        try:
            data = await self._client.get(safe_key)
            if data:
                if msgpack:
                    return msgpack.unpackb(data)
                return json.loads(data.decode('utf-8'))
            return None
        except Exception as e:
            logger.warning(f"Cache miss/error for {key}: {e}")
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int = 300):
        """Serialize and store data with TTL (MsgPack preferred)."""
        if not self._client: return
        safe_key = self._get_namespaced_key(key)
        try:
            if msgpack:
                payload = msgpack.packb(value)
            else:
                payload = json.dumps(value).encode('utf-8')
                
            await self._client.setex(safe_key, ttl_seconds, payload)
        except Exception as e:
            logger.error(f"Failed to set cache for {key}: {e}")

    async def delete(self, key: str):
        if not self._client: return
        safe_key = self._get_namespaced_key(key)
        try:
            await self._client.delete(safe_key)
        except Exception as e:
            logger.error(f"Failed to delete {key}: {e}")
            
    async def flush_all(self):
        if not self._client: return
        try:
             # Be careful in production with flushdb!
             # Ideally only delete keys with namespace prefix using scan
             await self._client.flushdb()
             logger.info("Redis Cache Flushed.")
        except Exception as e:
            logger.error(f"Failed to flush redis: {e}")

    async def publish(self, channel: str, message: Any) -> int:
        """Publish a message to a channel (SOTA Pub/Sub)."""
        if not self._client: return 0
        safe_channel = self._get_namespaced_key(channel)
        try:
            if msgpack:
                payload = msgpack.packb(message)
            else:
                payload = json.dumps(message).encode('utf-8')
            return await self._client.publish(safe_channel, payload)
        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")
            return 0

    async def subscribe(self, channel: str):
        """Subscribe to a channel and return the PubSub object."""
        if not self._client: return None
        safe_channel = self._get_namespaced_key(channel)
        try:
            pubsub = self._client.pubsub()
            await pubsub.subscribe(safe_channel)
            return pubsub
        except Exception as e:
            logger.error(f"Failed to subscribe to {channel}: {e}")
            return None

    @asynccontextmanager
    async def lock(self, resource_name: str, timeout: int = 10):
        """
        SOTA: Distributed Lock (Redlock mechanism simple)
        Prevents race conditions in distributed systems.
        """
        if not self._client: 
            # If no redis, we yield True (fake lock) or False?
            # Fail open or closed? Closed is safer for integrity.
            yield False 
            return

        lock_key = self._get_namespaced_key(f"lock:{resource_name}")
        # NX = Set only if Not Exists
        is_locked = await self._client.set(lock_key, "locked", ex=timeout, nx=True)
        try:
            yield is_locked
        finally:
            if is_locked:
                await self._client.delete(lock_key)

# Global Getter
_redis_service: Optional[RedisService] = None

async def get_redis_service() -> RedisService:
    global _redis_service
    if _redis_service is None:
        _redis_service = RedisService()
        await _redis_service.connect()
    return _redis_service
