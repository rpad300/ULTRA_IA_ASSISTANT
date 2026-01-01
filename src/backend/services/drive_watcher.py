
import asyncio
import logging
import os
from typing import List
from services.drive_service import get_drive_service
from services.redis_service import get_redis_service
from tasks.ingestion_tasks import process_file_ingestion

logger = logging.getLogger(__name__)

class DriveWatcher:
    def __init__(self, watch_folders: List[str], company_id: str, poll_interval: int = 60):
        self.watch_folders = watch_folders # List of Folder IDs
        self.company_id = company_id
        self.poll_interval = poll_interval
        self.drive = get_drive_service()
        self.running = False
        
    async def start(self):
        self.running = True
        logger.info(f"Starting Drive Watcher for company {self.company_id} on folders {self.watch_folders}")
        while self.running:
            try:
                await self._check_folders()
            except Exception as e:
                logger.error(f"Drive Watcher error: {e}")
            
            await asyncio.sleep(self.poll_interval)

    def stop(self):
        self.running = False

    async def _check_folders(self):
        redis = await get_redis_service()
        
        for folder_id in self.watch_folders:
            files = self.drive.list_files(folder_id)
            if not files:
                continue
                
            for file in files:
                file_id = file.get("id")
                name = file.get("name")
                mime_type = file.get("mimeType")
                
                # Skip folders
                if mime_type == 'application/vnd.google-apps.folder':
                    continue
                
                # Check tracking in Redis (using specialized watcher key, not dedup key)
                # Key: watcher:file_id -> modified_time
                # If modified_time changed, re-process
                created_time = file.get("createdTime") # Drive uses createdTime often for immutable, but modifiedTime exists too
                # For simplicity, we trigger if we haven't seen this file ID or timestamp logic?
                # Let's use a simple "processed" set for this MVP interaction, 
                # but ideally we tracked "last_processed_time"
                
                watcher_key = f"drive:watcher:processed:{file_id}"
                last_processed = await redis.get_json(watcher_key)
                
                if not last_processed:
                    logger.info(f"New file detected: {name} ({file_id})")
                    
                    # Download file
                    # We need a temp path
                    temp_dir = "temp_ingestion"
                    os.makedirs(temp_dir, exist_ok=True)
                    temp_path = os.path.join(temp_dir, name)
                    
                    content = self.drive.get_file_bytes(file_id)
                    if not content:
                        continue
                        
                    with open(temp_path, "wb") as f:
                        f.write(content)
                    
                    # Trigger Celery Task
                    metadata = {
                        "drive_id": file_id,
                        "drive_url": file.get("webViewLink"),
                        "mime_type": mime_type,
                        "created_at": created_time
                    }
                    
                    # Fire and forget (Celery)
                    process_file_ingestion.delay(temp_path, self.company_id, metadata)
                    
                    # Mark as processed
                    await redis.set_json(watcher_key, "1", ttl_seconds=86400 * 365) # 1 year
                    
                    # Cleanup? 
                    # The Celery task needs the file. It runs in a separate process/thread.
                    # If local, path is fine. If distributed, we need shared storage or pass bytes (bad for large files).
                    # Since we are "local" (same machine), path is fine.
                    # But we should clean it up eventually. 
                    # The task should probably clean it up.
                    
