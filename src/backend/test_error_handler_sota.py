
import unittest
import logging
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from pydantic import BaseModel
from middleware.error_handler import error_handler, http_exception_handler, validation_exception_handler

# Setup Logger
logging.basicConfig(level=logging.INFO)

class TestErrorHandlerSOTA(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        
        # Register Handlers
        self.app.add_exception_handler(Exception, error_handler)
        self.app.add_exception_handler(HTTPException, http_exception_handler)
        self.app.add_exception_handler(RequestValidationError, validation_exception_handler)

        # Mock Metrics Service
        self.mock_metrics = MagicMock()
        self.patcher = patch('middleware.error_handler.get_metrics_service', return_value=self.mock_metrics)
        self.patcher.start()

        # Routes
        @self.app.get("/error/500")
        async def trigger_500():
            raise ValueError("Intentional Boom")

        @self.app.get("/error/404")
        async def trigger_404():
            raise HTTPException(status_code=404, detail="Not Found SOTA")

        class Item(BaseModel):
            name: str
            
        @self.app.post("/error/422")
        async def trigger_422(item: Item):
            return item

        # Critical: raise_server_exceptions=False tells TestClient to return the 500 response
        # instead of re-raising the exception for the test runner.
        self.client = TestClient(self.app, raise_server_exceptions=False)

    def tearDown(self):
        self.patcher.stop()

    def test_500_handler_structure(self):
        """Test 500 handler returns uniform JSON SOTA structure and increments metrics"""
        print("\n[TEST] 500 Handler...")
        with patch('middleware.error_handler.ENVIRONMENT', 'production'):
            response = self.client.get("/error/500")
            
        self.assertEqual(response.status_code, 500)
        data = response.json()
        
        # Check SOTA Structure
        self.assertFalse(data["success"])
        self.assertEqual(data["error"]["code"], "INTERNAL_SERVER_ERROR")
        self.assertTrue("request_id" in data["error"])
        # In production, no traceback
        self.assertTrue("traceback" not in data["error"])
        
        # Check Metrics
        self.mock_metrics.increment.assert_called_with("errors_500_total", tags={"path": "/error/500"})
        print("[PASS] 500 Structure & Metrics verified.")

    def test_http_exception_handler(self):
        """Test HTTP exceptions are mapped correctly"""
        print("\n[TEST] HTTP Exception Handler...")
        response = self.client.get("/error/404")
        
        self.assertEqual(response.status_code, 404)
        data = response.json()
        
        self.assertFalse(data["success"])
        self.assertEqual(data["error"]["code"], "HTTP_404")
        self.assertEqual(data["error"]["message"], "Not Found SOTA")
        
        self.mock_metrics.increment.assert_called_with("errors_404_total")
        print("[PASS] HTTP Exception Handler verified.")

    def test_validation_exception_handler(self):
        """Test 422 Pydantic errors are formatted nicely"""
        print("\n[TEST] Validation Handler...")
        response = self.client.post("/error/422", json={"wrong_field": 123})
        
        self.assertEqual(response.status_code, 422)
        data = response.json()
        
        self.assertFalse(data["success"])
        self.assertEqual(data["error"]["code"], "VALIDATION_ERROR")
        self.assertTrue(len(data["error"]["details"]) > 0)
        
        print("[PASS] Validation Handler verified.")

if __name__ == "__main__":
    unittest.main()
