import logging
import asyncio
from typing import Optional, List, Any, Dict, TypeVar, Generic
from uuid import UUID

from db.supabase_client import get_async_supabase_client, reset_async_supabase_client

T = TypeVar("T")

logger = logging.getLogger(__name__)

class BaseRepository(Generic[T]):
    def __init__(self, table_name: str):
        self.table_name = table_name

    async def _get_client(self):
        return await get_async_supabase_client()

    async def _execute(self, query, max_retries=3, delay=0.5):
        """
        Execute Supabase query with centralized retry logic for transient network errors.
        This replaces the old 'execute_with_retry' helper.
        """
        last_exception = None
        for attempt in range(max_retries):
            try:
                response = await query.execute()
                return response
            except Exception as e:
                last_exception = e
                error_str = str(e).lower()
                # Retry on socket/connection errors
                if "10035" in error_str or "sem bloqueio" in error_str or "socket" in error_str or "client" in error_str:
                    if attempt < max_retries - 1:
                        logger.warning(f"Retrying {self.table_name} query (attempt {attempt+1}/{max_retries}): {e}")
                        # If it's a client state issue, try determining if reset is needed
                        if "client" in error_str or "closed" in error_str:
                             await reset_async_supabase_client()
                        await asyncio.sleep(delay * (attempt + 1))
                        continue
                raise e
        raise last_exception

    async def get_all(self, limit: int = 100, offset: int = 0, order_by: str = "created_at") -> List[Dict[str, Any]]:
        client = await self._get_client()
        query = client.table(self.table_name).select("*").order(order_by).range(offset, offset + limit - 1)
        response = await self._execute(query)
        return response.data if response.data else []

    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        client = await self._get_client()
        query = client.table(self.table_name).select("*").eq("id", id)
        response = await self._execute(query)
        return response.data[0] if response.data else None

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        client = await self._get_client()
        query = client.table(self.table_name).insert(data)
        response = await self._execute(query)
        if not response.data:
            raise Exception(f"Failed to create record in {self.table_name}")
        return response.data[0]

    async def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        client = await self._get_client()
        query = client.table(self.table_name).update(data).eq("id", id)
        response = await self._execute(query)
        if not response.data:
             # Could be 404 or just no update needed? Assume strict
             return None 
        return response.data[0]

    async def delete(self, id: str) -> bool:
        client = await self._get_client()
        query = client.table(self.table_name).delete().eq("id", id)
        response = await self._execute(query)
        return bool(response.data)

    async def soft_delete(self, id: str) -> bool:
        """Standard soft delete setting status='inactive'."""
        client = await self._get_client()
        query = client.table(self.table_name).update({"status": "inactive"}).eq("id", id)
        response = await self._execute(query)
        return bool(response.data)

    async def count(self, filters: Dict[str, Any] = None) -> int:
        client = await self._get_client()
        query = client.table(self.table_name).select("id", count="exact")
        if filters:
            for k, v in filters.items():
                query = query.eq(k, v)
        response = await self._execute(query)
        return response.count if hasattr(response, 'count') else 0
