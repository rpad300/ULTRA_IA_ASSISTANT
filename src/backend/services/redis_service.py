import os
import json
import logging
import asyncio
from typing import Optional, Any, Union
from datetime import timedelta
from dotenv import load_dotenv

import redis.asyncio as redis

logger = logging.getLogger(__name__)

class RedisService:
    _instance = None
    _client: Optional[redis.Redis] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Allow lazy init
        pass

    async def connect(self):
        if self._client:
            return

        load_dotenv()
        
        # Support both URL or Host/Port
        redis_url = os.getenv("REDIS_URL")
        host = os.getenv("REDIS_HOST")
        port = os.getenv("REDIS_PORT")
        password = os.getenv("REDIS_PASSWORD")

        try:
            if redis_url:
                self._client = redis.from_url(redis_url, decode_responses=True)
            elif host and port:
                self._client = redis.Redis(
                    host=host, 
                    port=int(port), 
                    password=password, 
                    decode_responses=True
                )
            else:
                logger.warning("No Redis configuration found in .env (REDIS_URL or REDIS_HOST/PORT). Caching disabled.")
                return

            # Test connection
            await self._client.ping()
            logger.info("Connected to Redis Cache.")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            self._client = None

    async def get_json(self, key: str) -> Optional[Any]:
        """Retrieve and deserialize JSON data from cache."""
        if not self._client: return None
        try:
            data = await self._client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Cache miss/error for {key}: {e}")
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int = 300):
        """Serialize and store JSON data with TTL (default 5 mins)."""
        if not self._client: return
        try:
            json_str = json.dumps(value)
            await self._client.setex(key, ttl_seconds, json_str)
        except Exception as e:
            logger.error(f"Failed to set cache for {key}: {e}")

    async def delete(self, key: str):
        if not self._client: return
        try:
            await self._client.delete(key)
        except Exception as e:
            logger.error(f"Failed to delete {key}: {e}")
            
    async def flush_all(self):
        if not self._client: return
        try:
             await self._client.flushdb()
             logger.info("Redis Cache Flushed.")
        except Exception as e:
            logger.error(f"Failed to flush redis: {e}")

# Global Getter
_redis_service: Optional[RedisService] = None

async def get_redis_service() -> RedisService:
    global _redis_service
    if _redis_service is None:
        _redis_service = RedisService()
        await _redis_service.connect()
    return _redis_service
