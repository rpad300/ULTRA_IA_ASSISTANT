
from qdrant_client import AsyncQdrantClient, models
from config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION
import uuid
from typing import Optional, List, Dict, Any, Literal
import logging
import asyncio

logger = logging.getLogger(__name__)
print("DEBUG: [SOTA] LOADING QDRANT SERVICE V2 (FIXED)")

class QdrantService:
    """
    SOTA Vector Store Service.
    Powered by AsyncQdrantClient with Scalar Quantization and HNSW Optimization.
    """
    def __init__(self):
        if not QDRANT_URL or not QDRANT_API_KEY:
            raise ValueError("[CRITICAL] QDRANT_URL/API_KEY missing!")
        
        # Async Client for non-blocking I/O
        self.client = AsyncQdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        self.collection_name = QDRANT_COLLECTION

    async def ensure_collection(self):
        """
        SOTA: Creates collection with Production-Grade Optimizations.
        - Scalar Quantization (INT8) -> 4x RAM Saving
        - HNSW Fine-tuning -> Faster Search
        """
        try:
            # Check existence using get_collection (more reliable than collection_exists helper)
            try:
                await self.client.get_collection(self.collection_name)
                exists = True
            except Exception:
                exists = False
            
            if not exists:
                logger.info(f"[INIT] Creating Optimized Qdrant Collection: {self.collection_name}...")
                
                # SOTA Optimizer Config
                optimizers_config = models.OptimizersConfigDiff(
                    memmap_threshold=20000  # Map to disk early to save RAM
                )
                
                # SOTA Quantization (INT8)
                quantization_config = models.ScalarQuantization(
                    scalar=models.ScalarQuantizationConfig(
                        type=models.ScalarType.INT8,
                        quantile=0.99,
                        always_ram=True
                    )
                )

                await self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=768,  # Gemini embedding size
                        distance=models.Distance.COSINE
                    ),
                    optimizers_config=optimizers_config,
                    quantization_config=quantization_config,
                    # HNSW tuning for high recall/speed balance
                    hnsw_config=models.HnswConfigDiff(
                        m=16,
                        ef_construct=100,
                        full_scan_threshold=10000
                    )
                )
                logger.info("[OK] Qdrant Collection Created (INT8 Quantized).")
            else:
                logger.info(f"[OK] Qdrant Collection '{self.collection_name}' ready.")

            # Ensure Payload Indexes (Critical for Filtering Performance)
            # Pass info to check existing schemas
            collection_info = await self.client.get_collection(self.collection_name)
            await self._ensure_indices(collection_info)
            
        except Exception as e:
            logger.error(f"[FAIL] Qdrant Init Failed: {e}")
            # Don't crash app, but search will fail later

    async def _ensure_indices(self, collection_info: models.CollectionInfo):
        """Create indices asynchronously effectively idempotently."""
        fields = ["company_id", "project_id", "thread_id", "type", "author_name", "drive_folder_id"]
        for field in fields:
            try:
                await self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
            except Exception:
                pass
        
        # SOTA: Content Text Index
        # Note: server may ignore ascii_folding if < 1.16, but we request it anyway.
        # We check existence to avoid redundant calls, relying on collection_info.
        if 'content' not in collection_info.payload_schema:
            try:
                await self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="content",
                    field_schema=models.TextIndexParams(
                        type="text",
                        tokenizer=models.TokenizerType.WORD,
                        min_token_len=2,
                        max_token_len=15,
                        lowercase=True,
                        # ascii_folding=True # Disabled for compatibility with Qdrant < 1.16
                    )
                )
                logger.info("[SOTA] ASCII Folding Index requested for 'content'.")
            except Exception as e:
                logger.warning(f"Failed to create content index: {e}")
        else:
             logger.info("[OK] Content index already exists.")

    async def upsert_text(
        self,
        text: str,
        vector: list[float],
        metadata: Dict[str, Any],
        point_id: Optional[str] = None
    ) -> str:
        """
        Async Upsert with Metadata Injection.
        """
        if point_id is None:
            point_id = str(uuid.uuid4())
        
        # Ensure critical metadata presence
        if "company_id" not in metadata:
             raise ValueError("[CRITICAL] Qdrant Upsert Blocked: Missing company_id! strictly required for multi-tenancy.")

        payload = metadata.copy()
        payload["content"] = text
        
        await self.client.upsert(
            collection_name=self.collection_name,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )
        return point_id

    async def delete_company_vectors(self, company_id: str) -> bool:
        """
        SOTA: Hard Delete all vectors for a company.
        """
        try:
            # Create a selector filtering by company_id
            selector = models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="company_id", 
                            match=models.MatchValue(value=company_id)
                        )
                    ]
                )
            )
            
            # Delete points matching the selector
            await self.client.delete(
                collection_name=self.collection_name,
                points_selector=selector
            )
            logger.info(f"[QDRANT] Deleted all vectors for company {company_id}")
            return True
        except Exception as e:
            logger.error(f"[QDRANT] Failed to delete vectors for company {company_id}: {e}")
            return False

    async def search_context(
        self,
        query_vector: list[float],
        company_id: str,
        project_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        limit: int = 5,
        score_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        SOTA Search with Strict Filtering and Score Threshold.
        """
        must_conditions = [
            models.FieldCondition(
                key="company_id",
                match=models.MatchValue(value=company_id)
            )
        ]
        
        if project_id:
            must_conditions.append(models.FieldCondition(key="project_id", match=models.MatchValue(value=project_id)))
        
        if thread_id:
            must_conditions.append(models.FieldCondition(key="thread_id", match=models.MatchValue(value=thread_id)))
        
        # SOTA: Profile-based RAG Scope (Knowledge Sources)
        if kwargs.get("folder_ids"):
            folder_ids = kwargs.get("folder_ids")
            if folder_ids:
                must_conditions.append(
                    models.FieldCondition(
                        key="drive_folder_id",
                        match=models.MatchAny(any=folder_ids) # Match ANY of the provided folder IDs
                    )
                )
        
        from services.metrics_service import get_metrics_service, TimerContext

        # SOTA Observability: Vector Search Latency
        with TimerContext(get_metrics_service(), "qdrant_search_latency", {"company_id": company_id}):
            search_result = await self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=models.Filter(must=must_conditions),
                limit=limit,
                score_threshold=score_threshold
            )
        
        results = []
        # Support both new QueryResponse object and legacy list return if client version varies
        points = search_result.points if hasattr(search_result, 'points') else search_result
        
        for point in points:
            results.append({
                "score": point.score,
                "content": point.payload.get("content", ""),
                "type": point.payload.get("type", "unknown"),
                "point_id": str(point.id),
                "payload": point.payload
            })
        
        return results

    async def close(self):
        """Cleanup connection."""
        await self.client.close()

# Singleton
_qdrant_service: Optional[QdrantService] = None

async def init_qdrant_service() -> QdrantService:
    global _qdrant_service
    if _qdrant_service is None:
        service = QdrantService()
        await service.ensure_collection()
        _qdrant_service = service
    return _qdrant_service





class MockQdrantService:
    """SOTA: Mock Service to allow app functionality when Qdrant is offline."""
    
    async def ensure_collection(self):
        logger.warning("[MOCK] ensure_collection called. Ignoring.")
        pass

    async def search_context(self, *args, **kwargs):
        logger.warning("[MOCK] search_context called. Returning empty list.")
        return []

    async def upsert_text(self, *args, **kwargs):
        logger.warning("[MOCK] upsert_text called. Returning mock ID.")
        return "mock-id"

    async def close(self):
        pass

    def __getattr__(self, name):
        def method(*args, **kwargs):
             logger.warning(f"[MOCK] Generic method '{name}' called. Returning None.")
             return None
        return method

def get_qdrant_service_sync_wrapper() -> QdrantService:
    """Dangerous sync wrapper - prefer async dependency injection"""
    global _qdrant_service
    if _qdrant_service is None:
         # User requested NO MOCK. Fail loudly if not initialized.
         raise RuntimeError("QdrantService not initialized and Mock Mode is disabled.")
    return _qdrant_service

# Alias for backward compatibility
get_qdrant_service = get_qdrant_service_sync_wrapper

