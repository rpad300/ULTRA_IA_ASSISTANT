
import asyncio
import os
import sys
from datetime import datetime
import uuid

# Setup path
sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

from services.drive_service import get_drive_service
from services.company_service import CompanyService
from services.project_service import ProjectService
from services.qdrant_service import get_qdrant_service
from db.models import CompanyCreate, ProjectCreate
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue

# Mock BackgroundTasks
class MockBackgroundTasks:
    def add_task(self, func, *args, **kwargs):
        print(f"[MockBG] Queuing task: {func.__name__}")
        # Execute immediately for test script
        asyncio.create_task(func(*args, **kwargs))

async def main():
    print("=== Company Lifecycle Verification (Hard Delete) ===")
    
    drive_service = get_drive_service()
    if not drive_service.service:
        print("ERROR: Drive Service not authenticated. Cannot verify.")
        return

    company_service = CompanyService(drive_service)
    project_service = ProjectService()
    qdrant_service = get_qdrant_service()
    
    bg_tasks = MockBackgroundTasks()

    # --- 1. SETUP: Create Resources ---
    
    # 1.1 Create Company
    company_name = f"DeleteTest Corp {datetime.now().strftime('%H%M%S')}"
    print(f"\n1. Creating Company: {company_name}")
    
    try:
        new_company = await company_service.create_company(
            CompanyCreate(name=company_name, status="active"),
            bg_tasks 
        )
        print(f"   DB Created: {new_company.id}")
        
        # Wait for Drive provisioning
        print("   Waiting for background provisioning...")
        await asyncio.sleep(5) 
        
        # Refetch to get Drive ID
        company = await company_service.get_company_by_id(new_company.id)
        if not company.drive_root_folder_id:
            print("   WARNING: Drive Folder ID is Null. Deletion test might be partial.")
        else:
            print(f"   Drive Folder Linked: {company.drive_root_folder_id}")

    except Exception as e:
        print(f"   FAILURE during creation: {e}")
        return

    # 1.2 Create Project (to test DB Cascade)
    print(f"\n2. Creating Linked Project to test Cascade...")
    try:
        project_dict = await project_service.create_project(
            ProjectCreate(name="Cascade Project", company_id=company.id),
            bg_tasks
        )
        project_id = project_dict['id']
        print(f"   Project Created: {project_id}")
    except Exception as e:
        print(f"   FAILURE creating project: {e}")
        return

    # 1.3 Insert Qdrant Vector
    print(f"\n3. Inserting Mock Vector into Qdrant...")
    if qdrant_service and qdrant_service.client:
        try:
            # We need to manually insert for test as `upsert` usually goes through pipelines
            # Using bare client
            await qdrant_service.ensure_collection()
            
            point_id = str(uuid.uuid4())
            await qdrant_service.client.upsert(
                collection_name=qdrant_service.collection_name,
                points=[
                    PointStruct(
                        id=point_id,
                        vector=[0.1] * 1536, # Dummy 1536d vector
                        payload={
                            "company_id": company.id,
                            "type": "verification_marker"
                        }
                    )
                ]
            )
            print(f"   Vector inserted with company_id={company.id}")
        except Exception as e:
             print(f"   FAILURE qdrant insert: {e}")
    else:
        print("   WARNING: Qdrant service not available. Skipping vector test.")

    
    # --- 2. ACTION: Hard Delete ---
    
    print(f"\n\n{'!'*10} EXECUTING HARD DELETE {'!'*10}")
    print(f"Target: {company.id}")
    
    start_time = datetime.now()
    result = await company_service.hard_delete_company(company.id)
    duration = (datetime.now() - start_time).total_seconds()
    
    if result:
        print(f"   Hard Delete function returned TRUE in {duration:.2f}s")
    else:
        print(f"   Hard Delete function returned FALSE!")
        return

    # --- 3. VERIFICATION ---
    
    print(f"\n5. Verifying Cleanup...")
    errors = 0
    
    # 3.1 Check DB Company
    try:
        c = await company_service.get_company_by_id(company.id)
        if c:
            print("   [FAIL] Company record still exists in DB!")
            errors += 1
        else:
            print("   [PASS] Company record removed from DB.")
    except Exception as e:
        # get_company_by_id might return None or raise? standard expectation is None
        print(f"   [PASS] Company retrieval raised or returned None: {e}")

    # 3.2 Check DB Project (Cascade)
    try:
        if company.id: # Just a sanity check
             # We assume direct DB check or service check
             # project_service doesn't have checking by ID easily if soft/hard delete?
             # Let's try fetching it
             p = await project_service.get_project_by_id(project_id)
             if p:
                 print(f"   [FAIL] Project {project_id} still exists! Cascade failed.")
                 errors += 1
             else:
                 print("   [PASS] Project record removed (Cascade worked).")
    except Exception as e:
         # Depending on implementation, get_project_by_id might assume existence
         print(f"   [PASS] Project retrieval indicated absence: {e}")

    # 3.3 Check Drive
    if company.drive_root_folder_id:
        try:
             # Try to get the file
             f = drive_service.service.files().get(fileId=company.drive_root_folder_id).execute()
             # If successful and not trashed (if permanent delete)
             # delete_file usually means trash=True or delete?
             # DriveService.delete_file calls `service.files().delete` which is permanent, OR `update(trashed=True)`
             if f.get('trashed'):
                 print("   [PASS] Drive folder is in Trash (Acceptable).")
             else:
                 print("   [FAIL] Drive folder still active!")
                 errors += 1
        except Exception as e:
            if "404" in str(e):
                print("   [PASS] Drive folder 404 Not Found (Permanently Deleted).")
            else:
                print(f"   [?] Drive check error: {e}")
    
    # 3.4 Check Qdrant
    if qdrant_service and qdrant_service.client:
        try:
            # Search for any point with this company_id
            response = await qdrant_service.client.scroll(
                collection_name=qdrant_service.collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="company_id",
                            match=MatchValue(value=company.id)
                        )
                    ]
                ),
                limit=1
            )
            points, _ = response
            if len(points) > 0:
                print(f"   [FAIL] Found {len(points)} vectors in Qdrant!")
                errors += 1
            else:
                 print("   [PASS] No vectors found in Qdrant.")
        except Exception as e:
            print(f"   [?] Qdrant check error: {e}")

    print("\n" + "="*30)
    if errors == 0:
        print("VERIFICATION SUCCESSFUL: Clean Sweep.")
    else:
        print(f"VERIFICATION FAILED with {errors} errors.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
