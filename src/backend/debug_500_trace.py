from fastapi.testclient import TestClient
from main import app
import sys
import os

# Ensure we can import modules
sys.path.append(os.getcwd())

client = TestClient(app)

def test_company_endpoint():
    print("Testing GET /api/companies...")
    try:
        response = client.get("/api/companies", headers={"Authorization": "Bearer dummy_token"})
        print(f"Status Code: {response.status_code}")
        if response.status_code == 500:
            print("Response Text:", response.text)
    except Exception as e:
        print(f"Exception caught during request: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_company_endpoint()
