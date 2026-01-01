
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

class TranscriptBuffer:
    """
    SOTA Accumulator for transcripts.
    Aggregates small phrases into semantically rich chunks.
    """
    def __init__(self):
        self._buffers: Dict[str, Dict] = {} # {session_id: {text, timestamp_start, count}}
        self.MIN_WORDS = 80
        self.MAX_WAIT_SECONDS = 15

    def add(self, session_id: str, text: str) -> Optional[str]:
        if session_id not in self._buffers:
            self._buffers[session_id] = {
                "text": "",
                "created_at": datetime.now(),
                "count": 0
            }
        
        buf = self._buffers[session_id]
        buf["text"] += " " + text
        buf["count"] += 1
        
        # Check thresholds
        word_count = len(buf["text"].split())
        time_diff = (datetime.now() - buf["created_at"]).total_seconds()
        
        if word_count >= self.MIN_WORDS or time_diff > self.MAX_WAIT_SECONDS:
            full_text = buf["text"].strip()
            del self._buffers[session_id] # Reset
            return full_text
        return None

class VectorizationFlow:
    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.buffer = TranscriptBuffer()

    async def process_transcript(
        self,
        session_id: str,
        transcript_data: Dict[str, Any],
        project_id: Optional[str] = None,
        company_id: str = "default-company"
    ):
        """
        Asynchronously process a transcript block for vector search.
        Uses Batched Accumulation for semantic density.
        """
        try:
            text = transcript_data.get("transcript") or transcript_data.get("text")
            if not text: return

            # SOTA: Accumulate instead of raw fire-hose
            # This ensures we store "Contexts" not "Fragments"
            aggregated_text = self.buffer.add(session_id, text)
            
            if not aggregated_text:
                return # Keep buffering

            speaker_name = transcript_data.get("speaker", "Unknown")
            created_at = transcript_data.get("created_at") or transcript_data.get("timestamp")
            
            # Use aggregated text for embedding
            message_id = f"transcript-{session_id}-{int(datetime.now().timestamp())}"

            # Log start (debug only)
            # logger.debug(f"Starting vectorization for {message_id}")

            # Use the robust EmbeddingService
            await self.embedding_service.sync_message_to_vector(
                message_id=message_id,
                content=aggregated_text,
                company_id=company_id,
                project_id=project_id,
                thread_id=session_id, 
                author_name=speaker_name,
                original_created_at=str(created_at),
                metadata={ 
                    "type": "transcription_chunk", 
                    "language": transcript_data.get("language", "en") # SOTA Metadata
                }
            )

        except Exception as e:
            logger.error(f"Failed to vectorize transcript {session_id}: {e}")

    async def process_drive_file(
        self,
        file_id: str,
        file_name: str,
        project_id: str,
        mime_type: str = "application/octet-stream"
    ):
        """
        SOTA Implementation: Delegating to Celery + Future-proof for Chunking.
        """
        try:
            # Em vez de processar aqui, delegamos para o Worker que tem mais RAM/CPU
            # Avoid circular import at top level
            from services.tasks import sync_drive_to_vector_task
            
            # Dispara a tarefa no Celery
            sync_drive_to_vector_task.delay(
                file_id=file_id,
                file_name=file_name,
                project_id=project_id
            )
            logger.info(f"Queued background vectorization for {file_name}")
            
        except Exception as e:
            logger.error(f"Failed to queue drive file {file_id}: {e}", exc_info=True)

# Singleton
_vectorization_flow = None

def get_vectorization_flow():
    global _vectorization_flow
    if _vectorization_flow is None:
        _vectorization_flow = VectorizationFlow()
    return _vectorization_flow
