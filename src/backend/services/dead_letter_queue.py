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
    SOTA DLQ: Async, Non-blocking, and Self-Healing.
    Uses Async Supabase Client to prevent Event Loop blocking.
    """
    
    def __init__(self):
        # We don't init client in __init__ because it's async
        pass
    
    async def add_failure(
        self,
        operation_type: str,
        external_id: str,
        content_preview: str,
        failure_reason: FailureReason,
        error_message: str,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Add a failed operation to the DLQ (Async).
        Non-blocking execution for high-throughput resilience.
        """
        from db.supabase_client import get_async_supabase_client
        
        entry = DLQEntry(
            operation_type=operation_type,
            external_id=external_id,
            content_preview=content_preview[:200],
            failure_reason=failure_reason.value,
            error_message=str(error_message)[:1000],
            metadata=metadata or {}
        )
        
        try:
            supabase = await get_async_supabase_client()
            
            # CRITICAL ALERTING: Check for Hemorrhage
            # In a real system, we might check Redis for recent failures count.
            # Here we log critical if it's a fundamental system failure.
            if failure_reason in [FailureReason.QDRANT_UPSERT_FAILED, FailureReason.INDEX_SAVE_FAILED]:
                 logger.critical(f"SYSTEM INTEGRITY RISK: {failure_reason.value} for {external_id}")

            result = await supabase.table("dlq_embedding_failures").insert({
                "operation_type": entry.operation_type,
                "external_id": entry.external_id,
                "content_preview": entry.content_preview,
                "failure_reason": entry.failure_reason,
                "error_message": entry.error_message,
                "retry_count": entry.retry_count,
                "max_retries": entry.max_retries,
                "metadata": entry.metadata,
                "created_at": entry.created_at.isoformat()
            }).execute()
            
            if result.data:
                entry_id = result.data[0]["id"]
                logger.warning(
                    f"Saved to DLQ (Async): {operation_type} {external_id} "
                    f"(reason: {failure_reason.value})"
                )
                return entry_id
                
        except Exception as e:
            logger.critical(f"DOUBLE FAULT: Failed to save to DLQ: {e}")
            # Last resort: Log to disk or sentry
            import traceback
            traceback.print_exc()
        
        return ""
    
    async def get_pending_retries(self, limit: int = 10) -> List[Dict]:
        """Get entries that can be retried (Async)."""
        from db.supabase_client import get_async_supabase_client
        try:
            supabase = await get_async_supabase_client()
            result = await supabase.table("dlq_embedding_failures").select("*").eq(
                "retry_count", 0
            ).lt("retry_count", "max_retries").order("created_at", desc=False).limit(limit).execute()
            
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Failed to get pending retries: {e}")
            return []
    
    async def mark_retried(self, entry_id: str, success: bool = False):
        """Mark an entry as retried (Async)."""
        from db.supabase_client import get_async_supabase_client
        try:
            supabase = await get_async_supabase_client()
            
            # Fetch current to increment count
            # Ideally use a stored procedure or atomic increment if high concurrency, 
            # but for DLQ retry (scheduled task), read-modify-write is acceptable.
            entry_result = await supabase.table("dlq_embedding_failures").select("retry_count").eq("id", entry_id).execute()
            
            if not entry_result.data: return
            
            current_count = entry_result.data[0]["retry_count"]
            new_count = current_count + 1
            
            update_data = {
                "retry_count": new_count,
                "last_retry_at": datetime.now().isoformat()
            }
            
            if success:
                update_data["resolved_at"] = datetime.now().isoformat()
            
            await supabase.table("dlq_embedding_failures").update(update_data).eq("id", entry_id).execute()
            
            logger.info(f"Marked DLQ entry {entry_id} as retried (New Count: {new_count}, Success: {success})")
            
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

