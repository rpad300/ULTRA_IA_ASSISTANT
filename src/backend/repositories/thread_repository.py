from typing import List, Optional, Dict, Any
from .base_repository import BaseRepository

class ThreadRepository(BaseRepository):
    def __init__(self):
        super().__init__("threads")

    async def get_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch all threads for a project, ordered by updated_at desc."""
        client = await self.get_client()
        # Note: Supabase Python 'order' syntax might vary. using standard.
        query = client.table(self.table_name).select("*").eq("project_id", project_id).order("updated_at", desc=True)
        response = await self._execute(query)
        return response.data if response.data else []

    async def get_by_id(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single thread by ID."""
        client = await self.get_client()
        query = client.table(self.table_name).select("*").eq("id", thread_id).single()
        # Single returns error if not found? Or just data.
        # supabase-py often raises exception on .single() if not found.
        # We'll let BaseRepository retry transient errors, but 406/404 should be handled by caller or here.
        # For now, let's allow it to bubble up or wrap it? 
        # BaseRepository catches "Exception". 
        # Ideally we want to return None if not found, but .single() raises.
        try:
            response = await self._execute(query)
            return response.data
        except Exception as e:
            # Check if it is a "Result contains 0 rows" error
            if "contains 0 rows" in str(e) or "JSON object requested, multiple (or no) rows returned" in str(e):
                return None
            raise e

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new thread."""
        client = await self.get_client()
        query = client.table(self.table_name).insert(data).single()
        response = await self._execute(query)
        return response.data

    async def delete(self, thread_id: str) -> bool:
        """Delete a thread."""
        client = await self.get_client()
        query = client.table(self.table_name).delete().eq("id", thread_id)
        response = await self._execute(query)
        return bool(response.data)
