from typing import List, Optional
import logging
from fastapi import HTTPException
from datetime import datetime

from db.supabase_client import get_async_supabase_client
from db.models import ContactCreate, ContactUpdate, Contact

logger = logging.getLogger(__name__)

class ContactService:
    @staticmethod
    async def get_contacts(offset: int = 0, limit: int = 50) -> List[dict]:
        """Fetch all contacts."""
        supabase = await get_async_supabase_client()
        response = await (
            supabase.table("contacts")
            .select("*")
            .order("name")
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data if response.data else []

    @staticmethod
    async def get_contact_by_id(contact_id: str) -> Optional[dict]:
        """Get single contact."""
        supabase = await get_async_supabase_client()
        response = await supabase.table("contacts").select("*").eq("id", contact_id).execute()
        if not response.data:
            return None
        return response.data[0]

    @staticmethod
    async def create_contact(contact: ContactCreate) -> dict:
        """Create a new contact."""
        supabase = await get_async_supabase_client()
        
        # Deduplication Check (Email or Name)
        if contact.email:
            existing = await supabase.table("contacts").select("id").eq("email", contact.email).execute()
            if existing.data:
                 raise HTTPException(status_code=400, detail=f"Contact with email '{contact.email}' already exists")
        
        data = contact.model_dump()
        response = await supabase.table("contacts").insert(data).execute()
        
        if not response.data:
             raise HTTPException(status_code=400, detail="Failed to create contact")
             
        return response.data[0]

    @staticmethod
    async def update_contact(contact_id: str, contact: ContactUpdate) -> dict:
        """Update contact."""
        supabase = await get_async_supabase_client()
        data = {k: v for k, v in contact.model_dump().items() if v is not None}
        data["updated_at"] = datetime.now().isoformat()
        
        response = await supabase.table("contacts").update(data).eq("id", contact_id).execute()
        if not response.data:
             raise HTTPException(status_code=404, detail="Contact not found")
             
        return response.data[0]

    @staticmethod
    async def delete_contact(contact_id: str) -> bool:
        """Delete contact."""
        supabase = await get_async_supabase_client()
        response = await supabase.table("contacts").delete().eq("id", contact_id).execute()
        return bool(response.data)

    @staticmethod
    async def merge_contacts(primary_id: str, duplicate_ids: List[str]) -> bool:
        """Merge duplicates into primary contact."""
        if not duplicate_ids:
            return False
            
        supabase = await get_async_supabase_client()
        
        # 1. Reassign Messages
        await supabase.table("messages").update({"contact_id": primary_id}).in_("contact_id", duplicate_ids).execute()
        
        # 2. Reassign Tasks
        await supabase.table("tasks").update({"owner_contact_id": primary_id}).in_("owner_contact_id", duplicate_ids).execute()
        
        # 3. Delete Duplicates
        await supabase.table("contacts").delete().in_("id", duplicate_ids).execute()
        
        logger.info(f"Merged {len(duplicate_ids)} contacts into {primary_id}")
        return True

def get_contact_service():
    return ContactService()
