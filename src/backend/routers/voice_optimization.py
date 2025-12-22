

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request, status
from pydantic import BaseModel
import logging
from services.local_speaker_service import LocalSpeakerService, get_local_speaker_service
from middleware.auth import get_current_user
from db.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/voice", tags=["voice-optimization"])
logger = logging.getLogger(__name__)

class AssignSpeakerRequest(BaseModel):
    trace_id: str
    contact_id: str

@router.post("/assign", status_code=status.HTTP_202_ACCEPTED)
async def assign_speaker_trace(
    req: AssignSpeakerRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    svc: LocalSpeakerService = Depends(get_local_speaker_service)
):
    """
    Manually assigns a cached voice trace to a contact.
    Triggers optimization (Active Learning) in background.
    """
    try:
        # 1. Multi-tenancy Validation (Security)
        # Ensure contact belongs to the user's company
        company_ids = current_user.get("company_ids", [])
        if not company_ids:
             # If no company, strict block (unless dev)
             raise HTTPException(status_code=403, detail="User not associated with any company")

        supabase = get_supabase_client()
        res = supabase.table("contacts").select("company_id, name").eq("id", req.contact_id).single().execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Contact not found")
            
        contact_company_id = res.data.get("company_id")
        contact_name = res.data.get("name")
        
        if contact_company_id not in company_ids:
             logger.warning(f"Unauthorized voice assignment attempt by {current_user.get('user_id')}")
             raise HTTPException(status_code=403, detail="Unauthorized: Contact belongs to another company")

        # 2. Check Trace Existence (Fast Fail)
        # We check if trace exists in DB (not memory cache anymore)
        trace = await svc.get_cached_trace(req.trace_id)
        if trace is None:
             raise HTTPException(status_code=404, detail=f"Trace ID {req.trace_id} not found or expired.")

        # 3. Queue Background Optimization (SOTA Pattern)
        # This keeps the UI responsive
        background_tasks.add_task(svc.assign_speaker_trace, req.trace_id, req.contact_id)
        
        return {
            "status": "accepted", 
            "message": f"Optimization queued for {contact_name}", 
            "trace_id": req.trace_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error queuing optimization: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

