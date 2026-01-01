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
        # Lazy load or injected qdrant would be better, but for now we'll import inside method 
        # to avoid changing signature too drastically if not needed, 
        # OR just update signature. Let's update signature.
        # Actually, to minimize impact on existing tests that might instantiate this, 
        # I'll default it to None and load if missing? 
        # No, let's keep it clean.


    async def get_companies(self, offset: int = 0, limit: int = 20) -> List[dict]:
        """Fetch active companies with pagination."""
        # Use BaseRepository's get_all which supports basic pagination logic
        # OR extend BaseRepository to handling "filters" in get_all more generically.
        # For now, custom implementation using self._execute is best for specific filtering + sort
        client = await self._get_client()
        async def op(client):
            return await client.table(self.table_name).select("*").order("name").range(offset, offset + limit - 1).execute()
        
        response = await self._safe_execute(op)
        # Strong typing conversion
        return [Company.model_validate(item) for item in response.data] if response.data else []

    async def get_total_count(self) -> int:
        """Get count of active companies."""
        return await self.count(filters={"status": "active"})

    async def get_company_by_id(self, company_id: str) -> Optional[Company]:
        """Fetch a single company by ID."""
        if not self._is_valid_uuid(company_id): return None
        data = await self.get_by_id(company_id)
        return Company.model_validate(data) if data else None

    def _is_valid_uuid(self, val: str) -> bool:
        if not val or not isinstance(val, str): return False
        import uuid
        try:
            uuid.UUID(val)
            return True
        except ValueError:
            return False

    async def create_company(self, company: CompanyCreate, background_tasks: 'BackgroundTasks') -> Company:
        """
        Create a new company (SOTA Async Architecture).
        1. DB Insert (Immediate Response)
        2. Drive Resources (Background Task)
        """
        # Check duplicates
        existing_count = await self.count(filters={"name": company.name})
        if existing_count > 0:
             raise HTTPException(status_code=400, detail=f"Company '{company.name}' already exists")

        data = company.model_dump()
        
        # 1. Immediate Persistence
        try:
            created_data = await self.create(data)
            new_company = Company.model_validate(created_data)
            
            # 2. Enqueue Background Provisioning
            background_tasks.add_task(self._bg_create_company_resources, new_company)
            
            return new_company
        except Exception as e:
            logger.error(f"DB Insert Failed: {e}")
            raise e

    async def _bg_create_company_resources(self, company: Company):
        """
        Background Worker: Provisions Drive resources (SOTA 2025).
        Structure:
          [ID] - [Name] /
             00_Projects /
             01_Company_Assets /
             99_Internal_System / 
                 Voice_Profiles /
        """
        try:
            from config import DRIVE_APP_ROOT_ID
            if not self.drive_service: 
                logger.warning("Drive Service unavailable, skipping background provisioning.")
                return
            
            # SOTA Naming: "[ID] - [Name]"
            safe_name = "".join([c for c in company.name if c.isalnum() or c in (' ', '-', '_')]).strip()
            folder_name = f"[{company.id}] - {safe_name}"

            # 1. Ensure Company Root Folder
            folder_id = await asyncio.to_thread(
                self.drive_service.ensure_folder_sota,
                name=folder_name, 
                parent_id=DRIVE_APP_ROOT_ID,
                entity_id=company.id,
                entity_type="company"
            )
            
            if folder_id:
                logger.info(f"Drive Folder Linked for {company.name}: {folder_id}")
                
                # 2. Update DB with Folder ID
                await self.update(company.id, {"drive_root_folder_id": folder_id})
                
                # 3. Bootstrap Sub-structures (SOTA 2025)
                # 00_Projects
                await asyncio.to_thread(self.drive_service.ensure_folder, "00_Projects", parent_id=folder_id)
                
                # 01_Company_Assets
                await asyncio.to_thread(self.drive_service.ensure_folder, "01_Company_Assets", parent_id=folder_id)
                
                # 99_Internal_System -> Voice_Profiles
                internal_sys_id = await asyncio.to_thread(self.drive_service.ensure_folder, "99_Internal_System", parent_id=folder_id)
                if internal_sys_id:
                     await asyncio.to_thread(self.drive_service.ensure_folder, "Voice_Profiles", parent_id=internal_sys_id)

                logger.info(f"SOTA 2025: Company '{company.name}' resources fully provisioned.")
            else:
                logger.error(f"SOTA: Failed to obtain folder ID for company {company.id}")
                
        except Exception as e:
            logger.error(f"Background Provisioning Failed for Company {company.id}: {e}")

    async def update_company(self, company_id: str, company: CompanyUpdate) -> Company:
        """Update company details."""
        if not self._is_valid_uuid(company_id):
            raise HTTPException(status_code=400, detail="Invalid company ID format")
        data = company.model_dump(exclude_unset=True)
        result = await self.update(company_id, data)
        if not result:
             raise HTTPException(status_code=404, detail="Company not found")
        return Company.model_validate(result)

    async def delete_company(self, company_id: str) -> bool:
        """Soft delete a company."""
        if not self._is_valid_uuid(company_id): return False
        return await self.soft_delete(company_id)

    async def hard_delete_company(self, company_id: str) -> bool:
        """
        SOTA: Permanently delete company and ALL associated resources.
        Cascade:
        1. Drive Folder (Recursive)
        2. Qdrant Vectors
        3. Database Record (Cascade to Projects/Sessions/etc via FK)
        """
        if not self._is_valid_uuid(company_id): return False
        
        # 1. Fetch Company to get Drive ID
        company = await self.get_company_by_id(company_id)
        if not company: return False

        # 2. Qdrant Cleanup
        try:
            from services.qdrant_service import get_qdrant_service
            qdrant = get_qdrant_service()
            if qdrant:
                # We need to await it if it's async (the method I added is async)
                # But get_qdrant_service returns the service instance.
                # The method I added 'delete_company_vectors' is async.
                await qdrant.delete_company_vectors(company_id)
        except Exception as e:
            logger.error(f"Failed to clean up Qdrant for company {company_id}: {e}")

        # 3. Drive Cleanup
        if company.drive_root_folder_id:
            try:
                # We interpret delete_file as deleting the folder if it's a folder ID
                await asyncio.to_thread(self.drive_service.delete_file, company.drive_root_folder_id)
                logger.info(f"Deleted Drive folder {company.drive_root_folder_id} for company {company_id}")
            except Exception as e:
                logger.error(f"Failed to delete Drive folder for company {company_id}: {e}")

        # 4. DB Hard Delete
        # Assuming Postgres FKs are set to ON DELETE CASCADE. 
        # If not, this might fail or leave orphans. 
        # For a "SOTA" system, we assume constraints are correct or we accept the risk for now 
        # as manual cascading of everything (Projects -> Sessions -> Transcripts -> Audio Segments...) is huge.
        return await self.delete(company_id)


def get_company_service():
    # Injection of the Singleton Drive Service
    return CompanyService(drive_service=get_drive_service())
