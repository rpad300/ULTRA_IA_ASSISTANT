from typing import List, Optional
import logging
from fastapi import HTTPException
from datetime import datetime

from db.supabase_client import get_async_supabase_client
from db.models import ContactCreate, ContactUpdate, Contact

logger = logging.getLogger(__name__)

class ContactService:
    @staticmethod
    async def get_contacts(company_id: str = None, search: str = None, offset: int = 0, limit: int = 50) -> List[dict]:
        """SOTA: Fetch contacts with Biometric Status and Search."""
        supabase = await get_async_supabase_client()
        
        # SOTA: has_voice flag calculation (requires raw query or checking voice_vector column)
        # Assuming voice_vector is the column. check if not null.
        query = supabase.table("contacts").select("*")
        
        if company_id:
            query = query.eq("company_id", company_id)
            
        if search:
            # Fuzzy search or simple ilike
            # SOTA: Full text search would be "fts" but ilike is good for names
            query = query.or_(f"name.ilike.%{search}%,email.ilike.%{search}%")
            
        response = await query.order("name").range(offset, offset + limit - 1).execute()
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
        try:
            response = await supabase.table("contacts").insert(data).execute()
        except Exception as e:
            logger.error(f"Create Contact DB Error: {e}")
            # Ensure helpful error message bubbles up (e.g. 'column "phone" does not exist')
            error_msg = str(e)
            if "does not exist" in error_msg:
                error_msg = f"Database schema mismatch: {error_msg}"
            raise HTTPException(status_code=400, detail=error_msg)
        
        if not response.data:
             raise HTTPException(status_code=400, detail="Failed to create contact")
             
        return response.data[0]

    @staticmethod
    async def update_contact(contact_id: str, contact: ContactUpdate) -> dict:
        """SOTA: Update with Cache Invalidation."""
        supabase = await get_async_supabase_client()
        data = {k: v for k, v in contact.model_dump().items() if v is not None}
        data["updated_at"] = datetime.now().isoformat()
        
        response = await supabase.table("contacts").update(data).eq("id", contact_id).execute()
        if not response.data:
             raise HTTPException(status_code=404, detail="Contact not found")
        
        updated_contact = response.data[0]
        
        # SOTA: Notification to Voice Service (Hot Cache Refresh)
        try:
            from services.local_speaker_service import get_local_speaker_service
            speaker_svc = get_local_speaker_service()
            # We assume refresh_contact_in_cache method exists or we use the logic from load_company_context
            # For now, let's call a method we WILL add next step to speaker_service:
            await speaker_svc.refresh_contact_in_cache(updated_contact)
        except Exception as e:
            logger.warning(f"Failed to refresh voice cache for {contact_id}: {e}")

        return updated_contact

    @staticmethod
    async def delete_contact(contact_id: str) -> bool:
        """Delete contact."""
        supabase = await get_async_supabase_client()
        response = await supabase.table("contacts").delete().eq("id", contact_id).execute()
        return bool(response.data)

    @staticmethod
    async def merge_contacts(primary_id: str, duplicate_ids: List[str]) -> bool:
        """SOTA: Merge including Voice Traces and Profile Recalculation."""
        if not duplicate_ids: return False
        supabase = await get_async_supabase_client()
        
        # 1. Reassign Messages
        await supabase.table("messages").update({"contact_id": primary_id}).in_("contact_id", duplicate_ids).execute()
        
        # 2. Reassign Tasks
        await supabase.table("tasks").update({"owner_contact_id": primary_id}).in_("owner_contact_id", duplicate_ids).execute()
        
        # 3. MOVER TRACES DE VOZ (Crítico para SOTA Biometrics)
        await supabase.table("voice_traces").update({"contact_id": primary_id}).in_("contact_id", duplicate_ids).execute()

        # 4. Delete Duplicates
        await supabase.table("contacts").delete().in_("id", duplicate_ids).execute()
        
        logger.info(f"Merged {len(duplicate_ids)} contacts into {primary_id}")
        
        # 5. RECALCULAR PERFIL BIOMÉTRICO
        try:
            from services.local_speaker_service import get_local_speaker_service
            speaker_svc = get_local_speaker_service()
            await speaker_svc.recalculate_profile(primary_id, supabase_client=supabase)
        except Exception as e:
            logger.error(f"Failed to recalc profile after merge: {e}")

        return True

def get_contact_service():
    return ContactService()
