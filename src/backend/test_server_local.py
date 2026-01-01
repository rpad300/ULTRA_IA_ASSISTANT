
import sys
import os
import asyncio
from fastapi.testclient import TestClient

# Add src/backend to path
current_dir = os.getcwd()
sys.path.append(current_dir)

try:
    print("Importing main app...")
    from main import app
    print("App imported.")
    
    client = TestClient(app)
    
    # print("Testing /api/health...")
    # response = client.get("/api/health")
    # print(f"Health Status: {response.status_code}")

    print("Testing /api/companies (Expect 200 or 401)...")
    response = client.get("/api/companies")
    print(f"Companies Status: {response.status_code}")
    if response.status_code == 500:
        print(f"CRASH BODY: {response.text}")
    else:
        print(f"Companies Body: {response.json()[:2] if isinstance(response.json(), list) else response.json()}")

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
