
import logging
import asyncio
import re
from typing import Optional, List
from google import genai
from config import GEMINI_API_KEY
from services.redis_service import get_redis_service

logger = logging.getLogger(__name__)

class ModelDiscoveryService:
    def __init__(self):
        if not GEMINI_API_KEY:
             raise ValueError("GEMINI_API_KEY not set")
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.redis = None
        self.REDIS_KEY_CURRENT_MODEL = "CURRENT_PRO_MODEL"

    async def _get_redis(self):
        if self.redis is None:
            self.redis = await get_redis_service()
        return self.redis

    async def discover_and_set_best_model(self) -> str:
        """
        Interrogates Google API to find the most powerful 'Pro' model.
        Criteria: 'pro' in name, highest input_token_limit, latest version.
        Stores result in Redis.
        """
        logger.info("Starting Dynamic Model Discovery...")
        
        try:
            # 1. List Models (Sync call in thread)
            loop = asyncio.get_running_loop()
            models = await loop.run_in_executor(None, lambda: list(self.client.models.list()))
            
            best_model = None
            max_version = -1.0
            max_tokens = -1
            
            for m in models:
                # Filter basic criteria
                if "gemini" not in m.name or "vision" in m.name or "embedding" in m.name:
                    continue
                    
                # Must be a "pro" model as per requirements
                if "pro" not in m.name.lower():
                    continue

                # Parse Version
                # e.g. gemini-1.5-pro-002 -> 1.5 (float)
                # gemini-1.5-pro-latest -> 1.5
                match = re.search(r"gemini-(\d+\.?\d*)", m.name)
                version = float(match.group(1)) if match else 0.0
                
                # Get Token Limit (handle missing attribute safely)
                token_limit = getattr(m, 'input_token_limit', 0) or 0
                
                # Selection Logic:
                # 1. Higher Token Limit wins (Capacity)
                # 2. Higher Version wins (Quality)
                # 3. 'latest' tag preference? (Implied by version usually)
                
                is_better = False
                
                if best_model is None:
                     is_better = True
                else:
                    # Priority 1: Token Limit (Must be massive for Context)
                    if token_limit > max_tokens:
                        is_better = True
                    elif token_limit == max_tokens:
                        # Priority 2: Version
                        if version > max_version:
                            is_better = True
                
                if is_better:
                    best_model = m.name
                    max_version = version
                    max_tokens = token_limit
            
            if not best_model:
                logger.warning("Could not find a 'Pro' model in discovery. Fallback to default.")
                return None

            logger.info(f"Discovered Best Model: {best_model} (Ver: {max_version}, Tokens: {max_tokens})")
            
            # 2. Store in Redis
            redis = await self._get_redis()
            await redis.set_json(self.REDIS_KEY_CURRENT_MODEL, best_model, ttl_seconds=86400 + 3600) # 25h TTL
            
            return best_model

        except Exception as e:
            logger.error(f"Model Discovery Failed: {e}")
            return None

    async def get_current_model(self) -> Optional[str]:
        """Retrieves the current cached model from Redis."""
        redis = await self._get_redis()
        return await redis.get_json(self.REDIS_KEY_CURRENT_MODEL)

# Singleton
_service = None

def get_model_discovery_service():
    global _service
    if _service is None:
        _service = ModelDiscoveryService()
    return _service
