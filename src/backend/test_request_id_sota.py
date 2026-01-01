
import unittest
import logging
import sys
from io import StringIO
from fastapi import FastAPI
from starlette.testclient import TestClient
from middleware.request_id import RequestIDMiddleware
from middleware.logging_context import get_request_id

# Setup minimal app
app = FastAPI()
app.add_middleware(RequestIDMiddleware)

@app.get("/test")
async def test_route():
    return {"message": "ok", "context_id": get_request_id()}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.get("/error")
async def error_route():
    raise ValueError("Intentional error for testing logs")

class TestRequestIDMiddleware(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Capture logs
        self.log_capture = StringIO()
        self.handler = logging.StreamHandler(self.log_capture)
        self.handler.setLevel(logging.INFO)
        # Add handler to the middleware logger
        self.middleware_logger = logging.getLogger("middleware.request_id")
        self.middleware_logger.addHandler(self.handler)
        self.middleware_logger.setLevel(logging.INFO)

    def tearDown(self):
        self.middleware_logger.removeHandler(self.handler)

    def test_request_id_generation(self):
        print("\n[TEST] Generating Request ID...")
        response = self.client.get("/test")
        self.assertEqual(response.status_code, 200)
        req_id = response.headers.get("X-Request-ID")
        process_time = response.headers.get("X-Process-Time")
        
        print(f" -> Generated ID: {req_id}")
        print(f" -> Process Time: {process_time}s")
        
        self.assertIsNotNone(req_id)
        self.assertIsNotNone(process_time)
        self.assertEqual(response.json()["context_id"], req_id)
        print("[PASS] Request ID generation verified.")

    def test_correlation_id_passthrough(self):
        print("\n[TEST] Correlation ID Passthrough...")
        correlation_id = "test-correlation-ABC-123"
        response = self.client.get("/test", headers={"X-Correlation-ID": correlation_id})
        
        returned_id = response.headers.get("X-Request-ID")
        print(f" -> Sent: {correlation_id}")
        print(f" -> Received: {returned_id}")
        
        self.assertEqual(returned_id, correlation_id)
        self.assertEqual(response.json()["context_id"], correlation_id)
        print("[PASS] Correlation ID passthrough verified.")

    def test_clean_logging_noisy_endpoints(self):
        print("\n[TEST] Noisy Endpoint Filtering...")
        self.client.get("/api/health")
        
        logs = self.log_capture.getvalue()
        # Check that NO log message containing headers was emitted for health
        self.assertNotIn("/api/health", logs)
        print("[PASS] Noisy endpoint filtering verified.")

    def test_error_logging(self):
        print("\n[TEST] Error Logging with Trace...")
        try:
            self.client.get("/error")
        except ValueError:
            pass
            
        logs = self.log_capture.getvalue()
        self.assertIn("Request Failed", logs)
        self.assertIn("Intentional error", logs)
        # We can also check for Request ID in logs if we parse it, but presence of error log is good enough
        print(f" -> Found Error Log fragment: {logs[:100]}...")
        print("[PASS] Error logging verified.")

if __name__ == "__main__":
    unittest.main()
