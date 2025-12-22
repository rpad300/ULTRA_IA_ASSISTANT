from typing import List, Optional
import logging
from fastapi import HTTPException
from datetime import datetime

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
        client = await self._get_client()
        query = client.table("projects").select("*").eq("company_id", company_id).order("name")
        response = await self._execute(query)
        return response.data if response.data else []

    async def get_project_by_id(self, project_id: str) -> Optional[dict]:
        """Fetch a specific project."""
        return await self.get_by_id(project_id)

    async def create_project(self, project: ProjectCreate) -> dict:
        """Create a new project and optional Drive folder."""
        async def _rollback_drive_folder(folder_id: str):
            try:
                drive = get_drive_service()
                if drive and folder_id:
                    # TODO: Make drive service async
                    drive.delete_file(folder_id)
                    logger.warning(f"Rolled back Drive folder {folder_id} after DB failure")
            except Exception as ex:
                logger.error(f"Failed to rollback Drive folder {folder_id}: {ex}")

        client = await self._get_client()
        
        # Verify company exists
        company = await client.table("companies").select("id, drive_root_folder_id").eq("id", project.company_id).execute()
        if not company.data:
             raise HTTPException(status_code=400, detail="Invalid company_id")
             
        data = project.model_dump()
        folder_id = None
        
        # Create Drive Folder inside Company Folder
        try:
            drive = get_drive_service()
            if drive and company.data[0].get("drive_root_folder_id"):
                parent_id = company.data[0]["drive_root_folder_id"]
                folder_id = drive.ensure_folder(data["name"], parent_id=parent_id)
                if folder_id:
                     data["drive_folder_id"] = folder_id
        except Exception as e:
            logger.error(f"Failed to create Drive folder for project {project.name}: {e}")
            
        try:
            return await self.create(data)
        except Exception as e:
            if folder_id:
                await _rollback_drive_folder(folder_id)
            raise e

    async def update_project(self, project_id: str, project: ProjectUpdate) -> dict:
        """Update a project."""
        data = {k: v for k, v in project.model_dump().items() if v is not None}
        data["updated_at"] = datetime.now().isoformat()
        
        result = await self.update(project_id, data)
        if not result:
             raise HTTPException(status_code=404, detail="Project not found")
        return result

    async def delete_project(self, project_id: str) -> bool:
        """Cascade delete a project."""
        return await self.delete(project_id)

def get_project_service():
    return ProjectService()
