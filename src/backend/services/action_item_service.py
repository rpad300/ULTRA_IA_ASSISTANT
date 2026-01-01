
import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict
from db.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

class ActionItemService:
    def __init__(self):
        self.supabase = get_supabase_client()

    async def create_action_item(self, description: str, session_id: str, author_name: str, company_id: str) -> Optional[Dict]:
        """
        Creates a new action item (task) in the database.
        """
        try:
            # We assume a 'tasks' or 'action_items' table exists. 
            # If not, we might need to create it or stick to a simple schema.
            # Standard columns: id, description, status, session_id, created_at, assigned_to
            
            task_data = {
                "description": description,
                "session_id": session_id,
                "status": "pending", 
                "company_id": company_id,
                # "source": "oracle_intervention", # Column missing
                # "created_by": author_name, # Column missing in DB
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Using 'tasks' table
            res = self.supabase.table("tasks").insert(task_data).execute()
            
            if res.data:
                logger.info(f"Action Item Created: {description[:30]}...")
                return res.data[0]
            
        except Exception as e:
            logger.error(f"Failed to create action item: {e}")
            return None

    async def get_session_tasks(self, session_id: str) -> List[Dict]:
        try:
            res = self.supabase.table("tasks").select("*").eq("session_id", session_id).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Failed to fetch session tasks: {e}")
            return []

_action_item_service = None

def get_action_item_service():
    global _action_item_service
    if _action_item_service is None:
        _action_item_service = ActionItemService()
    return _action_item_service
