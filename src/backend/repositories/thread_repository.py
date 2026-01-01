from typing import List, Optional, Dict, Any
from db.repositories.base_repository import BaseRepository

class ThreadRepository(BaseRepository):
    def __init__(self):
        super().__init__("threads")

    async def get_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch all active threads for a project, ordered by updated_at desc."""
        client = await self._get_client()
        # SOTA: Verified status filter and order
        query = client.table(self.table_name).select("*").eq("project_id", project_id).eq("status", "active").order("updated_at", desc=True)
        response = await self._execute(query)
        return response.data if response.data else []

    async def get_by_id(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single thread by ID."""
        client = await self._get_client()
        query = client.table(self.table_name).select("*").eq("id", thread_id).single()
        # SOTA: BaseRepository handles "0 rows" error now
        response = await self._execute(query)
        return response.data

    async def update_timestamp(self, thread_id: str):
        """SOTA: Keep thread 'alive' at top of list."""
        client = await self._get_client()
        await self._execute(
            client.table(self.table_name)
            .update({"updated_at": "now()"})
            .eq("id", thread_id)
        )

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new thread."""
        client = await self._get_client()
        query = client.table(self.table_name).insert(data)
        response = await self._execute(query)
        return response.data[0] if response.data else None

    async def delete(self, thread_id: str) -> bool:
        """Delete a thread."""
        client = await self._get_client()
        query = client.table(self.table_name).delete().eq("id", thread_id)
        response = await self._execute(query)
        return bool(response.data)
