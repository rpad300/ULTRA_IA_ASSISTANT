
import logging
import asyncio
from celery_app import celery_app
from services.dead_letter_queue import get_dlq, FailureReason
from services.redis_service import get_redis_service
from services.qdrant_service import get_qdrant_service
from tasks.ingestion_tasks import process_file_ingestion

logger = logging.getLogger(__name__)

# Run sync wrapper for async methods
def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@celery_app.task(name="tasks.maintenance_tasks.auto_heal_task")
def auto_heal_task():
    """
    SOTA Self-Healing Task.
    Runs every 30 mins (configured in scheduler).
    Checks DLQ for failed operations and retries them.
    """
    logger.info("Starting Auto-Heal Task...")
    
    dlq = get_dlq()
    
    # 1. Fetch Pending Retries
    # We use run_async because Celery tasks are sync by default
    pending_items = run_async(dlq.get_pending_retries(limit=50))
    
    if not pending_items:
        logger.info("No pending DLQ items to heal.")
        return "No items"
        
    success_count = 0
    fail_count = 0
    
    for item in pending_items:
        logger.info(f"Attempting to heal DLQ item: {item.get('id')} ({item.get('operation_type')})")
        
        try:
             # Logic depends on operation type
             op_type = item.get("operation_type")
             metadata = item.get("metadata") or {}
             
             result = False
             
             if op_type == "ingestion_chunk":
                 # This is a bit complex as we need to re-ingest a specific chunk or file
                 # Often simpler to just re-trigger the whole file ingestion if path exists
                 file_path = metadata.get("source_file") # This might be basename only, need full path if possible
                 # If we stored full path in metadata, great.
                 # Let's assume we store full path in metadata during ingestion failure
                 full_path = metadata.get("full_path") 
                 company_id = metadata.get("company_id")
                 
                 if full_path and company_id:
                     # Re-trigger ingestion
                     # Note: This might duplicate work if only 1 chunk failed. 
                     # Ideally we have a 'process_single_chunk' task.
                     # But for resilience, reprocessing the file is safe because of Deduplication (XXHash).
                     logger.info(f"Retrying ingestion for {full_path}")
                     process_file_ingestion(full_path, company_id, metadata)
                     result = True
                 else:
                     logger.warning(f"Cannot heal item {item['id']}: Missing path/company info")
             
             elif op_type in ["upsert_point", "embedding_failed"]:
                 # Generic Qdrant retry
                 # If we have the vector and payload in metadata (heavy?) or just content
                 content = item.get("content_preview") # This is just preview. Real content needs to be in metadata or fetched.
                 # If we don't have full content, we can't retry.
                 # Assuming metadata contains necessary data to retry.
                 pass
                 
             # Mark as retried
             run_async(dlq.mark_retried(item["id"], success=result))
             
             if result:
                 success_count += 1
             else:
                 fail_count += 1

        except Exception as e:
            logger.error(f"Failed to heal item {item.get('id')}: {e}")
            fail_count += 1
            # Mark retried even if failed, so retry count increments
            run_async(dlq.mark_retried(item["id"], success=False))
            
    logger.info(f"Auto-Heal Complete. Success: {success_count}, Failed: {fail_count}")
    return f"Healed {success_count}, Failed {fail_count}"
