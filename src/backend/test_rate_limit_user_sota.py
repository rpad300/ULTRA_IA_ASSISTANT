
import unittest
import logging
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI, Request
from starlette.testclient import TestClient
from middleware.rate_limit_user import UserRateLimitMiddleware

# Setup Logger
logging.basicConfig(level=logging.INFO)

class TestUserRateLimitMiddleware(unittest.TestCase):
    def setUp(self):
        # Create fresh app
        self.app = FastAPI()
        
        @self.app.get("/test")
        async def test_route():
            return {"message": "ok"}
            
        # We need to mock get_redis_service to return a mock redis service
        self.mock_redis = MagicMock()
        self.mock_pipeline = AsyncMock()
        
        # Configure pipeline context manager
        pipeline_context = MagicMock()
        pipeline_context.__aenter__.return_value = self.mock_pipeline
        pipeline_context.__aexit__.return_value = None
        
        self.mock_redis.pipeline.return_value = pipeline_context

        self.mock_redis_service = AsyncMock()
        self.mock_redis_service._client = self.mock_redis

        # Patch the get_redis_service
        self.patcher = patch('middleware.rate_limit_user.get_redis_service', return_value=self.mock_redis_service)
        self.mock_get_redis = self.patcher.start()

        # Patch config ENVIRONMENT to 'production'
        self.config_patcher = patch('middleware.rate_limit_user.ENVIRONMENT', 'production')
        self.config_patcher.start()
        
        # Add Middleware with known limits
        self.app.add_middleware(UserRateLimitMiddleware, authenticated_limit=10, anonymous_limit=5)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.patcher.stop()
        self.config_patcher.stop()

    def test_anonymous_limit(self):
        """Test limits for unauthenticated users (IP based)"""
        print("\n[TEST] Anonymous Limit...")
        
        # Simulate Redis returning 4 (limit 5)
        # Results: [removed, added, CARD, expired]
        expected_result = [0, 1, 4, True]
        self.mock_pipeline.execute.side_effect = AsyncMock(return_value=expected_result)
        
        response = self.client.get("/test")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-RateLimit-Limit"], "5")
        self.assertEqual(response.headers["X-RateLimit-Remaining"], "1") # 5 - 4
        print("[PASS] Anonymous limit respected.")

    def test_authenticated_limit(self):
        """Test limits for authenticated users"""
        print("\n[TEST] Authenticated Limit...")
        
        # Mock request state to simulate logged in user
        # Middleware checks request.state.user
        # In TestClient/FastAPI, injecting state is tricky without middleware.
        # We'll use a middleware helper or patch the dispatch logic? 
        # Easier: patch 'hasattr' or just ensure state is populated by a preceding middleware in the stack?
        # Actually, let's just create a custom middleware that sets state.user before the RateLimit
        
        @self.app.middleware("http")
        async def auth_middleware(request: Request, call_next):
            request.state.user = {"user_id": "user123"}
            return await call_next(request)
            
        # Re-create client with new middleware stack (might need to rebuild app?)
        # Adding middleware after app start is bad.
        # Strategy: Define app in setUp differently or recreate it here.
        # Recreating for this test case specifically.
        
        app_auth = FastAPI()
        @app_auth.middleware("http")
        async def mock_auth(request: Request, call_next):
            request.state.user = {"user_id": "vip_user"}
            return await call_next(request)
            
        app_auth.add_middleware(UserRateLimitMiddleware, authenticated_limit=10, anonymous_limit=5)
        @app_auth.get("/test")
        async def t(): return {"ok": True}
        
        client_auth = TestClient(app_auth)
        
        # Simulate Redis returning 6 (limit 10)
        # Note: anon limit is 5, so if it treated as anon, it would block (if we returned 6) OR allow (if logic bad)
        # But we return 6. Anon limit 5 would block (if logic > limit). 6 > 5. 
        # Auth limit 10. 6 <= 10. Should PASS.
        
        # Important: We need to patch get_redis_service for THIS app instance/module execution context too 
        # (It's global patch though, so it should apply)
        
        expected_result = [0, 1, 6, True]
        self.mock_pipeline.execute.side_effect = AsyncMock(return_value=expected_result)
        
        response = client_auth.get("/test")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-RateLimit-Limit"], "10") # Auth limit
        self.assertEqual(response.headers["X-RateLimit-Type"], "authenticated")
        print("[PASS] Authenticated limit applied.")

    def test_anonymous_exceeded(self):
        print("\n[TEST] Anonymous Exceeded...")
        # Limit 5. Return 6.
        expected_result = [0, 1, 6, True]
        self.mock_pipeline.execute.side_effect = AsyncMock(return_value=expected_result)
        
        response = self.client.get("/test")
        self.assertEqual(response.status_code, 429)
        print("[PASS] Anonymous blocked correctly.")

if __name__ == "__main__":
    unittest.main()
