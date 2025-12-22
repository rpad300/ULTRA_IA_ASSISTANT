"""
Connection Pooling for Supabase
Optimizes database connections for better performance
"""

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Global connection pool (singleton pattern)
_supabase_pool: Optional[Client] = None


def get_supabase_pool() -> Client:
    """
    Get or create Supabase client with connection pooling.
    The Supabase Python client already handles connection pooling internally,
    but we ensure a single instance is reused.
    """
    global _supabase_pool
    
    if _supabase_pool is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        
        _supabase_pool = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase connection pool initialized")
    
    return _supabase_pool


def close_pool():
    """Close connection pool (for graceful shutdown)."""
    global _supabase_pool
    if _supabase_pool:
        logger.info("Closing Supabase connection pool")
        _supabase_pool = None





