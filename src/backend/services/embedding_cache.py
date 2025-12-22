"""
Embedding Cache Service to avoid re-embedding identical content.
Uses content hash as cache key.
"""

import hashlib
import logging
from typing import Optional, Dict
from datetime import datetime, timedelta
from collections import OrderedDict

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """
    LRU cache for embeddings with TTL (Time To Live).
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
    
    def _compute_hash(self, content: str) -> str:
        """Compute SHA256 hash of content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def get(self, content: str) -> Optional[list[float]]:
        """
        Get cached embedding if available and not expired.
        
        Args:
            content: Text content to look up
        
        Returns:
            Embedding vector if found and valid, None otherwise
        """
        content_hash = self._compute_hash(content)
        
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
        logger.debug(f"Cache hit for hash {content_hash[:8]}...")
        return vector
    
    def set(self, content: str, vector: list[float]) -> None:
        """
        Cache an embedding.
        
        Args:
            content: Text content
            vector: Embedding vector to cache
        """
        content_hash = self._compute_hash(content)
        
        # Remove if exists (will be re-added at end)
        if content_hash in self.cache:
            del self.cache[content_hash]
        
        # Add new entry
        self.cache[content_hash] = (vector, datetime.now())
        
        # Evict oldest if over limit
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)  # Remove oldest
        
        logger.debug(f"Cached embedding for hash {content_hash[:8]}...")
    
    def clear(self) -> None:
        """Clear all cached embeddings."""
        self.cache.clear()
        self.hits = 0
        self.misses = 0
        logger.info("Embedding cache cleared")
    
    def get_stats(self) -> Dict:
        """Get cache statistics."""
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





