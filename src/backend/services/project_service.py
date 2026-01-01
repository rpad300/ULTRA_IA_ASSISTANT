from typing import List, Optional
import logging
from fastapi import HTTPException
from datetime import datetime
import asyncio

from db.supabase_client import get_async_supabase_client
from services.drive_service import get_drive_service
from db.models import ProjectCreate, ProjectUpdate, Project
from db.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)

class ProjectService(BaseRepository['Project']):
    def __init__(self):
        super().__init__(table_name="projects")

    async def get_projects_by_company(self, company_id: str) -> List[dict]:
        """Fetch all projects for a company."""
        # Custom query needed for ordering by name and filtering by company
        async def op(client):
            return await client.table("projects").select("*").eq("company_id", company_id).order("name").execute()
        
        response = await self._safe_execute(op)
        return response.data if response.data else []

    async def get_project_by_id(self, project_id: str) -> Optional[dict]:
        """Fetch a specific project."""
        return await self.get_by_id(project_id)

    async def create_project(self, project: ProjectCreate, background_tasks: 'BackgroundTasks') -> dict:
        """Create a new project (SOTA Async)."""
        client = await self._get_client()
        
        # Verify company exists
        company = await client.table("companies").select("id").eq("id", project.company_id).execute()
        if not company.data:
             raise HTTPException(status_code=400, detail="Invalid company_id")
             
        data = project.model_dump()
        
        # 1. Immediate Persistence
        try:
            created_data = await self.create(data)
            new_project = Project.model_validate(created_data)
            
            # 2. Background Provisioning
            background_tasks.add_task(self._bg_create_project_drive, new_project)
            
            return new_project.model_dump()
        except Exception as e:
            logger.error(f"DB Insert Failed: {e}")
            raise e

    async def _bg_create_project_drive(self, project: Project):
        """
        Background: robustly link project to drive.
        """
        try:
            drive = get_drive_service()
            if not drive: return

            # A. Resolve Company Folder ID (Resilience)
            # Fetch company again to check if drive_root_folder_id is now set
            client = await self._get_client()
            c_res = await client.table("companies").select("drive_root_folder_id").eq("id", project.company_id).single().execute()
            company_root_id = c_res.data.get("drive_root_folder_id")
            
            # SOTA Fallback: If DB is null, check Drive Metadata
            if not company_root_id:
                from config import DRIVE_APP_ROOT_ID
                # Try to find company root by DB ID
                company_root_id = await asyncio.to_thread(
                    drive.find_folder_by_property, 'db_id', project.company_id, DRIVE_APP_ROOT_ID
                )
                if company_root_id:
                     # Self-Repair
                     try:
                        await client.table("companies").update({"drive_root_folder_id": company_root_id}).eq("id", project.company_id).execute()
                     except: pass
            
            if not company_root_id:
                logger.error(f"SOTA: Could not resolve Company Root for Project {project.name}. Provisioning deferred.")
                return

            # A.2 Ensure "00_Projects" Container exists in Company Root
            projects_container_id = await asyncio.to_thread(drive.ensure_folder, "00_Projects", parent_id=company_root_id)
            if not projects_container_id:
                 # Fallback to root if container fails? No, strict hierarchy.
                 logger.error(f"SOTA: Failed to create/find '00_Projects' for Company {project.company_id}")
                 return

            # SOTA Naming: "[ID] - [Name]"
            safe_name = "".join([c for c in project.name if c.isalnum() or c in (' ', '-', '_')]).strip()
            folder_name = f"[{project.id}] - {safe_name}"

            # B. Ensure Project Folder
            folder_id = await asyncio.to_thread(
                drive.ensure_folder_sota,
                name=folder_name,
                parent_id=projects_container_id,
                entity_id=project.id,
                entity_type="project"
            )
            
            if folder_id:
                # C. Update Project DB
                await self.update(project.id, {"drive_folder_id": folder_id})
                
                # D. Subfolders (SOTA 2025)
                # _Current_Context (AI Brain)
                await asyncio.to_thread(drive.ensure_folder, "_Current_Context", parent_id=folder_id)
                # Documents
                await asyncio.to_thread(drive.ensure_folder, "Documents", parent_id=folder_id)
                # Sessions
                await asyncio.to_thread(drive.ensure_folder, "Sessions", parent_id=folder_id)

                logger.info(f"SOTA 2025: Project '{project.name}' drive resources provisioned.")

        except Exception as e:
            logger.error(f"Background Provisioning Failed for Project {project.id}: {e}")

    async def update_project(self, project_id: str, project: ProjectUpdate) -> dict:
        """Update a project."""
        import asyncio
        from functools import partial
        
        # SOTA: Efficient Update
        data = project.model_dump(exclude_unset=True)
        data["updated_at"] = datetime.now().isoformat()
        
        # Fetch current project to check for rename needs
        current = await self.get_by_id(project_id)
        if not current:
             raise HTTPException(status_code=404, detail="Project not found")

        # Update DB first for consistency
        result = await self.update(project_id, data)
        
        # SOTA: Folder Integrity (Rename Folder if Name Changed)
        if "name" in data and current.get("drive_folder_id"):
            new_name = data["name"]
            folder_id = current.get("drive_folder_id")
            
            if new_name != current.get("name"):
                try:
                    drive = get_drive_service()
                    loop = asyncio.get_running_loop()
                    
                    # Fire and forget rename task (or await if critical)
                    # We await to ensure consistency for the user
                    await loop.run_in_executor(
                        None,
                        partial(drive.rename_file, folder_id, new_name)
                    )
                    logger.info(f"Renamed Drive folder {folder_id} to {new_name}")
                except Exception as e:
                    # Non-fatal error, log and continue
                    logger.error(f"Failed to rename Drive folder for project {project_id}: {e}")

        return result

    async def delete_project(self, project_id: str) -> bool:
        """Cascade delete a project."""
        return await self.delete(project_id)

def get_project_service():
    return ProjectService()
