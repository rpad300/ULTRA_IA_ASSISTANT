
import asyncio
import sys
import os

# Ensure backend in path
sys.path.append(os.path.join(os.path.dirname(__file__), "../src/backend"))

from services.qdrant_service import init_qdrant_service
import uuid
import logging

# Configure Logging to see QdrantService output
logging.basicConfig(level=logging.INFO)

async def test_ascii_folding():
    print("--- TESTING ASCII FOLDING (SOTA) ---")
    
    try:
        service = await init_qdrant_service()

        # Check Collection Info to see if index exists
        info = await service.client.get_collection(service.collection_name)
        print(f"DEBUG: Collection Info: {info}")
        if 'content' in info.payload_schema:
             print(f"DEBUG: Content Index Schema: {info.payload_schema['content']}")
        else:
             print("DEBUG: 'content' field is NOT indexed yet.")

        # Check Server Version
        telemetry = await service.client.get_telemetry(anonymize=False)
        print(f"DEBUG: Server Version: {telemetry.app.version}")

        # 1. Upsert Test Data (Portuguese with accents)
        test_id = str(uuid.uuid4())
        text_source = "O coração da inteligência artificial é a inovação."
        metadata = {
            "company_id": "debug-company",
            "type": "test_ascii_folding"
        }
        vector = [0.1] * 768 # Dummy vector
        
        print(f"Upserting: '{text_source}'...")
        await service.upsert_text(text_source, vector, metadata, point_id=test_id)
        
        # Wait for indexing (usually instant for single point, but let's be safe)
        await asyncio.sleep(2)
        
        # 2. Search with Normalized Query (No accents)
        # We use a dummy vector for similarity, but rely on the Mock/Real service.
        # Wait, Qdrant search relies on vector + filter. 
        # But we want to test FULL TEXT SEARCH here?
        # Qdrant `search_context` uses vector query + filter.
        # It DOES NOT natively do full-text search on the 'content' field in `search_context`.
        # Wait, my implementation of `search_context` in `qdrant_service.py` uses `query_filter`.
        # Does it use a text match?
        # Let's check `search_context` again.
        
        # Checking qdrant_service.py...
        # search_context takes `company_id`, etc.
        # It performs vector search.
        # It DOES NOT seem to have a 'text' parameter for full text filtering.
        
        # If I want to test ASCII Folding, I must use a Filter with a "match" condition on the "content" field.
        # My updated code added the index, but `search_context` doesn't expose a way to query it yet!
        # I need to verify if I can search using a custom filter or if I need to update `search_context` too.
        
        # For this test, I will access the client directly to perform a scroll/search with text filter.
        
        from qdrant_client import models
        
        print("Searching for 'coracao' (no cedilla, no tilde)...")
        
        # Filter: field "content" match "coracao"
        scroll_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="content",
                    match=models.MatchText(text="coracao") # SOTA: Should match "coração"
                ),
                models.FieldCondition(
                   key="type",
                   match=models.MatchValue(value="test_ascii_folding")
                )
            ]
        )
        
        results, _ = await service.client.scroll(
            collection_name=service.collection_name,
            scroll_filter=scroll_filter,
            limit=1
        )
        
        if results:
            print("SUCCESS: Found match!")
            print(f"Payload: {results[0].payload['content']}")
        else:
            print("FAILURE: No match found. ASCII Folding might not be active or index not ready.")
            
        # Cleanup
        await service.client.delete(
            collection_name=service.collection_name,
            points_selector=models.PointIdsList(points=[test_id])
        )
        
    except Exception as e:
        print(f"Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ascii_folding())
