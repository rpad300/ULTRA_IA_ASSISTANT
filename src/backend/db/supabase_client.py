from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY
import logging

logger = logging.getLogger(__name__)

# Connection pool (singleton pattern)
_supabase_client: Client = None


def get_supabase_client() -> Client:
    """
    Get or create Supabase client with connection pooling.
    The Supabase Python client handles connection pooling internally,
    but we ensure a single instance is reused for optimal performance.
    """
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        
        # Configure client options to improve stability on Windows
        from supabase import ClientOptions
        options = ClientOptions(
            postgrest_client_timeout=60,
            schema="public"
        )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        logger.info("Supabase client initialized with connection pooling and custom options")
    return _supabase_client


_async_supabase_client = None

async def get_async_supabase_client():
    """
    Get or create Async Supabase client.
    """
    global _async_supabase_client
    if _async_supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        
        from supabase import create_async_client
        from supabase import ClientOptions
        options = ClientOptions(
            postgrest_client_timeout=60,
            schema="public"
        )
        _async_supabase_client = await create_async_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        logger.info("Async Supabase client initialized")
    return _async_supabase_client

async def reset_async_supabase_client():
    """Force reset of the async supabase client."""
    global _async_supabase_client
    if _async_supabase_client:
        logger.info("Resetting async Supabase client...")
        try:
            # Try to close explicitly if possible, though 'aclose' might not be exposed on Client directly
            # but usually the underlying http client should be closed.
            # safe fallback
            pass
        except Exception as e:
            logger.warning(f"Error closing Supabase client during reset: {e}")
        _async_supabase_client = None


def close_supabase_client():
    """Close Supabase client (for graceful shutdown)."""
    global _supabase_client
    if _supabase_client:
        logger.info("Closing Supabase client")
        _supabase_client = None

