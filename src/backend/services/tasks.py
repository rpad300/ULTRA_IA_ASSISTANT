"""
Celery Background Tasks
"""

from celery import shared_task
from services.embedding_service import get_embedding_service
from services.gemini_service import get_gemini_service
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def generate_embedding_task(self, content: str, company_id: str, project_id: str = None, thread_id: str = None):
    """
    Background task to generate embedding and sync to vector store.
    
    Args:
        content: Text content to embed
        company_id: Company ID
        project_id: Optional project ID
        thread_id: Optional thread ID
    
    Returns:
        dict with embedding_id and status
    """
    try:
        embedding_service = get_embedding_service()
        result = embedding_service.sync_message_to_vector(
            content=content,
            company_id=company_id,
            project_id=project_id,
            thread_id=thread_id
        )
        return {
            "status": "success",
            "embedding_id": result.get("embedding_id"),
            "qdrant_point_id": result.get("qdrant_point_id")
        }
    except Exception as e:
        logger.error(f"Embedding task failed: {e}", exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def process_transcription_task(self, audio_file_path: str, session_id: str):
    """
    Background task to process audio transcription.
    
    Args:
        audio_file_path: Path to audio file
        session_id: Session ID
    
    Returns:
        dict with transcription_id and status
    """
    try:
        # Import here to avoid circular dependencies
        from services.assemblyai_service import AssemblyAIService
        
        service = AssemblyAIService()
        result = service.transcribe_file(audio_file_path)
        
        return {
            "status": "success",
            "transcription_id": result.get("id"),
            "text": result.get("text")
        }
    except Exception as e:
        logger.error(f"Transcription task failed: {e}", exc_info=True)
        raise self.retry(exc=e, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def sync_session_summary_task(self, session_id: str, summary_text: str, company_id: str):
    """
    Background task to sync session summary to vector store.
    
    Args:
        session_id: Session ID
        summary_text: Summary text
        company_id: Company ID
    
    Returns:
        dict with status
    """
    try:
        embedding_service = get_embedding_service()
        result = embedding_service.sync_session_summary_to_vector(
            session_id=session_id,
            summary_text=summary_text,
            company_id=company_id
        )
        return {
            "status": "success",
            "embedding_id": result.get("embedding_id")
        }
    except Exception as e:
        logger.error(f"Session summary sync task failed: {e}", exc_info=True)
        raise self.retry(exc=e, countdown=2 ** self.request.retries)





