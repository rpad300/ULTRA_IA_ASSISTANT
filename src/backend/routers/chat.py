from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Depends, Response
from starlette.requests import Request
from typing import List, Dict, Any, Optional
from db.models import Thread, ThreadCreateRequest, Message, MessageCreate
from repositories.thread_repository import ThreadRepository
from repositories.message_repository import MessageRepository
from services.chat_logic import ChatService
from services.document_service import DocumentService
from dependencies.chat_deps import get_chat_service
from middleware.logging_context import get_request_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

# Dependencies
# In a real app we might use Depends(get_thread_repository) etc.
# For now we instantiate repos as needed or use service.

@router.post("/chat/upload")
async def upload_file_to_gemini(
    file: UploadFile = File(...), 
    doc_service: DocumentService = Depends(DocumentService)
):
    """
    SOTA File Upload:
    - Uses AsyncTempFile context manager for robust cleanup.
    - Offloads uploads to Gemini.
    """
    try:
        result = await doc_service.upload_for_gemini_analysis(
            await file.read(),
            file.filename,
            file.content_type
        )
        return result
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/threads", response_model=List[Dict[str, Any]])
async def get_threads(project_id: str, request: Request = None):
    """
    Get all threads for a project.
    Uses ThreadRepository.
    """
    request_id = get_request_id()
    logger.info(f"GET /projects/{project_id}/threads - Request ID: {request_id}")
    
    repo = ThreadRepository()
    try:
        threads = await repo.get_by_project(project_id)
        return threads
    except Exception as e:
        logger.error(f"Error fetching threads: {e}", exc_info=True, extra={"request_id": request_id})
        return []

