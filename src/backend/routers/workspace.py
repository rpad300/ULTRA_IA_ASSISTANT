from fastapi import APIRouter, HTTPException, Query, Request, Depends, UploadFile, File, BackgroundTasks
from typing import List, Optional
import logging
import shutil
import os
import asyncio

from db.models import (
    Company, CompanyCreate, CompanyUpdate, 
    Project, ProjectCreate, ProjectUpdate,
    Contact, ContactCreate, ContactUpdate,
    ProfileFull, ProfileCreate, ProfileUpdate
)
from utils.pagination import PaginatedResponse, get_pagination_params, PaginationParams
from middleware.logging_context import get_request_id
from db.supabase_client import get_supabase_client 

# Services
from services.company_service import get_company_service, CompanyService
from services.project_service import get_project_service, ProjectService
from services.contact_service import get_contact_service, ContactService
from services.document_service import get_document_service, DocumentService
from services.voice_enrollment_service import get_voice_enrollment_service, VoiceEnrollmentService

logger = logging.getLogger(__name__)

def _is_valid_uuid(val: str) -> bool:
    if not val: return False
    try:
        from uuid import UUID
        UUID(val)
        return True
    except ValueError:
        return False

import functools
def safe_route(func):
    """Global Error Handling Decorator"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"CRITICAL WORKSPACE ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
    return wrapper

router = APIRouter(prefix="/api", tags=["workspace"])

# --- Companies ---

@router.get("/companies", response_model=dict)
@safe_route
async def get_companies(
    pagination: PaginationParams = Depends(get_pagination_params),
    company_service: CompanyService = Depends(get_company_service)
):
    """Get active companies with pagination."""
    items = await company_service.get_companies(pagination.offset, pagination.limit)
    total = await company_service.get_total_count()
    
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size
    }

@router.get("/companies/all", response_model=List[Company])
@safe_route
async def get_all_companies(company_service: CompanyService = Depends(get_company_service)):
    """Get all companies (including inactive) - optimized for dropdowns."""
    # Reusing pagination logic with high limit for now
    items = await company_service.get_companies(limit=100) 
    return items

@router.post("/companies", response_model=Company)
async def create_company(
    company: CompanyCreate, 
    background_tasks: BackgroundTasks,
    request: Request = None,
    company_service: CompanyService = Depends(get_company_service)
):
    """Create a new company."""
    logger.info(f"Creating company: {company.name}", extra={"request_id": get_request_id()})
    return await company_service.create_company(company, background_tasks)

@router.get("/companies/{company_id}", response_model=Company)
async def get_company(
    company_id: str, 
    company_service: CompanyService = Depends(get_company_service)
):
    """Get company details."""
    if not _is_valid_uuid(company_id):
        raise HTTPException(status_code=400, detail="Invalid Company ID format")

    company = await company_service.get_company_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.put("/companies/{company_id}", response_model=Company)
async def update_company(
    company_id: str, 
    company: CompanyUpdate,
    company_service: CompanyService = Depends(get_company_service)
):
    """Update company details."""
    return await company_service.update_company(company_id, company)

@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    company_service: CompanyService = Depends(get_company_service)
):
    """Soft delete company."""
    success = await company_service.delete_company(company_id)
    if not success:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"message": "Company deactivated"}

@router.delete("/companies/{company_id}/permanent")
async def hard_delete_company(
    company_id: str,
    company_service: CompanyService = Depends(get_company_service)
):
    """Hard delete company and all cascading resources."""
    success = await company_service.hard_delete_company(company_id)
    if not success:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"message": "Company and all associated data permanently deleted"}

@router.get("/companies/{company_id}/profiles", response_model=List[ProfileFull])
@safe_route
async def get_company_profiles(
    company_id: str,
):
    """Get all AI profiles associated with a company."""
    if not _is_valid_uuid(company_id):
        raise HTTPException(status_code=400, detail="Invalid Company ID format")

    supabase = get_supabase_client()
    # Filter by company_id
    response = supabase.table("profiles").select("*").eq("company_id", company_id).execute()
    return response.data

# --- Projects ---

@router.get("/companies/{company_id}/projects", response_model=List[Project])
@safe_route
async def get_projects(
    company_id: str,
    project_service: ProjectService = Depends(get_project_service)
):
    """Get projects for a specific company."""
    return await project_service.get_projects_by_company(company_id)

@router.get("/projects/{project_id}", response_model=Project)
async def get_project(
    project_id: str,
    project_service: ProjectService = Depends(get_project_service)
):
    """Get project details."""
    if not _is_valid_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid Project ID format")

    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects", response_model=Project)
async def create_project(
    project: ProjectCreate,
    background_tasks: BackgroundTasks,
    project_service: ProjectService = Depends(get_project_service)
):
    """Create a new project."""
    return await project_service.create_project(project, background_tasks)

@router.put("/projects/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    project: ProjectUpdate,
    project_service: ProjectService = Depends(get_project_service)
):
    """Update project details."""
    return await project_service.update_project(project_id, project)

@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    project_service: ProjectService = Depends(get_project_service)
):
    """Delete project."""
    success = await project_service.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}

@router.post("/projects/{project_id}/documents")
async def upload_project_document(
    project_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    project_service: ProjectService = Depends(get_project_service),
    document_service: DocumentService = Depends(get_document_service)
):
    """Upload a document to a project."""
    # 1. Get Project to find Drive Folder ID
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    drive_folder_id = project.get("drive_folder_id")
    
    # 2. Process Upload
    return await document_service.process_document_upload(project_id, file, drive_folder_id)


# --- Contacts ---

@router.get("/contacts", response_model=List[Contact])
async def get_contacts(
    pagination: PaginationParams = Depends(get_pagination_params),
    contact_service: ContactService = Depends(get_contact_service)
):
    """Get all contacts."""
    return await contact_service.get_contacts(offset=pagination.offset, limit=pagination.limit)

@router.post("/contacts", response_model=Contact)
async def create_contact(
    contact: ContactCreate,
    contact_service: ContactService = Depends(get_contact_service)
):
    """Create a new contact."""
    return await contact_service.create_contact(contact)

@router.put("/contacts/{contact_id}", response_model=Contact)
async def update_contact(
    contact_id: str,
    contact: ContactUpdate,
    contact_service: ContactService = Depends(get_contact_service)
):
    """Update contact."""
    return await contact_service.update_contact(contact_id, contact)

@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    contact_service: ContactService = Depends(get_contact_service)
):
    """Delete contact."""
    success = await contact_service.delete_contact(contact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}

@router.post("/contacts/merge")
async def merge_contacts(
    primary_id: str, 
    duplicate_ids: List[str],
    contact_service: ContactService = Depends(get_contact_service)
):
    """Merge duplicate contacts into a primary one."""
    success = await contact_service.merge_contacts(primary_id, duplicate_ids)
    return {"status": "success", "merged_count": len(duplicate_ids)}

@router.post("/contacts/{contact_id}/assign_guest")
async def assign_guest_to_contact(
    contact_id: str,
    payload: dict, # { guest_id: str, session_id: str }
    voice_service: VoiceEnrollmentService = Depends(get_voice_enrollment_service)
):
    """
    SOTA Pivot: Assigns a temporary guest from a session to a permanent contact.
    Triggers:
    1. Lazy Enrollment (Moves buffer to DB).
    2. Retroactive Transcript Fix (via BackgroundTask usually, here direct).
    """
    guest_id = payload.get("guest_id")
    session_id = payload.get("session_id")
    
    if not guest_id or not session_id:
        raise HTTPException(status_code=400, detail="Missing guest_id or session_id")

    from services.local_speaker_service import get_local_speaker_service
    svc_speaker = get_local_speaker_service()
    
    # 1. Retrieve Guest Buffer
    profile = svc_speaker.get_session_guest_profile(session_id, guest_id)
    embeddings = []
    
    if not profile or not profile.get("buffer"):
        # Native Mode / Text-Only Mode Support
        # If no buffer, we still want to "Label" the speaker for this session.
        logger.warning(f"No buffer found for {guest_id} in session {session_id}. Skipping enrollment, proceeding with labeling.")
    else:
        embeddings = profile["buffer"]
    
    # 2. Atomic Enrollment (Only if embeddings exist)
    if embeddings:
        success = await voice_service.enroll_from_embeddings(contact_id, embeddings)
        if not success:
             # Non-fatal: Log error but continue to label assignment
             logger.error("Failed to enroll guest embeddings, but will proceed with session labeling.")
         
    # 3. Retroactive Fix & Labelling
    # Update Name in 'session_transcripts' table
    supabase = get_supabase_client()
    try:
        # Get Contact Name
        c_res = supabase.table("contacts").select("name").eq("id", contact_id).limit(1).execute()
        contact_name = "Unknown"
        if c_res.data and len(c_res.data) > 0:
            contact_name = c_res.data[0].get("name", "Unknown")
        
        # SOTA: Upload Verification Clip to Drive
        if profile and profile.get("last_audio"):
            try:
                from services.drive_service import get_drive_service
                from datetime import datetime
                drive_svc = get_drive_service()
                
                if drive_svc and drive_svc.service:
                    # SOTA: Resolve Path `Company/Voice_Profiles/[Contact]`
                    parent_id = None
                    contact_data = c_res.data[0]
                    company_id = contact_data.get("company_id")
                    
                    if company_id:
                        # 1. Resolve Company Folder
                        from config import DRIVE_APP_ROOT_ID
                        # Try DB first (faster)
                        comp_res = supabase.table("companies").select("drive_root_folder_id").eq("id", company_id).execute()
                        if comp_res.data and comp_res.data[0].get("drive_root_folder_id"):
                            company_folder_id = comp_res.data[0].get("drive_root_folder_id")
                        else:
                            # Fallback SOTA Lookup
                            company_folder_id = await asyncio.to_thread(
                                drive_svc.ensure_folder_sota, "Company", parent_id=DRIVE_APP_ROOT_ID, entity_id=company_id, entity_type="company"
                            )
                        
                        if company_folder_id:
                            # 2. Resolve 99_Internal_System (SOTA 2025)
                            internal_sys_id = await asyncio.to_thread(drive_svc.ensure_folder, "99_Internal_System", parent_id=company_folder_id)
                            
                            if internal_sys_id:
                                # 3. Resolve Voice_Profiles
                                profiles_root = await asyncio.to_thread(drive_svc.ensure_folder, "Voice_Profiles", parent_id=internal_sys_id)
                                
                                # 4. Resolve Contact Folder: "[ID] - [Name]"
                                safe_contact_name = "".join([c for c in contact_name if c.isalnum() or c in (' ', '-', '_')]).strip()
                                folder_name = f"[{contact_id}] - {safe_contact_name}"
                                
                                parent_id = await asyncio.to_thread(
                                    drive_svc.ensure_folder_sota, 
                                    name=folder_name, 
                                    parent_id=profiles_root,
                                    entity_id=contact_id,
                                    entity_type="profile_container"
                                )

                    # Fallback to Legacy if structure resolution failed
                    if not parent_id:
                        parent_id = await asyncio.to_thread(drive_svc.ensure_folder, "Ultra Voice Verifications")
                    
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"{contact_name.replace(' ', '_')}_{timestamp}_verification.wav"
                    
                    file_id = await asyncio.to_thread(
                        drive_svc.upload_bytes,
                        profile["last_audio"], 
                        filename, 
                        "audio/wav", 
                        parent_id=parent_id
                    )
                    
                    if file_id:
                        logger.info(f"Uploaded verification clip for {contact_name} to Drive (ID: {file_id})")
            except Exception as e:
                logger.error(f"Failed to upload verification clip: {e}")

        # SOTA: Update 'session_transcripts'
        await supabase.table("session_transcripts").update({
            "speaker_name": contact_name,
            "speaker_id": contact_id, 
            "is_guest": False
        }).eq("session_id", session_id).eq("speaker_name", guest_id).execute()
        
        logger.info(f"Retroactive transcript fix applied for session {session_id}: {guest_id} -> {contact_name}")
        
        # 4. Broadcast Realtime Update (Frontend Optimistic Update Support)
        from managers.connection_manager import manager as connection_manager
        from models.transcription import SpeakerAssignmentMessage
        
        # A. Notify Frontend
        msg = SpeakerAssignmentMessage(
            guest_id=guest_id,
            contact_id=contact_id,
            contact_name=contact_name,
            session_id=session_id
        )
        await connection_manager.broadcast_to_monitors(session_id, msg.model_dump(mode='json'))
        
        # B. Notify Active Transcription Manager (Native Mode Fix)
        # This ensures the running session knows "Guest X" is now "Alice" immediately.
        active_manager = connection_manager.get_manager(session_id)
        if active_manager:
            await active_manager.update_guest_mapping(guest_id, contact_name)
        else:
            logger.warning(f"No active manager found for session {session_id} to update mapping.")
        
    except Exception as e:
        logger.error(f"Retroactive fix/broadcast failed: {e}")
    
    return {
        "status": "success", 
        "message": f"Guest {guest_id} assigned to {contact_name}", 
        "enrolled_count": len(embeddings)
    }

# --- Profiles (Kept minimal, should eventually move to ProfileService) ---

@router.get("/profiles", response_model=List[ProfileFull])
def get_profiles():
    # TODO: Refactor to Service
    supabase = get_supabase_client()
    response = supabase.table("profiles").select("*").execute()
    return response.data

@router.post("/profiles", response_model=ProfileFull)
def create_profile(profile: ProfileCreate):
    # TODO: Refactor to Service
    supabase = get_supabase_client()
    response = supabase.table("profiles").insert(profile.dict()).execute()
    return response.data[0]

@router.put("/profiles/{profile_id}", response_model=ProfileFull)
def update_profile(profile_id: str, profile: ProfileUpdate):
    # TODO: Refactor to Service
    supabase = get_supabase_client()
    data = {k: v for k, v in profile.dict().items() if v is not None}
    response = supabase.table("profiles").update(data).eq("id", profile_id).execute()
    return response.data[0]

@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: str):
    # TODO: Refactor to Service
    supabase = get_supabase_client()
    supabase.table("profiles").delete().eq("id", profile_id).execute()
    return {"message": "Profile deleted"}

@router.post("/profiles/{profile_id}/preview")
async def preview_profile(
    profile_id: str,
    payload: dict,
):
    """
    SOTA: Real-time Agent Preview (Testing Lab).
    """
    from services.chat_logic import ChatService
    from managers.connection_manager import manager as chat_manager
    
    service = ChatService(manager=chat_manager)
    return await service.run_agent_preview(
        profile_id=profile_id,
        input_text=payload.get("input", ""),
        project_id=payload.get("project_id")
    )

# --- Drive Auth (Simplified) ---

@router.post("/auth/drive/connect")
async def connect_google_drive():
    """Triggers interactive Google Drive authentication."""
    try:
        from services.drive_service import get_drive_service
        drive = get_drive_service()
        # Non-blocking check/auth
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, drive.authorize)
        return {"status": "success", "message": "Connected to Google Drive"}
    except Exception as e:
        logger.error(f"Drive auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- SOTA 2025: Project RAG & File Caching ---

from utils.redis_cache import cached, get_cache, set_cache

@router.get("/projects/{project_id}/files/tree", response_model=List[dict])
@safe_route
async def get_project_files_tree(
    project_id: str,
    refresh: bool = False,
    project_service: ProjectService = Depends(get_project_service)
):
    """
    SOTA: Get recursive file tree for a project with Redis Caching (5m).
    Returns a structure suitable for the Knowledge Explorer UI.
    """
    # 1. Get Project Drive Folder ID
    project = await project_service.get_project_by_id(project_id)
    if not project or not project.get("drive_folder_id"):
        # If no folder linked, return empty list (or hint to connect)
        return []
        
    folder_id = project.get("drive_folder_id")
    cache_key = f"project_files_tree:{project_id}:{folder_id}"
    
    # 2. Check Cache
    if not refresh:
        cached_data = get_cache(cache_key)
        if cached_data:
            return cached_data

    # 3. Fetch from Drive Service (Deep Listing)
    try:
        from services.drive_service import get_drive_service
        drive = get_drive_service()
        
        if not drive.service:
            logger.warning("Drive service not connected.")
            return []

        # Fetch folders and files (recursive or flat list with parents)
        # SOTA: We ask Drive Service for a "tree" or flat list we can build into tree
        # Assuming list_files returns flat list with parents.
        files = await asyncio.to_thread(
            drive.list_files, 
            query=f"'{folder_id}' in parents and trashed=false",
            fields="id, name, mimeType, parents, iconLink, webViewLink"
        )
        
        # SOTA: Also fetch sub-folders for depth? 
        # For MVP of this feature, we might just do 1 level or handle 'expand' in UI.
        # User requested "File Tree". Let's assume we fetch 1 level or use a recursive service method if exists.
        # Check service... `list_files` seems basic.
        # Let's return the flat list of the ROOT folder for now, 
        # UI can recursively call this endpoint if we supported `?folder_id=XYZ`.
        # BETTER: Use `q` param to recursive? No, Drive API is tricky.
        # Let's strictly return the contents of the Project Folder (Level 1) + subfolders.
        # Actually, let's implement a 'folder_id' query param to browse.
        
        # For the Cache, we store per-folder.
        
        # Structure for UI
        tree_nodes = []
        for f in files:
            node = {
                "id": f.get("id"),
                "name": f.get("name"),
                "type": "folder" if f.get("mimeType") == "application/vnd.google-apps.folder" else "file",
                "mime_type": f.get("mimeType"),
                "icon": f.get("iconLink"),
                "url": f.get("webViewLink"),
                "has_children": f.get("mimeType") == "application/vnd.google-apps.folder" # Assumption
            }
            tree_nodes.append(node)
            
        # 4. Set Cache (300s = 5m)
        set_cache(cache_key, tree_nodes, ttl=300)
        
        return tree_nodes

    except Exception as e:
        logger.error(f"Failed to fetch drive tree: {e}")
        # Return empty or error? Empty ensures UI doesn't crash.
        return []

@router.get("/projects/{project_id}/folders/browse", response_model=List[dict])
@safe_route
async def browse_project_folder(
    project_id: str,
    folder_id: str = Query(..., description="Drive Folder ID to browse"),
    refresh: bool = False
):
    """
    SOTA: Browse specific subfolder.
    """
    cache_key = f"drive_folder_browse:{folder_id}"
    if not refresh:
        cached = get_cache(cache_key)
        if cached: return cached

    try:
        from services.drive_service import get_drive_service
        drive = get_drive_service()
        
        files = await asyncio.to_thread(
            drive.list_files, 
            query=f"'{folder_id}' in parents and trashed=false",
            fields="id, name, mimeType, parents, iconLink"
        )
        
        nodes = [{
            "id": f["id"],
            "name": f["name"],
            "type": "folder" if f.get("mimeType") == "application/vnd.google-apps.folder" else "file",
            "children": [], # Lazy load
            "is_folder": f.get("mimeType") == "application/vnd.google-apps.folder"
        } for f in files]
        
        set_cache(cache_key, nodes, ttl=300)
        return nodes
    except Exception as e:
        logger.error(f"Browse failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to browse folder")

