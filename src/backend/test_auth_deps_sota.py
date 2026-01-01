
import unittest
from fastapi import FastAPI, Depends, status
from fastapi.testclient import TestClient
from dependencies.auth import get_active_company_id
from middleware.auth import get_current_user

class TestAuthDepsSOTA(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        
        @self.app.get("/context")
        async def context(company_id: str = Depends(get_active_company_id)):
            return {"company_id": company_id}

        self.client = TestClient(self.app)
        self.user_base = {
            "user_id": "test_user",
            "company_ids": ["co_A", "co_B"],
            "company_id": "co_A" # Default
        }

    def test_default_context(self):
        """Test uses profile default if no header"""
        print("\n[TEST] Default Context...")
        self.app.dependency_overrides[get_current_user] = lambda: self.user_base
        
        response = self.client.get("/context")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["company_id"], "co_A")
        print("[PASS] Default context used.")

    def test_header_switch(self):
        """Test X-Company-ID header switches workspace"""
        print("\n[TEST] Header Switch...")
        self.app.dependency_overrides[get_current_user] = lambda: self.user_base
        
        # Switch to co_B
        response = self.client.get("/context", headers={"X-Company-ID": "co_B"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["company_id"], "co_B")
        print("[PASS] Workspace switched via Header.")

    def test_security_breach(self):
        """Test blocking unauthorized workspace switch"""
        print("\n[TEST] Security Breach (Header)...")
        self.app.dependency_overrides[get_current_user] = lambda: self.user_base
        
        # Try to switch to co_C (not in list)
        response = self.client.get("/context", headers={"X-Company-ID": "co_C"})
        self.assertEqual(response.status_code, 403)
        print("[PASS] Unauthorized header blocked.")

    def test_no_companies(self):
        """Test 403 if user has no companies"""
        print("\n[TEST] No Companies...")
        user_orphan = {"user_id": "orphan", "company_ids": []}
        self.app.dependency_overrides[get_current_user] = lambda: user_orphan
        
        response = self.client.get("/context")
        self.assertEqual(response.status_code, 403)
        print("[PASS] Orphan user blocked.")

if __name__ == "__main__":
    unittest.main()
