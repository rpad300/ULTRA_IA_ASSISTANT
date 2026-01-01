
import unittest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from db.connection_pool import init_supabase, get_supabase, close_supabase
# Need to import the module to access the global variable for verification if needed, 
# or just rely on public functions.

class TestConnectionPoolSOTA(unittest.TestCase):
    def setUp(self):
        # Reset global state?
        # Since imports are cached, the global _async_supabase might persist across tests if valid.
        # But we want to test initialization.
        # We can reset it using a helper in the module or by reloading, 
        # but mocking the inner variable is harder if not exposed.
        # We'll just patch the internal global logic by patching the module dict?
        # Or easier: just test public API behavior.
        pass

    def tearDown(self):
        pass

    async def test_singleton_initialization(self):
        print("\n[TEST] Singleton Initialization...")
        # Mock create_async_client
        with patch("db.connection_pool.create_async_client", new_callable=AsyncMock) as mock_create:
            mock_client = AsyncMock()
            mock_create.return_value = mock_client
            
            # Reset global variable manually for test (nasty but necessary for singleton test)
            import db.connection_pool
            db.connection_pool._async_supabase = None
            
            # First Call
            client1 = await init_supabase()
            self.assertIsNotNone(client1)
            mock_create.assert_called_once()
            
            # Second Call (Should return cached)
            client2 = await get_supabase()
            self.assertIs(client1, client2)
            mock_create.assert_called_once() # Still only once
            
            # Verify options passed
            # args, kwargs = mock_create.call_args
            # self.assertIn("options", kwargs)
            # self.assertEqual(kwargs["options"].postgrest_client_timeout, 10)
            
            print("[PASS] Singleton works.")

    async def test_close_pool(self):
        print("\n[TEST] Close Pool...")
        import db.connection_pool
        # Ensure it's initialized
        db.connection_pool._async_supabase = AsyncMock()
        
        await close_supabase()
        self.assertIsNone(db.connection_pool._async_supabase)
        print("[PASS] Pool closed.")

if __name__ == "__main__":
    # Asyncio test runner wrapper
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    loader = unittest.TestLoader()
    # We need to wrap async tests. Standard unittest doesn't support async defs easily without IsolatedAsyncioTestCase
    # Let's verify if IsolatedAsyncioTestCase is available (Python 3.8+)
    
    try:
        from unittest import IsolatedAsyncioTestCase
        class AsyncTest(IsolatedAsyncioTestCase, TestConnectionPoolSOTA):
            pass
        unittest.main()
    except ImportError:
        print("IsolatedAsyncioTestCase not found")
