
import unittest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from db.supabase_client import SupabaseManager, get_supabase_client, get_async_supabase_client

class TestSupabaseManagerSOTA(unittest.TestCase):
    def setUp(self):
        # Reset state
        SupabaseManager._sync_client = None
        SupabaseManager._async_client = None

    async def test_sync_singleton(self):
        print("\n[TEST] Sync Singleton...")
        with patch("db.supabase_client.create_client") as mock_create:
            mock_create.return_value = MagicMock()
            
            c1 = SupabaseManager.get_sync_client()
            c2 = get_supabase_client()
            
            self.assertIs(c1, c2)
            mock_create.assert_called_once()
            print("[PASS] Sync Singleton works.")

    async def test_async_singleton_and_smoke(self):
        print("\n[TEST] Async Singleton & Smoke Test...")
        with patch("db.supabase_client.create_async_client", new_callable=AsyncMock) as mock_create:
            # Mock the client result (must be MagicMock for sync builder methods)
            mock_client = MagicMock() 
            mock_create.return_value = mock_client
            
            # Chain setup
            mock_table = MagicMock()
            mock_select = MagicMock()
            mock_limit = MagicMock()
            mock_execute = AsyncMock()
            
            mock_client.table.return_value = mock_table
            mock_table.select.return_value = mock_select
            mock_select.limit.return_value = mock_limit
            mock_limit.execute = mock_execute
            
            # Execute
            c1 = await get_async_supabase_client()
            c2 = await SupabaseManager.get_async_client()
            
            self.assertIs(c1, c2)
            mock_create.assert_called_once()
            
            # Verify Smoke Test called
            mock_client.table.assert_called_with("active_sessions")
            mock_execute.assert_called()
            print("[PASS] Async Singleton & Smoke Test works.")

    async def test_close_all(self):
        print("\n[TEST] Close All...")
        SupabaseManager._sync_client = MagicMock()
        SupabaseManager._async_client = AsyncMock()
        
        await SupabaseManager.close_all()
        
        self.assertIsNone(SupabaseManager._sync_client)
        self.assertIsNone(SupabaseManager._async_client)
        print("[PASS] Cleanup works.")

if __name__ == "__main__":
    # Async test runner boilerplate
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        from unittest import IsolatedAsyncioTestCase
        class AsyncTestCase(IsolatedAsyncioTestCase, TestSupabaseManagerSOTA):
            pass
        unittest.main()
    except ImportError:
        pass
