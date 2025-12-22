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
            
            return {
                "uri": gemini_file.uri,
                "name": gemini_file.name,
                "mime_type": mime_type,
                "display_name": filename
            }

async def get_document_service() -> DocumentService:
    """Dependency provider for DocumentService."""
    return DocumentService()
