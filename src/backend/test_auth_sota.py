
import unittest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from middleware.auth import get_current_user, get_company_context

class TestAuthSOTA(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        
        # Helper endpoint to test dependencies
        @self.app.get("/me")
        async def me(user: dict = Depends(get_current_user), request: Request = None):
            return {"user": user, "state_user": getattr(request.state, "user", None)}

        @self.app.get("/context")
        async def context(ctx: str = Depends(get_company_context)):
            return {"company_id": ctx}

        self.client = TestClient(self.app)
        
        # Mocks
        self.mock_redis_service = AsyncMock()
        # Mock Client: table() must be sync (return builder), execute() must be async
        self.mock_supabase_client = MagicMock() 
        
        # Start patches
        self.redis_patcher = patch('middleware.auth.get_redis_service', return_value=self.mock_redis_service)
        
        # Proper way to mock async function return
        self.supabase_patcher = patch('middleware.auth.get_async_supabase_client', side_effect=AsyncMock(return_value=self.mock_supabase_client))
        
        self.jwt_patcher = patch('middleware.auth.jwt.decode')
        self.env_patcher = patch('middleware.auth.ENVIRONMENT', 'production') # Default to prod for auth tests

        self.mock_get_redis = self.redis_patcher.start()
        self.mock_get_supabase = self.supabase_patcher.start()
        self.mock_jwt_decode = self.jwt_patcher.start()
        self.mock_env = self.env_patcher.start()

    def tearDown(self):
        self.redis_patcher.stop()
        self.supabase_patcher.stop()
        self.jwt_patcher.stop()
        self.env_patcher.stop()

    def test_cache_hit(self):
        """Test authentication when permissions are in Redis"""
        print("\n[TEST] Cache Hit...")
        
        # Setup valid token
        self.mock_jwt_decode.return_value = {"sub": "user123", "email": "test@example.com"}
        
        # Setup Redis Hit
        cached_perms = {
            "user_id": "user123",
            "company_ids": ["co_A", "co_B"],
            "company_id": "co_A"
        }
        self.mock_redis_service.get_json.return_value = cached_perms
        
        headers = {"Authorization": "Bearer valid_token"}
        response = self.client.get("/me", headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user"]["user_id"], "user123")
        self.assertEqual(data["state_user"]["user_id"], "user123")
        
        # Verify Supabase was NOT called
        self.mock_supabase_client.table.assert_not_called()
        print("[PASS] Cache Hit verified (Supabase skipped).")

    def test_cache_miss_and_set(self):
        """Test auth populate cache on miss"""
        print("\n[TEST] Cache Miss...")
        
        self.mock_jwt_decode.return_value = {"sub": "user456", "email": "miss@example.com"}
        self.mock_redis_service.get_json.return_value = None # Miss
        
        # Supabase Mock Response
        mock_query_builder = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_execute = AsyncMock()
        
        # Supabase chain: table().select().eq().execute()
        self.mock_supabase_client.table.return_value = mock_query_builder
        mock_query_builder.select.return_value = mock_select
        mock_select.eq.return_value = mock_eq
        mock_eq.execute.return_value = MagicMock(data=[{"company_id": "co_C"}])
        mock_execute.return_value = MagicMock(data=[{"company_id": "co_C"}])
        
        # Set execute call on the chain end
        mock_eq.execute = mock_execute 

        headers = {"Authorization": "Bearer valid_token"}
        response = self.client.get("/me", headers=headers)
        
        self.assertEqual(response.status_code, 200)
        
        # Verify Redis Set
        self.mock_redis_service.set_json.assert_called_once()
        print("[PASS] Cache Miss: Supabase called & Redis set.")

    def test_context_security_breach(self):
        """Test blocking access to unauthorized company"""
        print("\n[TEST] Context Security...")
        
        # User has access to [co_A]
        user_perms = {
            "user_id": "bad_actor",
            "company_ids": ["co_A"], 
            "company_id": "co_A"
        }
        
        # Mock dependency override for user to simplify test
        # We can bypass logic by overriding the dependency, but we want to test 'get_company_context' logic
        # 'get_company_context' depends on 'get_current_user'.
        # Let's mock 'get_current_user' to return our user_perms
        
        self.app.dependency_overrides[get_current_user] = lambda: user_perms
        
        # Try to access co_B (via query param which would be 'requested_id' in dependency)
        # Note: get_company_context signature: (requested_id: Optional[str] = None, user...)
        # We need to pass requested_id via query param matched in endpoint? 
        # The endpoint '/context' uses `ctx: str = Depends(get_company_context)`.
        # FastAPI maps query params to dependency args if names match? 
        # Actually, get_company_context(requested_id: Optional[str] = None). 
        # If I call /context?requested_id=co_B, FastAPI will pass it.
        
        response = self.client.get("/context?requested_id=co_B")
        
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Access Denied to this Workspace")
        print("[PASS] Security Breach blocked.")

        # Try allowed company
        response = self.client.get("/context?requested_id=co_A")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["company_id"], "co_A")


if __name__ == "__main__":
    unittest.main()
