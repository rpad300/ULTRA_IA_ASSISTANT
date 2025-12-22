"""
Comprehensive test suite for Qdrant vector store integration.

Tests:
1. Collection creation
2. Upsert with payload
3. Search with company_id filter (Multi-tenancy verification)
4. End-to-end: Company A cannot see Company B data
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.qdrant_service import get_qdrant_service
from services.gemini_service import get_gemini_service
from services.embedding_service import get_embedding_service
from db.supabase_client import get_supabase_client
import uuid


async def test_collection_creation():
    """Test 1: Verify collection exists or can be created."""
    print("\n=== Test 1: Collection Creation ===")
    try:
        qdrant = get_qdrant_service()
        qdrant.ensure_collection()
        print("✓ Collection exists or was created successfully")
        return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False


async def test_upsert_with_payload():
    """Test 2: Upsert a point with structured payload."""
    print("\n=== Test 2: Upsert with Payload ===")
    try:
        qdrant = get_qdrant_service()
        gemini = get_gemini_service()
        
        # Generate test embedding
        test_text = "This is a test message for Qdrant."
        vector = await gemini.get_embedding(test_text)
        
        # Create test payload
        company_id = str(uuid.uuid4())
        point_id = str(uuid.uuid4())
        
        payload = {
            "company_id": company_id,
            "project_id": str(uuid.uuid4()),
            "thread_id": str(uuid.uuid4()),
            "type": "message",
            "content": test_text,
            "original_created_at": "2024-01-01T12:00:00Z",
            "author_name": "Test User",
            "meta_tags": ["test", "qa"]
        }
        
        result_id = qdrant.upsert_text(
            text=test_text,
            vector=vector,
            metadata=payload,
            point_id=point_id
        )
        
        assert result_id == point_id, f"Expected {point_id}, got {result_id}"
        print(f"✓ Upsert successful. Point ID: {result_id}")
        return True, company_id, point_id
    except Exception as e:
        print(f"✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None


async def test_search_with_filter():
    """Test 3: Search with company_id filter."""
    print("\n=== Test 3: Search with Company Filter ===")
    try:
        qdrant = get_qdrant_service()
        gemini = get_gemini_service()
        
        # Create two companies
        company_a = str(uuid.uuid4())
        company_b = str(uuid.uuid4())
        
        # Insert message for Company A
        text_a = "Secret Code 123"
        vector_a = await gemini.get_embedding(text_a)
        qdrant.upsert_text(
            text=text_a,
            vector=vector_a,
            metadata={
                "company_id": company_a,
                "type": "message",
                "content": text_a,
                "original_created_at": "2024-01-01T12:00:00Z",
                "author_name": "Alice"
            }
        )
        
        # Insert message for Company B
        text_b = "Different Secret 456"
        vector_b = await gemini.get_embedding(text_b)
        qdrant.upsert_text(
            text=text_b,
            vector=vector_b,
            metadata={
                "company_id": company_b,
                "type": "message",
                "content": text_b,
                "original_created_at": "2024-01-01T12:00:00Z",
                "author_name": "Bob"
            }
        )
        
        # Search as Company A
        query = "Secret Code"
        query_vector = await gemini.get_query_embedding(query)
        results_a = qdrant.search_context(
            query_vector=query_vector,
            company_id=company_a,
            limit=10
        )
        
        # Search as Company B
        results_b = qdrant.search_context(
            query_vector=query_vector,
            company_id=company_b,
            limit=10
        )
        
        # Verify isolation
        found_in_a = any("Secret Code 123" in r["content"] for r in results_a)
        found_in_b = any("Secret Code 123" in r["content"] for r in results_b)
        
        assert found_in_a, "Company A should find its own message"
        assert not found_in_b, "Company B should NOT find Company A's message"
        
        print(f"✓ Company A found {len(results_a)} results (including 'Secret Code 123')")
        print(f"✓ Company B found {len(results_b)} results (excluding 'Secret Code 123')")
        print("✓ Multi-tenancy isolation verified")
        
        return True, company_a, company_b
    except Exception as e:
        print(f"✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None


async def test_end_to_end_rag():
    """Test 4: End-to-end RAG flow with EmbeddingService."""
    print("\n=== Test 4: End-to-End RAG Flow ===")
    try:
        supabase = get_supabase_client()
        embedding_service = get_embedding_service()
        
        # Create test company and project
        company_response = supabase.table("companies").insert({
            "name": "Test Company A",
            "description": "For RAG testing"
        }).execute()
        
        if not company_response.data:
            print("⚠ Could not create test company. Skipping E2E test.")
            return False
        
        company_id = company_response.data[0]["id"]
        
        project_response = supabase.table("projects").insert({
            "company_id": company_id,
            "name": "Test Project",
            "description": "For RAG testing"
        }).execute()
        
        if not project_response.data:
            print("⚠ Could not create test project. Skipping E2E test.")
            return False
        
        project_id = project_response.data[0]["id"]
        
        thread_response = supabase.table("threads").insert({
            "company_id": company_id,
            "project_id": project_id,
            "title": "Test Thread",
            "status": "active"
        }).execute()
        
        if not thread_response.data:
            print("⚠ Could not create test thread. Skipping E2E test.")
            return False
        
        thread_id = thread_response.data[0]["id"]
        
        # Create a test message
        message_response = supabase.table("messages").insert({
            "thread_id": thread_id,
            "role": "user",
            "content": "The budget for Q4 is $50,000."
        }).execute()
        
        if not message_response.data:
            print("⚠ Could not create test message. Skipping E2E test.")
            return False
        
        message_id = message_response.data[0]["id"]
        message_created_at = message_response.data[0].get("created_at")
        
        # Sync to vector store
        qdrant_point_id = await embedding_service.sync_message_to_vector(
            message_id=message_id,
            content="The budget for Q4 is $50,000.",
            company_id=company_id,
            project_id=project_id,
            thread_id=thread_id,
            original_created_at=message_created_at
        )
        
        print(f"✓ Message synced to Qdrant. Point ID: {qdrant_point_id}")
        
        # Verify index entry
        index_response = supabase.table("embedding_index").select("*").eq(
            "external_id", message_id
        ).execute()
        
        assert index_response.data, "embedding_index entry should exist"
        assert index_response.data[0]["qdrant_point_id"] == qdrant_point_id
        print("✓ embedding_index entry verified")
        
        # Search for context
        results = await embedding_service.search_context(
            query="What is the Q4 budget?",
            company_id=company_id,
            project_id=project_id,
            thread_id=thread_id,
            limit=5
        )
        
        assert len(results) > 0, "Should find at least one result"
        assert any("budget" in r["content"].lower() for r in results), "Should find budget-related content"
        print(f"✓ RAG search found {len(results)} relevant results")
        
        # Format context
        context = await embedding_service.format_context_for_llm(results)
        print(f"✓ Formatted context:\n{context[:200]}...")
        
        # Cleanup (optional - comment out to keep test data)
        # supabase.table("embedding_index").delete().eq("external_id", message_id).execute()
        # supabase.table("messages").delete().eq("id", message_id).execute()
        # supabase.table("threads").delete().eq("id", thread_id).execute()
        # supabase.table("projects").delete().eq("id", project_id).execute()
        # supabase.table("companies").delete().eq("id", company_id).execute()
        
        return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_all_tests():
    """Run all tests in sequence."""
    print("=" * 60)
    print("Qdrant Integration Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test 1
    results.append(await test_collection_creation())
    
    # Test 2
    success, company_id, point_id = await test_upsert_with_payload()
    results.append(success)
    
    # Test 3
    success, company_a, company_b = await test_search_with_filter()
    results.append(success)
    
    # Test 4
    results.append(await test_end_to_end_rag())
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_all_tests())
    sys.exit(exit_code)





