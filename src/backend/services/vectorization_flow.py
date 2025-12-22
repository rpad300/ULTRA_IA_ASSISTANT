
"""
Vectorization Flow Service
-------------------------
Handles the asynchronous vectorization of live transcripts.
This service ensures that the heavy lifting of Embedding Generation + Qdrant Upsert
happens IN THE BACKGROUND, keeping the WebSocket stream low-latency (Premium Feel).

Architecture:
1.  Frontend/C# sends transcript -> WebSocket
2.  WebSocket -> SQLite/Supabase (Immediate Store)
3.  WebSocket -> VectorizationFlow (Fire-and-forget Async Task)
4.  VectorizationFlow -> Gemini (Embedding) -> Qdrant (Vector Store)
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from services.embedding_service import get_embedding_service
from db.supabase_client import get_supabase_client
from datetime import datetime

logger = logging.getLogger(__name__)

import os
import tempfile
from services.drive_service import get_drive_service
from services.text_extraction_service import TextExtractionService

async def sync_session_summary_to_vector(session_id: str, summary_text: str, thread_id: str):
    """
    Syncs a session summary to the vector store.
    Fetches context (company/project) from DB if not provided.
    """
    try:
        supabase = get_supabase_client()
        
        # Fetch Context (Project/Company) via Thread
        # Use single() for better performance
        # Path: Thread -> Project
        thread_res = supabase.table("threads").select("project_id").eq("id", thread_id).single().execute()
        if not thread_res.data:
            logger.warning(f"Thread {thread_id} not found for vectorization")
            return
            
        project_id = thread_res.data["project_id"]
        
        # Fetch Company from Project
        project_res = supabase.table("projects").select("company_id").eq("id", project_id).single().execute()
        company_id = project_res.data["company_id"] if project_res.data else "default-company"
        
        embedding_service = get_embedding_service()
        await embedding_service.sync_message_to_vector(
            message_id=f"session-summary-{session_id}",
            content=f"Session Summary: {summary_text}",
            company_id=company_id,
            project_id=project_id,
            thread_id=thread_id,
            author_name="AI Assistant",
            original_created_at=datetime.now().isoformat()
        )
        logger.info(f"Vectorized summary for session {session_id}")
        
    except Exception as e:
        logger.error(f"Failed to vectorize session summary: {e}")

class VectorizationFlow:
    def __init__(self):
        self.embedding_service = get_embedding_service()

    async def process_transcript(
        self,
        session_id: str,
        transcript_data: Dict[str, Any],
        project_id: Optional[str] = None,
        company_id: str = "default-company" # TODO: Get from context/auth
    ):
        """
        Asynchronously process a transcript block for vector search.
        Should be called with asyncio.create_task() or similar to avoid blocking.
        """
        try:
            text = transcript_data.get("transcript") or transcript_data.get("text")
            if not text:
                return

            speaker_name = transcript_data.get("speaker", "Unknown")
            # Use timestamp as a rough created_at if not provided
            created_at = transcript_data.get("created_at") or transcript_data.get("timestamp")

            # We treat the transcript id as the message_id for deduplication
            message_id = transcript_data.get("id") or f"transcript-{session_id}-{int(transcript_data.get('timestamp', 0))}"

            # Log start (debug only)
            # logger.debug(f"Starting vectorization for {message_id}")

            # Use the robust EmbeddingService which handles Retry, RateLimiting, and Dual-Write
            await self.embedding_service.sync_message_to_vector(
                message_id=message_id,
                content=text,
                company_id=company_id,
                project_id=project_id,
                thread_id=session_id, # We map Session -> Thread for RAG context
                author_name=speaker_name,
                original_created_at=str(created_at)
            )


            
            # logger.debug(f"Completed vectorization for {message_id}")

        except Exception as e:
            # We log error but DO NOT crash the stream. 
            # This is critical for resilience.
            logger.error(f"Failed to vectorize transcript {session_id}: {e}")

    async def process_drive_file(
        self,
        file_id: str,
        file_name: str,
        project_id: str,
        mime_type: str = "application/octet-stream"
    ):
        """
        Downloads a file from Drive, extracts text, and vectorizes it.
        """
        temp_path = None
        try:
            logger.info(f"Starting vectorization for Drive file: {file_name} ({file_id})")
            
            # 1. Download file
            drive = get_drive_service()
            if not drive:
                logger.error("Drive service unavailable for vectorization")
                return

            file_bytes = drive.get_file_bytes(file_id)
            if not file_bytes:
                logger.error(f"Failed to download file {file_id}")
                return

            # Create temp file with correct extension
            ext = os.path.splitext(file_name)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
                temp_file.write(file_bytes)
                temp_path = temp_file.name

            # 2. Extract Text
            text = TextExtractionService.extract_text(temp_path)
            if not text or len(text.strip()) == 0:
                logger.warning(f"No text extracted from {file_name}")
                return

            # 3. Vectorize
            # We treat files as "knowledge context" for the project
            await self.embedding_service.sync_message_to_vector(
                message_id=f"file-{file_id}",
                content=f"File Content ({file_name}):\n{text}",
                company_id="default-company", # Metadata limitation, maybe fetch project's company
                project_id=project_id,
                thread_id=f"project-files-{project_id}", # Virtual thread for project files
                author_name="System",
                original_created_at=None # Current time
            )
            
            logger.info(f"Successfully vectorized Drive file: {file_name}")

        except Exception as e:
            logger.error(f"Failed to process drive file {file_id}: {e}", exc_info=True)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

# Singleton
_vectorization_flow = None

def get_vectorization_flow():
    global _vectorization_flow
    if _vectorization_flow is None:
        _vectorization_flow = VectorizationFlow()
    return _vectorization_flow
