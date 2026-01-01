"""
Embedding Cache Service (SOTA KERS)
Optimized for Speed (XXHash), Memory (Numpy), and Concurrency (Async Locks).
"""

import hashlib
import logging
import asyncio
import numpy as np
from typing import Optional, Dict, Union, List
from datetime import datetime, timedelta
from collections import OrderedDict

# Safe Speed Optimization
try:
    import xxhash
    HAS_XXHASH = True
except ImportError:
    HAS_XXHASH = False

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """
    SOTA LRU cache for embeddings with TTL.
    Features:
    - Zero-Colision Fast Hashing (XXHash)
    - Compact Memory Layout (Float32 Numpy Arrays)
    - Async Thread Safety (Locks)
    """
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        """
        Args:
            max_size: Maximum number of cached embeddings
            ttl_seconds: Time to live in seconds (default 1 hour)
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        # OrderedDict for LRU: {hash: (vector, timestamp)}
        self.cache: OrderedDict = OrderedDict()
        self.hits = 0
        self.misses = 0
        
        # Concurrency
        self.lock = asyncio.Lock()
    
    def _compute_hash(self, content: str) -> str:
        """Compute fast hash of content."""
        if HAS_XXHASH:
            return xxhash.xxh64(content).hexdigest()
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    async def get(self, content: str) -> Optional[np.ndarray]:
        """
        Get cached embedding if available and not expired.
        Thread-safe (Async).
        
        Args:
            content: Text content to look up
        
        Returns:
            Embedding vector (np.ndarray) if found and valid, None otherwise
        """
        content_hash = self._compute_hash(content)
        
        # Lock for LRU mutation
        async with self.lock:
            if content_hash not in self.cache:
                self.misses += 1
                return None
            
            vector, timestamp = self.cache[content_hash]
            
            # Check if expired
            if datetime.now() - timestamp > timedelta(seconds=self.ttl_seconds):
                del self.cache[content_hash]
                self.misses += 1
                logger.debug(f"Cache expired for hash {content_hash[:8]}...")
                return None
            
            # Move to end (most recently used)
            self.cache.move_to_end(content_hash)
            self.hits += 1
            # logger.debug(f"Cache hit for hash {content_hash[:8]}...")
            return vector
    
    async def set(self, content: str, vector: Union[List[float], np.ndarray]) -> None:
        """
        Cache an embedding.
        Thread-safe (Async).
        
        Args:
            content: Text content
            vector: Embedding vector (list or numpy)
        """
        content_hash = self._compute_hash(content)
        
        # Normalize to float32 numpy array for memory efficiency
        if not isinstance(vector, np.ndarray):
            vector_np = np.array(vector, dtype=np.float32)
        else:
            vector_np = vector.astype(np.float32)
        
        async with self.lock:
            # Remove if exists (will be re-added at end)
            if content_hash in self.cache:
                del self.cache[content_hash]
            
            # Add new entry
            self.cache[content_hash] = (vector_np, datetime.now())
            
            # Evict oldest if over limit
            if len(self.cache) > self.max_size:
                self.cache.popitem(last=False)  # Remove oldest
            
            # logger.debug(f"Cached embedding for hash {content_hash[:8]}...")
    
    async def clear(self) -> None:
        """Clear all cached embeddings."""
        async with self.lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0
            logger.info("Embedding cache cleared")
    
    async def get_stats(self) -> Dict:
        """Get cache statistics."""
        async with self.lock:
            total = self.hits + self.misses
            hit_rate = (self.hits / total * 100) if total > 0 else 0
            
            return {
                "size": len(self.cache),
                "max_size": self.max_size,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate_percent": round(hit_rate, 2),
                "ttl_seconds": self.ttl_seconds
            }


# Singleton
_embedding_cache = None


def get_embedding_cache() -> EmbeddingCache:
    """Get global embedding cache instance."""
    global _embedding_cache
    if _embedding_cache is None:
        _embedding_cache = EmbeddingCache(
            max_size=1000,  # Cache up to 1000 embeddings
            ttl_seconds=3600  # 1 hour TTL
        )
    return _embedding_cache





