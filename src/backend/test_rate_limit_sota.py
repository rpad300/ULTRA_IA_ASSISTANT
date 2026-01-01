
import unittest
import logging
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI, Request
from starlette.testclient import TestClient
from middleware.rate_limit import RateLimitMiddleware

# Setup Logger
logging.basicConfig(level=logging.INFO)

# Setup Logger
logging.basicConfig(level=logging.INFO)

# We will recreate app in setUp

class TestRateLimitMiddleware(unittest.TestCase):
    def setUp(self):
        # Create fresh app for each test
        self.app = FastAPI()
        
        @self.app.get("/test")
        async def test_route():
            return {"message": "ok"}

        @self.app.get("/api/health")
        async def health():
            return {"status": "ok"}
            
            
        # We need to mock get_redis_service to return a mock redis service
        self.mock_redis = MagicMock() # Changed from AsyncMock to MagicMock for the client itself basics
        self.mock_pipeline = AsyncMock()
        
        # Configure pipeline context manager
        # pipeline() returns a context manager, so calling it returns an object that has __aenter__
        # We make the return value of the pipeline() call be the mock_pipeline for simplicity's sake of the context manager
        pipeline_context = MagicMock()
        pipeline_context.__aenter__.return_value = self.mock_pipeline
        pipeline_context.__aexit__.return_value = None
        
        self.mock_redis.pipeline.return_value = pipeline_context
        
        # Configure pipeline execute return values (default: success, count=1)
        # return val is [rem_count, add_count, card_count, expire_bool]
        self.mock_pipeline.execute.return_value = [0, 1, 1, True] 

        self.mock_redis_service = AsyncMock()
        self.mock_redis_service._client = self.mock_redis

        # Patch the get_redis_service
        self.patcher = patch('middleware.rate_limit.get_redis_service', return_value=self.mock_redis_service)
        self.mock_get_redis = self.patcher.start()

        # Patch config ENVIRONMENT to 'production' to enforce limits
        self.config_patcher = patch('middleware.rate_limit.ENVIRONMENT', 'production')
        self.config_patcher.start()

        self.app.add_middleware(RateLimitMiddleware, requests_per_minute=10)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.patcher.stop()
        self.config_patcher.stop()

    def test_exempt_endpoints(self):
        """Test that health checks skip rate limiting"""
        print("\n[TEST] Exempt Endpoints...")
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.mock_redis.pipeline.assert_not_called()
        print("[PASS] Health check skipped Redis logic.")

    def test_rate_limit_headers(self):
        """Test that headers are present on success"""
        print("\n[TEST] Rate Limit Headers...")
        
        expected_result = [0, 1, 5, True]
        self.mock_pipeline.execute.side_effect = AsyncMock(return_value=expected_result)
        
        response = self.client.get("/test")
        
        print(f"Headers: {response.headers}")
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-RateLimit-Limit"], "10")
        self.assertEqual(response.headers["X-RateLimit-Remaining"], "5") # 10 - 5
        print("[PASS] Headers verified.")

    def test_rate_limit_exceeded(self):
        """Test blocking when limit is hit"""
        print("\n[TEST] Rate Limit Exceeded...")
        
        expected_result = [0, 1, 11, True]
        self.mock_pipeline.execute.side_effect = AsyncMock(return_value=expected_result)
        
        response = self.client.get("/test")
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)
        print("[PASS] 429 triggered correctly.")

    def test_fail_open_reliability(self):
        """Test that if Redis is down, we let requests through"""
        print("\n[TEST] Fail Open Reliability...")
        # Mock Redis service returning None or no client
        self.mock_redis_service._client = None
        
        response = self.client.get("/test")
        self.assertEqual(response.status_code, 200)
        print("[PASS] Failed open successfully.")

if __name__ == "__main__":
    unittest.main()
