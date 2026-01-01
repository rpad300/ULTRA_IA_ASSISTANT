
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Body, Depends
from typing import List, Optional
import os
import shutil
import uuid
from tasks.ingestion_tasks import process_file_ingestion
from dependencies.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

@router.post("/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    company_id: str = Body(...),
    drive_url: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user) # Secure endpoint
):
    """
    Manually ingest a document into the Knowledge Keeper.
    Triggers the Celery pipeline.
    """
    try:
        # Create temp file
        temp_dir = "temp_ingestion"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Generate safe filename
        ext = os.path.splitext(file.filename)[1]
        temp_filename = f"{uuid.uuid4()}{ext}"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Metadata
        metadata = {
            "original_filename": file.filename,
            "uploaded_by": current_user.get("uid", "unknown"),
            "source": "manual_upload",
            "drive_url": drive_url
        }
        
        # Trigger Celery Task
        task = process_file_ingestion.delay(
            file_path=os.path.abspath(temp_path),
            company_id=company_id,
            metadata=metadata
        )
        
        return {
            "status": "queued",
            "task_id": str(task.id),
            "filename": file.filename,
            "message": "Document queued for SOTA ingestion."
        }
        
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reindex/drive")
async def trigger_drive_sync(
    company_id: str = Body(...),
    folder_id: str = Body(...)
):
    """
    Force trigger a Drive Sync for a specific folder.
    (Note: The background watcher is also active)
    """
    # Helper to just trigger a check manually if needed.
    # Implementation depends on how we expose the watcher singleton or just a task.
    # For now, we can acknowledge.
    return {"status": "not_implemented_yet", "message": "Background watcher is running automatically."}
