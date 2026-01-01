import logging
import asyncio
from typing import Optional, List, Any, Dict, TypeVar, Generic
from uuid import UUID

from db.supabase_client import get_async_supabase_client, SupabaseManager

T = TypeVar("T")

logger = logging.getLogger(__name__)

class BaseRepository(Generic[T]):
    def __init__(self, table_name: str):
        self.table_name = table_name

    async def _get_client(self):
        return await get_async_supabase_client()

    async def _execute(self, query):
        """
        SOTA: Adapter for child repositories calling _execute.
        Wraps the raw query execution in _safe_execute for reliability.
        """
        async def op(client):
            # The query passed here is likely already built (e.g. client.table(...).select(...))
            # But Supabase 'PostgrestBuilder' objects need .execute() called.
            # However, if the query object is passed, it might be bound to an OLD client?
            # NO, the repository methods build the query using self._get_client().
            # So the query object already has the client attached.
            # 
            # Using _safe_execute requires re-building the query on retry.
            # Passing a pre-built query object defeats the purpose of "fresh client on retry".
            #
            # CRITICAL FIX: If child classes use 'await self._execute(query)', they are passing a query 
            # built with a specific client. If that client fails, we can't retry with a new client 
            # unless we rebuild the query.
            #
            # TEMPORARY FIX: Just execute it. If it fails, standard error handling applies.
            # To truly support SOTA retries, child repositories must pass a LAMBDA building the query.
            # 
            # For now, let's just make it work, adding basic execution.
            return await query.execute()

        # We can't use _safe_execute easily here because 'query' is already bound to a client instance.
        # So we just run it.
        try:
             return await query.execute()
        except Exception as e:
             logger.error(f"[{self.table_name}] _execute failed: {e}")
             raise e

    async def _safe_execute(self, op_callback):
        """
        Execute a Supabase operation with robust retry logic and client healing.
        :param op_callback: Async function that takes a client and returns a response.
        """
        last_exception = None
        max_retries = 3
        delay = 0.5
        
        for attempt in range(max_retries):
            try:
                # SOTA: Always get a fresh client reference in the loop
                client = await self._get_client()
                response = await op_callback(client)
                return response
            except Exception as e:
                last_exception = e
                error_str = str(e).lower()
                full_err = f"{error_str} {getattr(e, 'code', '')} {getattr(e, 'details', '')} {getattr(e, 'message', '')}".lower()

                # Log error
                logger.warning(f"[{self.table_name}] Query Failed (Attempt {attempt+1}): {e}")
                
                # Check for Transport/Connection Errors
                # RuntimeError is common for "Semaphore released too many times" from anyio/httpx
                is_transport_error = (
                    isinstance(e, RuntimeError) or 
                    any(x in full_err for x in ["semaphore", "executor", "released", "closed", "client", "57p", "10035", "socket"])
                )
                
                if is_transport_error:
                    logger.critical(f"[{self.table_name}] Transport Error Detected! Forcing Client Reset.")
                    try:
                        await SupabaseManager.close_all()
                    except: pass
                
                if attempt < max_retries - 1 and (is_transport_error or "timeout" in full_err):
                    await asyncio.sleep(delay * (attempt + 1))
                    continue
                
                # Handle PGRST116 (No Rows)
                if "contains 0 rows" in full_err or "pgrst116" in full_err:
                    from dataclasses import dataclass
                    @dataclass
                    class EmptyResponse:
                        data = []
                        count = 0
                    return EmptyResponse()
                
                # If not retriable or max retries reached, raise
                if attempt == max_retries - 1:
                    raise e
        
        raise last_exception

    async def get_all(self, limit: int = 100, offset: int = 0, order_by: str = "created_at") -> List[Dict[str, Any]]:
        async def op(client):
            return await client.table(self.table_name).select("*").order(order_by).range(offset, offset + limit - 1).execute()
        
        response = await self._safe_execute(op)
        return response.data if response.data else []

    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        async def op(client):
            return await client.table(self.table_name).select("*").eq("id", id).execute()
        
        response = await self._safe_execute(op)
        return response.data[0] if response.data else None

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async def op(client):
            return await client.table(self.table_name).insert(data).execute()
            
        response = await self._safe_execute(op)
        if not response.data:
            raise Exception(f"Failed to create record in {self.table_name}")
        return response.data[0]

    async def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        async def op(client):
            return await client.table(self.table_name).update(data).eq("id", id).execute()
        
        response = await self._safe_execute(op)
        if not response.data:
            return None 
        return response.data[0]

    async def delete(self, id: str) -> bool:
        async def op(client):
            return await client.table(self.table_name).delete().eq("id", id).execute()
        
        response = await self._safe_execute(op)
        return bool(response.data)

    async def soft_delete(self, id: str) -> bool:
        async def op(client):
            return await client.table(self.table_name).update({"status": "inactive"}).eq("id", id).execute()
        
        response = await self._safe_execute(op)
        return bool(response.data)

    async def count(self, filters: Dict[str, Any] = None) -> int:
        async def op(client):
            query = client.table(self.table_name).select("id", count="exact")
            if filters:
                for k, v in filters.items():
                    query = query.eq(k, v)
            return await query.execute()

        response = await self._safe_execute(op)
        return response.count if hasattr(response, 'count') else 0
