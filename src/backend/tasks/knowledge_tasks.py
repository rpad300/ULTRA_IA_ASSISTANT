from celery_app import celery
from services.lightrag_service import get_lightrag_service
import asyncio
import logging

logger = logging.getLogger(__name__)

@celery.task(name="tasks.knowledge_tasks.index_graph_task")
def index_graph_task(text: str, company_id: str):
    """
    Background task to update the LightRAG Knowledge Graph.
    This prevents blocking the WebSocket loop during live transcription.
    """
    try:
        logger.info(f"[Celery] Starting Graph Indexing for {company_id} ({len(text)} chars)")
        
        # Helper to run async service method in sync Celery worker
        async def _run():
            service = get_lightrag_service(company_id)
            await service.insert_incremental(text)
            
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_run())
        loop.close()
        
        logger.info(f"[Celery] Graph Indexing Complete for {company_id}")
        return {"status": "success", "company_id": company_id}
        
    except Exception as e:
        logger.error(f"[Celery] Graph Indexing Failed: {e}", exc_info=True)
        return {"status": "failed", "error": str(e)}
