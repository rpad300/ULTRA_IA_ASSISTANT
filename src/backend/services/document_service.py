import os
import aiofiles
import logging
from contextlib import asynccontextmanager
from typing import Optional, Tuple, Dict
from services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

class DocumentService:
    """
    Service for handling document uploads and lifecycle management.
    """
    
    @asynccontextmanager
    async def create_async_temp_file(self, file_content: bytes, filename: str):
        """
        Async Context Manager for temporary files.
        Ensures file is deleted after use, even on error.
        """
        import tempfile
        tmp_path = None
        try:
            # Create temp file
            # Note: aiofiles doesn't strictly support "NamedTemporaryFile" in the same way 
            # for cross-platform robustness we often create a file manually in temp dir.
            # But standard tempfile + write is blocking IO.
            # We will use tempfile to get a name, but write with aiofiles.
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
                tmp_path = tmp.name
            
            async with aiofiles.open(tmp_path, 'wb') as f:
                await f.write(file_content)
                
            yield tmp_path
            
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    logger.debug(f"Cleaned up temp file: {tmp_path}")
                except Exception as e:
                    logger.error(f"Failed to cleanup temp file {tmp_path}: {e}")

    async def upload_for_gemini_analysis(self, file_content: bytes, filename: str, mime_type: str) -> Dict[str, str]:
        """
        Uploads file to Gemini File API.
        """
        async with self.create_async_temp_file(file_content, filename) as tmp_path:
            gemini = GeminiService()
            # upload_file is likely sync in Google's library, so we might need run_in_executor if it strictly blocking.
            # But the overhead is usually network, which requests handles. 
            # The google-generativeai lib is sync. 
            import asyncio
            from functools import partial
            
            loop = asyncio.get_running_loop()
            
            # Run the upload in a thread to avoid blocking the event loop
            gemini_file = await loop.run_in_executor(
                None, 
                partial(gemini.upload_file, tmp_path, mime_type=mime_type)
            )
            
            # SOTA: Active Polling for File State
            # Files (especially videos/larges PDFs) enter PROCESSING state.
            # We must wait for ACTIVE before returning.
            start_time = asyncio.get_running_loop().time()
            timeout = 300 # 5 minutes max
            
            while True:
                state = await gemini.get_file_state(gemini_file.name)
                
                if state == "ACTIVE":
                    break
                elif state == "FAILED":
                    raise ValueError(f"Gemini processing failed for {filename}")
                
                if asyncio.get_running_loop().time() - start_time > timeout:
                     raise TimeoutError(f"Gemini processing timed out for {filename}")
                
                logger.info(f"File {filename} is {state}... waiting")
                await asyncio.sleep(2) # Polling interval
            
            return {
                "uri": gemini_file.uri,
                "name": gemini_file.name,
                "mime_type": mime_type,
                "display_name": filename
            }

    async def process_document_upload(self, project_id: str, file: any, drive_folder_id: Optional[str]) -> Dict[str, any]:
        """
        SOTA Document Processing:
        1. Upload content to Google Drive (Project/Documents)
        2. Create Database Record
        """
        import asyncio
        from services.drive_service import get_drive_service
        from db.supabase_client import get_supabase_client
        
        filename = file.filename
        content = await file.read()
        
        # 1. Drive Upload
        drive = get_drive_service()
        drive_file_id = None
        documents_folder_id = None
        
        if drive and drive.service and drive_folder_id:
            try:
                # Ensure "Documents" subfolder exists
                documents_folder_id = await asyncio.to_thread(
                    drive.ensure_folder, 
                    "Documents", 
                    parent_id=drive_folder_id
                )
                
                # Upload File
                drive_file_id = await asyncio.to_thread(
                    drive.upload_bytes,
                    content,
                    filename,
                    file.content_type,
                    documents_folder_id
                )
                logger.info(f"Uploaded document {filename} to Drive ID: {drive_file_id}")
            except Exception as e:
                logger.error(f"Failed to upload document to Drive: {e}")
                # We continue to save DB record even if Drive fails (resilience)
        
        # 2. Database Record
        supabase = get_supabase_client()
        
        doc_data = {
            "project_id": project_id,
            "name": filename,
            "mime_type": file.content_type,
            "size_bytes": len(content),
            "drive_file_id": drive_file_id,
            "drive_folder_id": documents_folder_id,  # Track which folder it went to
            "metadata": {} 
        }
        
        try:
            # We use 'upsert' or 'insert'. Since new file, insert.
            res = supabase.table("documents").insert(doc_data).execute()
            if res.data:
                return res.data[0]
            else:
                raise ValueError("Database insert returned no data")
                
        except Exception as e:
             logger.error(f"Failed to save document record: {e}")
             # If DB fails but Drive succeeded, we have an orphan. 
             # Ideally we roll back Drive, but for now we raise.
             raise e

async def get_document_service() -> DocumentService:
    """Dependency provider for DocumentService."""
    return DocumentService()
