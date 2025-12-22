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
from middleware.request_id import get_request_id
from db.supabase_client import get_supabase_client 

# Services
from services.company_service import get_company_service, CompanyService
from services.project_service import get_project_service, ProjectService
from services.contact_service import get_contact_service, ContactService
from services.document_service import get_document_service, DocumentService
from services.voice_enrollment_service import get_voice_enrollment_service, VoiceEnrollmentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["workspace"])

# --- Companies ---

@router.get("/companies", response_model=PaginatedResponse[Company])
async def get_companies(
    pagination: PaginationParams = Depends(get_pagination_params),
    company_service: CompanyService = Depends(get_company_service)
):
    """Get active companies with pagination."""
    items = await company_service.get_companies(pagination.offset, pagination.limit)
    total = await company_service.get_total_count()
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size
    )

@router.get("/companies/all", response_model=List[Company])
async def get_all_companies(company_service: CompanyService = Depends(get_company_service)):
    """Get all companies (including inactive) - optimized for dropdowns."""
    # Reusing pagination logic with high limit for now
    items = await company_service.get_companies(limit=100) 
    return items

@router.post("/companies", response_model=Company)
async def create_company(
    company: CompanyCreate, 
    request: Request = None,
    company_service: CompanyService = Depends(get_company_service)
):
    """Create a new company."""
    logger.info(f"Creating company: {company.name}", extra={"request_id": get_request_id(request)})
    return await company_service.create_company(company)

@router.get("/companies/{company_id}", response_model=Company)
async def get_company(
    company_id: str, 
    company_service: CompanyService = Depends(get_company_service)
):
    """Get company details."""
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

# --- Projects ---

@router.get("/companies/{company_id}/projects", response_model=List[Project])
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
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects", response_model=Project)
async def create_project(
    project: ProjectCreate,
    project_service: ProjectService = Depends(get_project_service)
):
    """Create a new project."""
    return await project_service.create_project(project)

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
    return await contact_service.get_contacts(pagination.offset, pagination.limit)

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
