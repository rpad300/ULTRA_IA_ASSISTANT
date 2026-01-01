
import unittest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
# Make sure to mock models before importing service if it imports models at top level
# But service imports `from qdrant_client import AsyncQdrantClient, models`
# We can mock AsyncQdrantClient constructor.

from services.qdrant_service import QdrantService, init_qdrant_service

class TestQdrantSOTA(unittest.TestCase):
    async def test_ensure_collection_creates_optimized(self):
        print("\n[TEST] Ensure Collection (Optimized Creation)...")
        with patch("services.qdrant_service.AsyncQdrantClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value = mock_client
            
            # Setup exists -> False
            mock_client.collection_exists.return_value = False
            
            service = QdrantService()
            await service.ensure_collection()
            
            # Verify optimization config passed
            mock_client.create_collection.assert_called_once()
            call_kwargs = mock_client.create_collection.call_args.kwargs
            
            # Scalar Quantization
            quant_config = call_kwargs.get("quantization_config")
            self.assertIsNotNone(quant_config)
            # Cannot easily check inner attributes of Qdrant models depending on how they are mocked/imported
            # But existence confirms we passed it.
            
            print("[PASS] Collection created with optimization configs.")

    async def test_search_context_filtering(self):
        print("\n[TEST] Search Context Filtering...")
        with patch("services.qdrant_service.AsyncQdrantClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value = mock_client
            
            mock_client.search.return_value = [] # Return empty list of points
            
            service = QdrantService()
            await service.search_context(
                query_vector=[0.1]*768,
                company_id="comp_123",
                thread_id="thread_ABC"
            )
            
            # Check filter construction
            mock_client.search.assert_called_once()
            call_kwargs = mock_client.search.call_args.kwargs
            q_filter = call_kwargs["query_filter"]
            
            # Verify conditions (simplistic check of objects)
            # We assume qdrant models are real objects or mocks.
            # If real objects, we can inspect them.
            self.assertTrue(hasattr(q_filter, "must"))
            self.assertEqual(len(q_filter.must), 2) # Company + Thread
            
            print("[PASS] Search filters applied correctly.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        from unittest import IsolatedAsyncioTestCase
        class AsyncTestCase(IsolatedAsyncioTestCase, TestQdrantSOTA):
            pass
        unittest.main()
    except ImportError:
        pass
