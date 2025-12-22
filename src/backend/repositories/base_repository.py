import logging
import asyncio
from typing import Any, List, Dict, Optional, TypeVar, Generic
from db.supabase_client import get_async_supabase_client
from postgrest.base_request_builder import APIResponse

T = TypeVar('T')

logger = logging.getLogger(__name__)

class BaseRepository(Generic[T]):
    """
    Base Repository for Async Supabase interactions.
    Encapsulates retry logic for transient socket errors and standardizes logging.
    """
    
    def __init__(self, table_name: str):
        self.table_name = table_name

    async def _execute(self, query, max_retries=3, delay=0.5) -> APIResponse:
        """
        Execute a Supabase query with retry logic.
        """
        last_exception = None
        for attempt in range(max_retries):
            try:
                # Execute the query (awaitable)
                return await query.execute()
            except Exception as e:
                last_exception = e
                error_str = str(e).lower()
                # Check for socket/network errors (10035 = WSAEWOULDBLOCK, etc.)
                if "10035" in error_str or "sem bloqueio" in error_str or "socket" in error_str or "connection" in error_str:
                    if attempt < max_retries - 1:
                        logger.warning(f"Retrying Supabase query on '{self.table_name}' due to network error (attempt {attempt+1}/{max_retries}): {e}")
                        await asyncio.sleep(delay * (attempt + 1))
                        continue
                # If not a transient error, raise immediately
                logger.error(f"Query failed on '{self.table_name}': {e}", exc_info=True)
                raise e
        
        logger.error(f"Query failed on '{self.table_name}' after {max_retries} retries: {last_exception}")
        raise last_exception

    async def get_client(self):
        return await get_async_supabase_client()
