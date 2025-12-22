"""
Dead Letter Queue (DLQ) Service for handling persistent failures.
Stores failed operations for later retry or manual intervention.
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
from db.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class FailureReason(Enum):
    """Reasons for failure."""
    EMBEDDING_FAILED = "embedding_failed"
    QDRANT_UPSERT_FAILED = "qdrant_upsert_failed"
    INDEX_SAVE_FAILED = "index_save_failed"
    VALIDATION_FAILED = "validation_failed"
    RATE_LIMITED = "rate_limited"
    UNKNOWN = "unknown"


@dataclass
class DLQEntry:
    """Entry in the dead letter queue."""
    id: Optional[str] = None
    operation_type: str = ""  # 'sync_message', 'sync_session_summary', etc.
    external_id: str = ""  # message_id, session_id, etc.
    content_preview: str = ""  # First 200 chars for debugging
    failure_reason: str = ""
    error_message: str = ""
    retry_count: int = 0
    max_retries: int = 3
    metadata: Dict = None
    created_at: Optional[datetime] = None
    last_retry_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.created_at is None:
            self.created_at = datetime.now()


class DeadLetterQueue:
    """
    Dead Letter Queue for persistent failures.
    Uses Supabase table for persistence.
    """
    
    def __init__(self):
        self.supabase = get_supabase_client()
        self._ensure_table()
    
    def _ensure_table(self):
        """Ensure DLQ table exists (create if not)."""
        # Table will be created via migration, but we check here
        try:
            self.supabase.table("dlq_embedding_failures").select("id").limit(1).execute()
        except Exception:
            logger.warning("DLQ table may not exist. Run migration 005_create_dlq_table.sql")
    
    def add_failure(
        self,
        operation_type: str,
        external_id: str,
        content_preview: str,
        failure_reason: FailureReason,
        error_message: str,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Add a failed operation to the DLQ.
        
        Returns:
            DLQ entry ID
        """
        entry = DLQEntry(
            operation_type=operation_type,
            external_id=external_id,
            content_preview=content_preview[:200],
            failure_reason=failure_reason.value,
            error_message=str(error_message)[:1000],  # Limit error message length
            metadata=metadata or {}
        )
        
        try:
            result = self.supabase.table("dlq_embedding_failures").insert({
                "operation_type": entry.operation_type,
                "external_id": entry.external_id,
                "content_preview": entry.content_preview,
                "failure_reason": entry.failure_reason,
                "error_message": entry.error_message,
                "retry_count": entry.retry_count,
                "max_retries": entry.max_retries,
                "metadata": entry.metadata,  # Supabase handles JSONB automatically
                "created_at": entry.created_at.isoformat()
            }).execute()
            
            if result.data:
                entry_id = result.data[0]["id"]
                logger.warning(
                    f"Added to DLQ: {operation_type} {external_id} "
                    f"(reason: {failure_reason.value})"
                )
                return entry_id
        except Exception as e:
            logger.error(f"Failed to add entry to DLQ: {e}")
            # Fallback: log to file or external service
            import traceback
            traceback.print_exc()
        
        return ""
    
    def get_pending_retries(self, limit: int = 10) -> List[Dict]:
        """Get entries that can be retried."""
        try:
            result = self.supabase.table("dlq_embedding_failures").select("*").eq(
                "retry_count", 0  # Not yet retried
            ).lt("retry_count", "max_retries").order("created_at", desc=False).limit(limit).execute()
            
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Failed to get pending retries: {e}")
            return []
    
    def mark_retried(self, entry_id: str, success: bool = False):
        """Mark an entry as retried."""
        try:
            entry_result = self.supabase.table("dlq_embedding_failures").select("*").eq(
                "id", entry_id
            ).execute()
            
            if not entry_result.data:
                return
            
            entry = entry_result.data[0]
            new_retry_count = entry["retry_count"] + 1
            
            update_data = {
                "retry_count": new_retry_count,
                "last_retry_at": datetime.now().isoformat()
            }
            
            if success:
                # Mark as resolved
                update_data["resolved_at"] = datetime.now().isoformat()
            
            self.supabase.table("dlq_embedding_failures").update(update_data).eq(
                "id", entry_id
            ).execute()
            
            logger.info(f"Marked DLQ entry {entry_id} as retried (count: {new_retry_count})")
        except Exception as e:
            logger.error(f"Failed to mark entry as retried: {e}")


# Singleton
_dlq = None


def get_dlq() -> DeadLetterQueue:
    """Get global DLQ instance."""
    global _dlq
    if _dlq is None:
        _dlq = DeadLetterQueue()
    return _dlq

