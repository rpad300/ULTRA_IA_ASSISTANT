"""
EmbeddingService: Orchestrator for dual-write flow (Supabase -> Embed -> Qdrant -> Index)

This service handles the complete flow:
1. Generate embedding using Gemini
2. Upsert to Qdrant with structured payload
3. Save reference to Supabase embedding_index

This prevents ThreadService and other services from becoming bloated with vector logic.
"""

import hashlib
import logging
from typing import Optional, Dict, Any, List
from services.gemini_service import get_gemini_service
from services.qdrant_service import get_qdrant_service
from services.retry_utils import retry_with_backoff
from services.rate_limiter import get_embedding_rate_limiter
from services.embedding_cache import get_embedding_cache
from services.metrics_service import get_metrics_service, TimerContext
from services.dead_letter_queue import get_dlq, FailureReason
from db.supabase_client import get_supabase_client
import uuid
import asyncio

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self.gemini = get_gemini_service()
        self.qdrant = get_qdrant_service()
        self.supabase = get_supabase_client()
        self.rate_limiter = get_embedding_rate_limiter()
        self.cache = get_embedding_cache()
        self.metrics = get_metrics_service()
        self.dlq = get_dlq()

    def _compute_content_hash(self, content: str) -> str:
        """Compute SHA256 hash of content to detect changes."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    def _validate_sync_params(
        self,
        content: str,
        company_id: str
    ):
        """Validate parameters before syncing to vector store."""
        if not content or not content.strip():
            raise ValueError("Content cannot be empty")
        if not company_id:
            raise ValueError("company_id is required for multi-tenancy")
        if len(content) > 100000:  # Reasonable limit
            raise ValueError(f"Content too large ({len(content)} chars). Use chunking for large documents.")

    async def sync_message_to_vector(
        self,
        message_id: str,
        content: str,
        company_id: str,
        project_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        author_name: Optional[str] = None,
        original_created_at: Optional[str] = None,
        meta_tags: Optional[list] = None,
        metadata: Optional[Dict[str, Any]] = None, # New SOTA arg
        chunk_index: int = 0
    ) -> str:
        """
        Syncs a message to the vector store (Qdrant) and creates an index entry.
        """
        # ... (lines omitted for brevity, logic remains same until payload build) ...

        # Fix for default-company string being passed as UUID
        if company_id == "default-company" or company_id == "00000000-0000-0000-0000-000000000000":
             try:
                 from db.supabase_client import get_supabase_client
                 supabase = get_supabase_client()
                 res = supabase.table("companies").select("id").limit(1).execute()
                 if res.data:
                     company_id = res.data[0]["id"]
                 else:
                     company_id = "00000000-0000-0000-0000-000000000000"
             except:
                 company_id = "00000000-0000-0000-0000-000000000000"

        # 0. Validate parameters
        self._validate_sync_params(content, company_id)
        
        # 1. Compute content hash
        content_hash = self._compute_content_hash(content)
        
        # 2. Check if already embedded (avoid duplicate work)
        existing = self.supabase.table("embedding_index").select("*").eq(
            "external_type", "message"
        ).eq("external_id", message_id).eq("chunk_index", chunk_index).execute()
        
        if existing.data:
            existing_record = existing.data[0]
            if existing_record.get("content_hash") == content_hash:
                return existing_record["qdrant_point_id"]
            point_id = existing_record["qdrant_point_id"]
        else:
            point_id = None
        
        # 3. Check cache first
        vector = self.cache.get(content)
        
        if vector is None:
            await self.rate_limiter.wait_if_needed("embedding")
            try:
                with TimerContext(self.metrics, "embedding_generation", {"type": "message"}):
                    vector = await retry_with_backoff(
                        self.gemini.get_embedding,
                        max_retries=3,
                        initial_delay=1.0,
                        content=content
                    )
                self.cache.set(content, vector)
                self.metrics.increment("embeddings_generated", tags={"type": "message"})
            except Exception as e:
                logger.error(f"Failed to generate embedding after retries: {e}")
                self.metrics.increment("embedding_failures", tags={"type": "message"})
                self.dlq.add_failure(
                    operation_type="sync_message",
                    external_id=message_id,
                    content_preview=content[:200],
                    failure_reason=FailureReason.EMBEDDING_FAILED,
                    error_message=str(e),
                    metadata={"company_id": company_id, "thread_id": thread_id}
                )
                raise ValueError(f"Failed to generate embedding: {str(e)}")
        else:
            self.metrics.increment("embedding_cache_hits", tags={"type": "message"})
        
        # 4. Build Qdrant payload (SOTA: Enriched Metadata)
        payload = {
            "company_id": company_id,
            "type": "message",
            "content": content,
            "original_created_at": original_created_at or "",
            "author_name": author_name or "",
            "meta_tags": meta_tags or []
        }
        
        # Merge extra metadata if provided
        if metadata:
            payload.update(metadata)
        
        if project_id:
            payload["project_id"] = project_id
        if thread_id:
            payload["thread_id"] = thread_id
        
        # 5. Upsert to Qdrant (with retry)
        try:
            # Note: Qdrant upsert is synchronous, so we wrap it
            def _upsert():
                return self.qdrant.upsert_text(
                    text=content,
                    vector=vector,
                    metadata=payload,
                    point_id=point_id
                )
            qdrant_point_id = await retry_with_backoff(
                _upsert,
                max_retries=3,
                initial_delay=1.0
            )
        except Exception as e:
            logger.error(f"Failed to upsert to Qdrant after retries: {e}")
            raise ValueError(f"Failed to upsert to Qdrant: {str(e)}")
        
        # 6. Save/Update index in Supabase
        index_data = {
            "external_type": "message",
            "external_id": message_id,
            "qdrant_point_id": qdrant_point_id,
            "company_id": company_id,
            "project_id": project_id,
            "thread_id": thread_id,
            "chunk_index": chunk_index,
            "content_hash": content_hash
        }
        
        try:
            if existing.data:
                # Update existing record
                self.supabase.table("embedding_index").update(index_data).eq(
                    "id", existing.data[0]["id"]
                ).execute()
            else:
                # Insert new record
                self.supabase.table("embedding_index").insert(index_data).execute()
            logger.info(f"Successfully synced message {message_id} to vector store")
        except Exception as e:
            # Log error but don't fail - Qdrant already has the data
            logger.warning(f"Failed to save embedding_index for message {message_id}: {str(e)}")
            # Could implement retry queue here
        
        return qdrant_point_id

    async def search_context(
        self,
        query: str,
        company_id: str,
        project_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        limit: int = 5
    ) -> list[Dict[str, Any]]:
        """
        Searches for relevant context using RAG.
        
        Args:
            query: Natural language query
            company_id: REQUIRED - Multi-tenancy filter
            project_id: Optional project filter
            thread_id: Optional thread filter
            limit: Maximum number of results
        
        Returns:
            List of formatted results with content, score, and metadata
        """
        # 1. Generate query embedding
        try:
            query_vector = await self.gemini.get_query_embedding(query)
        except Exception as e:
            raise ValueError(f"Failed to generate query embedding: {str(e)}")
        
        # 2. Search Qdrant with filters
        results = self.qdrant.search_context(
            query_vector=query_vector,
            company_id=company_id,
            project_id=project_id,
            thread_id=thread_id,
            limit=limit
        )
        
        return results

    async def format_context_for_llm(self, search_results: list[Dict[str, Any]]) -> str:
        """
        Formats search results into a context string for LLM injection.
        
        Example output:
        Context:
        - [Alice, Yesterday]: "The budget is tight." (Score: 0.92)
        - [Bob, Last Week]: "We need to review the timeline." (Score: 0.87)
        """
        if not search_results:
            return "No relevant context found."
        
        context_lines = ["Context:"]
        for result in search_results:
            author = result.get("author_name", "Unknown")
            timestamp = result.get("original_created_at", "")
            content = result.get("content", "")
            score = result.get("score", 0.0)
            
            # Format timestamp if available
            time_str = ""
            if timestamp:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    time_str = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    time_str = timestamp[:10] if len(timestamp) >= 10 else ""
            
            context_lines.append(
                f"- [{author}{', ' + time_str if time_str else ''}]: \"{content[:200]}...\" (Score: {score:.2f})"
            )
        
        return "\n".join(context_lines)

    async def batch_sync_messages(
        self,
        messages: List[Dict[str, Any]],
        batch_size: int = 10
    ) -> Dict[str, Any]:
        """
        Batch process multiple messages for vector sync.
        
        Args:
            messages: List of message dicts with keys: message_id, content, company_id, 
                     project_id, thread_id, original_created_at
            batch_size: Number of messages to process concurrently
        
        Returns:
            Dict with success_count, failure_count, and results
        """
        results = {
            "success_count": 0,
            "failure_count": 0,
            "results": []
        }
        
        # Process in batches to avoid overwhelming the system
        for i in range(0, len(messages), batch_size):
            batch = messages[i:i + batch_size]
            
            # Process batch concurrently
            tasks = [
                self.sync_message_to_vector(
                    message_id=msg["message_id"],
                    content=msg["content"],
                    company_id=msg["company_id"],
                    project_id=msg.get("project_id"),
                    thread_id=msg.get("thread_id"),
                    original_created_at=msg.get("original_created_at")
                )
                for msg in batch
            ]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for msg, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    results["failure_count"] += 1
                    results["results"].append({
                        "message_id": msg["message_id"],
                        "status": "failed",
                        "error": str(result)
                    })
                else:
                    results["success_count"] += 1
                    results["results"].append({
                        "message_id": msg["message_id"],
                        "status": "success",
                        "qdrant_point_id": result
                    })
            
            # Small delay between batches to respect rate limits
            if i + batch_size < len(messages):
                await asyncio.sleep(0.5)
        
        self.metrics.increment("batch_sync_completed", tags={"total": len(messages)})
        logger.info(
            f"Batch sync completed: {results['success_count']} success, "
            f"{results['failure_count']} failures"
        )
        
        return results

    async def sync_session_summary_to_vector(
        self,
        session_id: str,
        summary_text: str,
        company_id: str,
        project_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        original_created_at: Optional[str] = None
    ) -> str:
        """
        Syncs a session summary to the vector store.
        
        Args:
            session_id: UUID of the session in Supabase
            summary_text: Summary text to embed
            company_id: REQUIRED - Multi-tenancy identifier
            project_id: Optional project context
            thread_id: Optional thread context
            original_created_at: ISO timestamp string
        
        Returns:
            qdrant_point_id: The UUID used as point ID in Qdrant
        """
        # Validate parameters
        self._validate_sync_params(summary_text, company_id)
        
        content_hash = self._compute_content_hash(summary_text)
        
        # Check if already embedded
        existing = self.supabase.table("embedding_index").select("*").eq(
            "external_type", "session_summary"
        ).eq("external_id", session_id).execute()
        
        if existing.data:
            existing_record = existing.data[0]
            if existing_record.get("content_hash") == content_hash:
                return existing_record["qdrant_point_id"]
            point_id = existing_record["qdrant_point_id"]
        else:
            point_id = None
        
        # Generate embedding (with retry)
        try:
            vector = await retry_with_backoff(
                self.gemini.get_embedding,
                max_retries=3,
                initial_delay=1.0,
                content=summary_text
            )
        except Exception as e:
            logger.error(f"Failed to generate embedding for session {session_id}: {e}")
            raise ValueError(f"Failed to generate embedding: {str(e)}")
        
        # Build payload
        payload = {
            "company_id": company_id,
            "type": "session_summary",
            "content": summary_text,
            "original_created_at": original_created_at or "",
            "author_name": "System",
            "meta_tags": ["summary", "session"]
        }
        
        if project_id:
            payload["project_id"] = project_id
        if thread_id:
            payload["thread_id"] = thread_id
        
        # Upsert to Qdrant (with retry)
        try:
            def _upsert():
                return self.qdrant.upsert_text(
                    text=summary_text,
                    vector=vector,
                    metadata=payload,
                    point_id=point_id
                )
            qdrant_point_id = await retry_with_backoff(
                _upsert,
                max_retries=3,
                initial_delay=1.0
            )
        except Exception as e:
            logger.error(f"Failed to upsert session summary to Qdrant: {e}")
            raise ValueError(f"Failed to upsert to Qdrant: {str(e)}")
        
        # Save index
        index_data = {
            "external_type": "session_summary",
            "external_id": session_id,
            "qdrant_point_id": qdrant_point_id,
            "company_id": company_id,
            "project_id": project_id,
            "thread_id": thread_id,
            "chunk_index": 0,
            "content_hash": content_hash
        }
        
        try:
            if existing.data:
                self.supabase.table("embedding_index").update(index_data).eq(
                    "id", existing.data[0]["id"]
                ).execute()
            else:
                self.supabase.table("embedding_index").insert(index_data).execute()
            logger.info(f"Successfully synced session summary {session_id} to vector store")
        except Exception as e:
            logger.warning(f"Failed to save embedding_index for session {session_id}: {str(e)}")
        
        return qdrant_point_id

    def chunk_text(self, text: str, max_chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Splits long text into chunks with overlap for better context preservation.
        
        Args:
            text: Text to chunk
            max_chunk_size: Maximum characters per chunk
            overlap: Number of characters to overlap between chunks
        
        Returns:
            List of text chunks
        """
        if len(text) <= max_chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + max_chunk_size
            
            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence endings
                for break_char in ['. ', '.\n', '! ', '!\n', '? ', '?\n']:
                    last_break = text.rfind(break_char, start, end)
                    if last_break != -1:
                        end = last_break + 1
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start with overlap
            start = end - overlap if end < len(text) else end
        
        return chunks

    async def delete_session_vectors(self, session_id: str):
        """
        Deletes all vectors associated with a specific session summary.
        Also we should check if we want to delete ALL messages if they are tagged with this session, 
        but currently messages are linked to threads, not sessions directly.
        So we primarily delete the session summary.
        """
        try:
            # Delete from Qdrant where external_id = session_id (via embedding_index lookup) or just try to find based on metadata?
            # Our Qdrant payload doesn't necessarily store session_id directly in top level metadata unless we put it there.
            # But we have `embedding_index`.
            
            # 1. Find Qdrant Points from Supabase Index
            records = self.supabase.table("embedding_index").select("qdrant_point_id").eq("external_id", session_id).eq("external_type", "session_summary").execute()
            
            if records.data:
                # 2. Delete from Qdrant
                # We can delete by ID
                points_to_delete = [r["qdrant_point_id"] for r in records.data]
                if points_to_delete:
                    # Qdrant client delete by IDs
                     self.qdrant.client.delete(
                        collection_name=self.qdrant.collection_name,
                        points_selector=models.PointIdsList(points=points_to_delete)
                    )
            
            # 3. Clean up Supabase Index
            self.supabase.table("embedding_index").delete().eq("external_id", session_id).eq("external_type", "session_summary").execute()
            
        except Exception as e:
            logger.error(f"Error deleting session vectors for {session_id}: {e}")


# Singleton
_embedding_service = None

def get_embedding_service():
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service

