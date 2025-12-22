from typing import List, Optional, Dict, Any
from .base_repository import BaseRepository

class MessageRepository(BaseRepository):
    def __init__(self):
        super().__init__("messages")

    async def get_by_thread(self, thread_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch messages for a thread."""
        client = await self.get_client()
        query = client.table(self.table_name).select("*").eq("thread_id", thread_id).order("created_at", desc=False).limit(limit)
        response = await self._execute(query)
        return response.data if response.data else []

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a message."""
        client = await self.get_client()
        query = client.table(self.table_name).insert(data).single()
        response = await self._execute(query)
        return response.data

    async def update_status(self, message_id: str, status: str, content: Optional[str] = None) -> Dict[str, Any]:
        """Update message status and optionally content."""
        client = await self.get_client()
        payload = {"status": status}
        if content is not None:
            payload["content"] = content
            
        query = client.table(self.table_name).update(payload).eq("id", message_id).single()
        response = await self._execute(query)
        return response.data

    async def get_recent_history(self, thread_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Fetch the last N messages for a thread, ordered chronologically.
        Useful for Context Windows.
        """
        client = await self.get_client()
        # Fetch last N (descending) then reverse
        query = client.table(self.table_name).select("*").eq("thread_id", thread_id).order("created_at", desc=True).limit(limit)
        response = await self._execute(query)
        # Reverse to return chronological order (Oldest -> Newest)
        return response.data[::-1] if response.data else []
