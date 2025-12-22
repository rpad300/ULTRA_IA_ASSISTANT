from qdrant_client import QdrantClient
from qdrant_client.http import models
from config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION
import uuid
from typing import Optional, List, Dict, Any

class QdrantService:
    def __init__(self):
        if not QDRANT_URL or not QDRANT_API_KEY:
            raise ValueError("QDRANT_URL and QDRANT_API_KEY must be set in .env")
        
        self.client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        self.collection_name = QDRANT_COLLECTION

    def ensure_collection(self):
        """Creates the collection if it doesn't exist."""
        collections = self.client.get_collections()
        exists = any(c.name == self.collection_name for c in collections.collections)
        
        if not exists:
            print(f"Creating Qdrant collection: {self.collection_name}")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=768,  # Gemini embedding size (text-embedding-004 is 768)
                    distance=models.Distance.COSINE
                )
            )
        else:
            print(f"Qdrant collection '{self.collection_name}' already exists.")

        # Ensure payload indexes for filtering performance and to avoid "Index required" errors
        # company_id is critical for multi-tenancy
        try:
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="company_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="project_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="thread_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            print("Verified Qdrant payload indexes.")
        except Exception as e:
            # It might fail if index creation is already in progress or other transient issues
            print(f"Warning: Could not create Qdrant payload indexes: {e}")

    def search(self, query_vector: list[float], limit: int = 5, filter_dict: dict = None):
        """
        Generic search method with vector and optional filters.
        """
        search_params = models.SearchParams(hnsw_ef=128, exact=False)
        
        # Build filter if provided (Simple wrapper, expand for complex queries)
        q_filter = None
        if filter_dict:
            must_conditions = []
            for key, val in filter_dict.items():
                must_conditions.append(
                    models.FieldCondition(key=key, match=models.MatchValue(value=val))
                )
            q_filter = models.Filter(must=must_conditions)

        result = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=q_filter,
            limit=limit,
            search_params=search_params
        )
        return result.points

    def upsert_text(
        self,
        text: str,
        vector: list[float],
        metadata: Dict[str, Any],
        point_id: Optional[str] = None
    ) -> str:
        """
        Upserts a text with its embedding vector and metadata into Qdrant.
        
        Args:
            text: The content text to store
            vector: 768-dimensional embedding vector
            metadata: Payload dictionary with company_id, project_id, thread_id, type, etc.
            point_id: Optional UUID string. If not provided, generates a new one.
        
        Returns:
            The point_id (UUID string) used for this point
        
        Payload structure (as per spec):
        {
            "company_id": "uuid-string",   # CRITICAL: Multi-tenancy filter
            "project_id": "uuid-string",   # Context filter
            "thread_id": "uuid-string",    # Conversation filter
            "type": "message",             # or 'document', 'summary'
            "content": "Full text...",     # Injected into LLM context
            "original_created_at": "2024-01-01T12:00:00Z",
            "author_name": "Alice Backend",
            "meta_tags": ["urgent", "budget"]  # Optional
        }
        """
        if point_id is None:
            point_id = str(uuid.uuid4())
        
        # Ensure content is in metadata
        payload = metadata.copy()
        payload["content"] = text
        
        # Upsert point
        self.client.upsert(
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

    def search_context(
        self,
        query_vector: list[float],
        company_id: str,
        project_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Searches for context with strict multi-tenancy filtering.
        
        Args:
            query_vector: 768-dimensional query embedding
            company_id: REQUIRED - Multi-tenancy filter (CRITICAL for security)
            project_id: Optional - Filter by project
            thread_id: Optional - Filter by thread/conversation
            limit: Maximum number of results
        
        Returns:
            List of search results with payload and score, formatted for RAG context construction
        """
        # Build filter with company_id as mandatory
        must_conditions = [
            models.FieldCondition(
                key="company_id",
                match=models.MatchValue(value=company_id)
            )
        ]
        
        # Add optional filters
        if project_id:
            must_conditions.append(
                models.FieldCondition(
                    key="project_id",
                    match=models.MatchValue(value=project_id)
                )
            )
        
        if thread_id:
            must_conditions.append(
                models.FieldCondition(
                    key="thread_id",
                    match=models.MatchValue(value=thread_id)
                )
            )
        
        q_filter = models.Filter(must=must_conditions)
        search_params = models.SearchParams(hnsw_ef=128, exact=False)
        
        # Perform search
        # Perform search using query_points (search was removed in client v1.11+)
        result = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=q_filter,
            limit=limit,
            search_params=search_params
        )
        results = result.points
        
        # Format results for RAG context
        formatted_results = []
        for result in results:
            formatted_results.append({
                "score": result.score,
                "content": result.payload.get("content", ""),
                "type": result.payload.get("type", "unknown"),
                "author_name": result.payload.get("author_name", ""),
                "original_created_at": result.payload.get("original_created_at", ""),
                "meta_tags": result.payload.get("meta_tags", []),
                "point_id": str(result.id),
                "payload": result.payload  # Full payload for advanced use cases
            })
        
        return formatted_results

# Singleton pattern if needed, or instantiate per request
_qdrant_service = None

def get_qdrant_service():
    global _qdrant_service
    if _qdrant_service is None:
        _qdrant_service = QdrantService()
    return _qdrant_service
