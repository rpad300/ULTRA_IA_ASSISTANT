
import os
import sys
import asyncio
import logging
from unittest.mock import MagicMock, patch

# Add src/backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_keeper")

# Mock google.genai BEFORE imports to avoid dependency issues
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = MagicMock()
sys.modules["google.genai.types"] = MagicMock()
sys.modules["qdrant_client"] = MagicMock()
sys.modules["qdrant_client.models"] = MagicMock()
sys.modules["supabase"] = MagicMock()
sys.modules["supabase.lib"] = MagicMock()
sys.modules["supabase.lib.client_options"] = MagicMock()
sys.modules["google.auth"] = MagicMock()
sys.modules["google.auth.transport"] = MagicMock()
sys.modules["google.auth.transport.requests"] = MagicMock()
sys.modules["google.oauth2"] = MagicMock()
sys.modules["google.oauth2.credentials"] = MagicMock()
sys.modules["googleapiclient"] = MagicMock()
sys.modules["googleapiclient.discovery"] = MagicMock()
sys.modules["googleapiclient.http"] = MagicMock()
sys.modules["googleapiclient.errors"] = MagicMock()

def verify_pipeline():
    print("--- Verifying Knowledge Keeper Pipeline ---")

    # 1. Verify Imports
    try:
        import xxhash
        import fitz
        from tasks.ingestion_tasks import process_file_ingestion
        from services.text_extraction_service import TextExtractionService
        from services.qdrant_service import QdrantService
        print("[OK] Imports successful (xxhash, pymupdf, tasks)")
    except ImportError as e:
        print(f"[FAIL] Import failed: {e}")
        return

    # 2. Mock Services to avoid real DB calls during quick verification
    # We want to verify the ORCHESTRATION logic in process_file_ingestion
    
    with patch("tasks.ingestion_tasks.get_embedding_service") as mock_get_embed, \
         patch("tasks.ingestion_tasks.get_redis_service") as mock_get_redis:
         
        # Setup Mocks
        mock_embed_svc = MagicMock()
        mock_get_embed.return_value = mock_embed_svc
        
        # Mock Redis
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        # Async mocks are tricky with MagicMock, ensuring compat
        async def async_get_json(*args, **kwargs): return None # Simulate no dupe
        async def async_set_json(*args, **kwargs): return True
        mock_redis.get_json.side_effect = async_get_json
        mock_redis.set_json.side_effect = async_set_json
        
        # Mock Embed Service methods
        mock_embed_svc.chunk_text.return_value = ["Chunk 1 content", "Chunk 2 content"]
        async def async_get_embedding(*args): return [0.1] * 768
        mock_embed_svc.gemini.get_embedding.side_effect = async_get_embedding
        
        async def async_upsert(*args, **kwargs): return "point_id_123"
        mock_embed_svc.qdrant.upsert_text.side_effect = async_upsert

        # Create a dummy file
        with open("test_doc.txt", "w") as f:
            f.write("Header 1\nThis is a test document for verification.")
            
        print("[INFO] Starting Ingestion Task Mock...")
        
        # Run Task
        try:
            # metadata
            meta = {"drive_url": "http://drive.google.com/test"}
            result = process_file_ingestion("test_doc.txt", "company-uuid-123", meta)
            
            print(f"[RESULT] Task Result: {result}")
            
            if result["status"] == "success" and result["total"] == 2:
                print("[OK] Ingestion Logic Verified.")
            else:
                print("[FAIL] Ingestion Logic returned unexpected result.")
                
            # Verify Qdrant Upsert called
            if mock_embed_svc.qdrant.upsert_text.called:
                print("[OK] Qdrant Upsert called.")
            else:
                print("[FAIL] Qdrant Upsert NOT called.")

        except Exception as e:
            print(f"[FAIL] Task execution error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if os.path.exists("test_doc.txt"):
                os.remove("test_doc.txt")

if __name__ == "__main__":
    verify_pipeline()
