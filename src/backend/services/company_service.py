from typing import List, Optional
from uuid import uuid4
import logging
from fastapi import HTTPException

from db.supabase_client import get_async_supabase_client
from services.drive_service import get_drive_service, DriveService
import asyncio
from db.models import CompanyCreate, CompanyUpdate, Company

logger = logging.getLogger(__name__)

from db.repositories.base_repository import BaseRepository

class CompanyService(BaseRepository['Company']):
    def __init__(self, drive_service: DriveService):
        super().__init__(table_name="companies")
        self.drive_service = drive_service

    async def get_companies(self, offset: int = 0, limit: int = 20) -> List[dict]:
        """Fetch active companies with pagination."""
        # Use BaseRepository's get_all which supports basic pagination logic
        # OR extend BaseRepository to handling "filters" in get_all more generically.
        # For now, custom implementation using self._execute is best for specific filtering + sort
        client = await self._get_client()
        response = await self._execute(
             client.table(self.table_name)
            .select("*")
            .eq("status", "active")
            .order("name")
            .range(offset, offset + limit - 1)
        )
        # Strong typing conversion
        return [Company.model_validate(item) for item in response.data] if response.data else []

    async def get_total_count(self) -> int:
        """Get count of active companies."""
        return await self.count(filters={"status": "active"})

    async def get_company_by_id(self, company_id: str) -> Optional[Company]:
        """Fetch a single company by ID."""
        data = await self.get_by_id(company_id)
        return Company.model_validate(data) if data else None

    async def create_company(self, company: CompanyCreate) -> Company:
        """Create a new company and its Drive folder."""
        
        async def _create_drive_folder_async(name: str) -> Optional[str]:
            if not self.drive_service: return None
            # Offload blocking I/O to thread
            return await asyncio.to_thread(self.drive_service.ensure_folder, name)

        async def _rollback_drive_folder(folder_id: str):
            try:
                if self.drive_service and folder_id:
                    # Offload blocking I/O to thread
                    await asyncio.to_thread(self.drive_service.service.files().delete(fileId=folder_id).execute)
                    logger.warning(f"Rolled back Drive folder {folder_id} after DB failure")
            except Exception as ex:
                logger.error(f"Failed to rollback Drive folder {folder_id}: {ex}")

        # Opting for DB Constraint approach instead of manual check for race-condition safety
        # We rely on the DB to throw an error if name is duplicate (assuming Unique Constraint exists)
        # If not, we fall back to pre-check, but in SOTA we prefer constraints.
        # For now, keeping pre-check as 'soft' check to save API calls, but ready to catch DB error.
        existing_count = await self.count(filters={"name": company.name})
        if existing_count > 0:
             raise HTTPException(status_code=400, detail=f"Company '{company.name}' already exists")

        data = company.model_dump()
        folder_id = None
        
        # Create Drive Folder (Async Wrapper)
        try:
            folder_id = await _create_drive_folder_async(data["name"])
            if folder_id:
                data["drive_root_folder_id"] = folder_id
        except Exception as e:
            # Policy: If Drive fails, we Log and Continue (Soft Failure) or Abort?
            # SOTA Recommendation: If 'drive_root_folder_id' is Critical for workflows, we should probably Abort.
            # But here we log error and continue to allow partial creation, or as user requested "abort if drive fails logic is ambiguous".
            # For robustness: We continue, but log heavily.
            logger.error(f"Failed to create Drive folder for company {company.name}: {e}")
            
        try:
            # Insert into DB
            created_data = await self.create(data)
            return Company.model_validate(created_data)
        except Exception as e:
            # If DB insert fails, rollback Drive folder to function as a Distributed Transaction (Saga pattern lite)
            # This handles the "Orphaned Folder" case
            if folder_id:
                await _rollback_drive_folder(folder_id)
            
            # Map specific DB errors if possible (e.g. Unique Violated)
            # For now, re-raise
            raise e

    async def update_company(self, company_id: str, company: CompanyUpdate) -> Company:
        """Update company details."""
        data = company.model_dump(exclude_unset=True)
        result = await self.update(company_id, data)
        if not result:
             raise HTTPException(status_code=404, detail="Company not found")
        return Company.model_validate(result)

    async def delete_company(self, company_id: str) -> bool:
        """Soft delete a company."""
        return await self.soft_delete(company_id)

def get_company_service():
    # Injection of the Singleton Drive Service
    return CompanyService(drive_service=get_drive_service())