@router.get("/threads/{thread_id}", response_model=Dict[str, Any])
async def get_thread(thread_id: str, request: Request = None):
    request_id = get_request_id()
    repo = ThreadRepository()
    try:
        thread = await repo.get_by_id(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        return thread
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching thread {thread_id}: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(status_code=500, detail="Internal Error")

@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, request: Request = None):
    request_id = get_request_id()
    repo = ThreadRepository()
    try:
        # Check existence first? (Repo delete might return count/bool, logic is in repo)
        # Our repo implementation returns bool(response.data)
        success = await repo.delete(thread_id)
        if not success:
             # Could be already deleted or not found.
             # Ideally we check first if we want 404, but for idempotency 200 is often fine.
             # Original code returned 404 if not found.
             # Let's check existence first if strictly needed, or just assume success.
             # Let's check existence to match original behavior.
             existing = await repo.get_by_id(thread_id)
             if not existing:
                 raise HTTPException(status_code=404, detail="Thread not found")
             # Try delete again? OR just return success if verify failed?
             # Wait, if delete returned False it likely didn't delete anything.
             raise HTTPException(status_code=404, detail="Thread not found/Delete failed")
             
        logger.info(f"Thread deleted: {thread_id}", extra={"request_id": request_id})
        return {"message": "Thread deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting thread: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(status_code=500, detail="Internal Error")

@router.post("/projects/{project_id}/threads", response_model=Dict[str, Any])
async def create_thread(project_id: str, thread: ThreadCreateRequest, request: Request = None):
    request_id = get_request_id()
    repo = ThreadRepository()
    
    # Needs company_id from project? 
    # Current Repo logic is raw. We should use `_fetch_project` logic or similar.
    # Or just generic `get_async_supabase_client` here for the project check?
    # Ideally `ProjectRepository`. Since we don't have it, we'll use a helper or ChatService helper?
    # ChatService has `_fetch_project`.
    # Let's do a quick raw check here using BaseRepository's client access or `ThreadRepository` helper?
    # I'll use `get_async_supabase_client` directly for this one specific check since we are in a router 
    # and avoiding "Repo Explosion" for Phase 1.
    from db.supabase_client import get_async_supabase_client
    
    try:
        sb = await get_async_supabase_client()
        
        # SOTA: Fetch Project AND Company info to determine Drive inheritance
        # 1. Get Project details
        p_res = await sb.table("projects").select("company_id, drive_folder_id").eq("id", project_id).single().execute()
        if not p_res.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        company_id = p_res.data["company_id"]
        project_drive_id = p_res.data.get("drive_folder_id")
        
        final_drive_id = project_drive_id
        
        # 2. If Project has no specific folder, check Company Root Folder
        if not final_drive_id:
             c_res = await sb.table("companies").select("drive_root_folder_id").eq("id", company_id).single().execute()
             if c_res.data:
                 final_drive_id = c_res.data.get("drive_root_folder_id")

        data = {
            "title": thread.title,
            "project_id": project_id,
            "company_id": company_id,
            "status": thread.status,
            "updated_at": "now()",
            "drive_folder_id": final_drive_id # SOTA: Inherit folder ID
        }
        if thread.profile_id: data["profile_id"] = thread.profile_id
        if thread.description: data["description"] = thread.description
        if thread.calendar_event_id: data["calendar_event_id"] = thread.calendar_event_id
        
        new_thread = await repo.create(data)
        logger.info(f"Thread created: {new_thread.get('id')}", extra={"request_id": request_id})
        return new_thread
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating thread: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(status_code=500, detail="Internal Error")

@router.get("/threads/{thread_id}/messages", response_model=List[Dict[str, Any]])
async def get_messages(thread_id: str, request: Request = None):
    request_id = get_request_id()
    repo = MessageRepository()
    try:
        return await repo.get_by_thread(thread_id)
    except Exception as e:
        logger.error(f"Error getting messages: {e}", exc_info=True, extra={"request_id": request_id})
        return []

@router.post("/threads/{thread_id}/messages", response_model=Dict[str, Any])
async def send_message(
    thread_id: str, 
    message: MessageCreate, 
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    SOTA Message Send:
    - Delegates to ChatService (shared singleton).
    - Service handles persistence, broadcast, and AI trigger.
    """
    try:
        # We need validation of thread existence/context?
        # ChatService fails if thread not found? 
        # Actually ChatService `handle_user_message` upserts or inserts.
        # But we want to return the saved message.
        # `handle_user_message` currently returns None (void).
        # We should update `chat_logic.py` to return the saved message!
        # or we assume we can construct it.
        # Let's inspect `chat_logic.py` again.
        # `saved_msg = await self.message_repo.create(msg_data)` -> it has the data.
        # But `handle_user_message` doesn't return it.
        # Refactor: I'll accept this limitation for a moment and just fetch it back or Update service to return it.
        # BUT I can't update service inside this tool call.
        # I will start a background task or just create it here?
        # No, "Decoupling Send and Generate".
        # The ROUTER should invoke `service.handle_user_message`.
        # If I want the returned message for the UI, I should probably utilize the fact that `message.create` returns it.
        
        # Implementation Detail: I should Update `chat_logic.py` to return the message.
        # But `chat_service.handle_user_message` Logic:
        # 1. Save
        # 2. Broadcast
        # 3. AI
        
        # It's better if `handle_user_message` returns the `saved_msg`.
        # I will update `chat_logic.py` in a subsequent step if needed, or assume it works effectively.
        # Wait, I already updated `chat_logic.py` earlier and I saw the code.
        # `async def handle_user_message(...)`: returns implicit None.
        
        # FOR NOW: I will just call it.
        # But the frontend expects the returned message object (for ID).
        # So I really DO need the return value.
        # I cannot edit `chat_logic.py` inside this `write_to_file`.
        # I will modify logic here to:
        # 1. Save (using repo directly here).
        # 2. Call service for Broadcast + AI.
        # OR
        # Update Service FIRST.
        
        # I'll choose: Update Service FIRST (it's cleaner).
        # So I will pause writing this file, update `chat_logic.py`, then write this file.
        # BUT I am already in the `write_to_file` call params generation...
        # I can just implement it using Repo here for now to be safe and adhere to "Thin Router" later, or...
        # Actually, if I use Repo here, I duplicate "Save" logic.
        # `ChatService.handle_user_message` does: Save -> Broadcast -> AI.
        # If I do Save here, then call `ChatService.handle_user_message`, it will Save AGAIN (Duplicate!).
        
        # Solution: I will `write_to_file` a placeholder compatible version, 
        # THEN update Service to return msg, 
        # THEN update Router? 
        # No, too many steps.
        
        # Correct path: Update Service NOW. Then write router.
        # I must abort this tool call? No, I can't.
        # I'll return a stub in this router for `send_message` that raises 501, 
        # Update service, then Fix router.
        # OR better: I write the router assuming `chat_service.handle_user_message` RETURNS the message.
        # Then I go and update `chat_logic.py` to actually return it.
        # Python won't check types at runtime until called.
        
        # So: Write Router (assuming return) -> Update Service (to return).
        
        result = await chat_service.handle_user_message(thread_id, message.content, message.role)
        
        if not result:
             # Fallback if service returns None (before update)
             return {"content": message.content, "role": message.role, "status": "pending"}
             
        return result

    except Exception as e:
        logger.error(f"Send message failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
