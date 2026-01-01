from typing import List, Optional, Dict, Any
from db.repositories.base_repository import BaseRepository

class MessageRepository(BaseRepository):
    def __init__(self):
        super().__init__("messages")

    async def get_by_thread(self, thread_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch messages for a thread."""
        client = await self._get_client()
        query = client.table(self.table_name).select("*").eq("thread_id", thread_id).order("created_at", desc=False).limit(limit)
        response = await self._execute(query)
        return response.data if response.data else []

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a message."""
        client = await self._get_client()
        query = client.table(self.table_name).insert(data)
        response = await self._execute(query)
        return response.data[0] if response.data else None

    async def update_status(self, message_id: str, status: str, content: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """SOTA: Update message status and content with atomic updated_at and schema fallback."""
        client = await self._get_client()
        payload = {
            "status": status,
            "updated_at": "now()" 
        }
        if content is not None:
            payload["content"] = content
            
        try:
            # Try full SOTA update (optimistic)
            query = client.table(self.table_name).update(payload).eq("id", message_id)
            response = await self._execute(query)
            return response.data[0] if response.data else None
        except Exception as e:
            error_str = str(e).lower()
            # Adaptive Fallback: If 'status' or 'updated_at' missing, downgrade to content update
            if "could not find the" in error_str and "column" in error_str:
                 if content:
                     # Fallback: Just update content (essential for chat)
                     from logging import getLogger
                     logger = getLogger(__name__)
                     logger.warning(f"Schema Mismatch (Missing Columns): Downgrading update for {message_id}")
                     
                     query = client.table(self.table_name).update({"content": content}).eq("id", message_id)
                     response = await self._execute(query)
                     return response.data[0] if response.data else None
                 else:
                     # Status-only update failed and no content? Nothing to save.
                     return None
            raise e

    async def get_recent_history(self, thread_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Fetch the last N messages for a thread, ordered chronologically.
        Useful for Context Windows.
        """
        client = await self._get_client()
        # Fetch last N (descending) then reverse
        query = client.table(self.table_name).select("*").eq("thread_id", thread_id).order("created_at", desc=True).limit(limit)
        response = await self._execute(query)
        # Reverse to return chronological order (Oldest -> Newest)
        return response.data[::-1] if response.data else []

    async def get_messages_before(self, thread_id: str, before_timestamp: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        SOTA: Cursor-based pagination for infinite scroll.
        Fetches messages older than a specific timestamp.
        """
        client = await self._get_client()
        query = (client.table(self.table_name)
                 .select("*")
                 .eq("thread_id", thread_id)
                 .lt("created_at", before_timestamp) # Cursor-based
                 .order("created_at", desc=True)
                 .limit(limit))
        response = await self._execute(query)
        return response.data if response.data else []
