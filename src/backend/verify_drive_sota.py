import asyncio
import os
import sys
from datetime import datetime

# Setup path
sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

from services.drive_service import get_drive_service
from services.company_service import CompanyService
from services.project_service import ProjectService
from db.models import CompanyCreate, ProjectCreate
from config import DRIVE_APP_ROOT_ID

# Mock BackgroundTasks
class MockBackgroundTasks:
    def add_task(self, func, *args, **kwargs):
        print(f"[MockBG] Queuing task: {func.__name__}")
        # Execute immediately for test script
        asyncio.create_task(func(*args, **kwargs))

async def main():
    print("=== SOTA Drive Automation Verification ===")
    print(f"Root Folder ID: {DRIVE_APP_ROOT_ID}")
    
    drive_service = get_drive_service()
    if not drive_service.service:
        print("ERROR: Drive Service not authenticated. Cannot verify.")
        return

    company_service = CompanyService(drive_service)
    project_service = ProjectService()
    
    bg_tasks = MockBackgroundTasks()
    
    # 1. Create Company
    company_name = f"SOTA Corp {datetime.now().strftime('%H%M%S')}"
    print(f"\n1. Creating Company: {company_name}")
    
    try:
        new_company = await company_service.create_company(
            CompanyCreate(name=company_name, status="active"),
            bg_tasks 
        )
        print(f"   DB Created: {new_company.id}")
        
        # Wait for "Background" task
        print("   Waiting for background provisioning...")
        await asyncio.sleep(5) # Give it time
        
        # Verify
        updated_company = await company_service.get_company_by_id(new_company.id)
        if updated_company.drive_root_folder_id:
            print(f"   SUCCESS: Drive Folder Linked: {updated_company.drive_root_folder_id}")
            # Optional: Check name mapping via Drive API?
        else:
            print("   FAILURE: Drive Folder ID is Null after wait.")
            
    except Exception as e:
        print(f"   FAILURE: {e}")
        return

    # 1B. Verify Company Subfolders (SOTA 2025)
    print("   Verifying Company Sub-structure...")
    if updated_company.drive_root_folder_id:
        # Give it a bit more time if latency is high
        await asyncio.sleep(2)
        subfolders = drive_service.list_files(updated_company.drive_root_folder_id)
        
        if subfolders is None:
             print(f"   FAILURE: list_files returned None for {updated_company.drive_root_folder_id}. Check logs.")
        else:
            names = [f['name'] for f in subfolders]
            print(f"   Subfolders: {names}")
            if "00_Projects" in names and "99_Internal_System" in names:
                print("   SUCCESS: Company Hierarchy SOTA 2025 Verified.")
            else:
                 print("   FAILURE: Missing '00_Projects' or '99_Internal_System'.")

    # 2. Create Project
    project_name = f"SOTA Project {datetime.now().strftime('%H%M%S')}"
    print(f"\n2. Creating Project: {project_name}")
    
    try:
        new_project_dict = await project_service.create_project(
            ProjectCreate(name=project_name, company_id=new_company.id, status="active"),
            bg_tasks
        )
        print(f"   DB Created: {new_project_dict['id']}")
        
        # Wait
        print("   Waiting for background provisioning...")
        await asyncio.sleep(5)
        
        # Verify
        updated_project = await project_service.get_project_by_id(new_project_dict['id'])
        if updated_project.get('drive_folder_id'):
             print(f"   SUCCESS: Drive Folder Linked: {updated_project['drive_folder_id']}")
             
             # 2B. Verify Project Subfolders
             p_subs = drive_service.list_files(updated_project['drive_folder_id'])
             
             if p_subs is None:
                  print(f"   FAILURE: list_files returned None for Project {updated_project['drive_folder_id']}.")
             else:
                 p_names = [f['name'] for f in p_subs]
                 print(f"   Project Subfolders: {p_names}")
                 required = ["Sessions", "Documents", "_Current_Context"]
                 if all(r in p_names for r in required):
                     print("   SUCCESS: Project Hierarchy SOTA 2025 Verified.")
                 else:
                     print(f"   FAILURE: Missing subfolders. Found: {p_names}")
                 
        else:
             print("   FAILURE: Project Drive Folder ID is Null.")
             
    except Exception as e:
        print(f"   FAILURE: {e}")

    print("\n=== Verification Complete ===")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
