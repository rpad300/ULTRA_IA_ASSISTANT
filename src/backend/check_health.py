import requests
import sys

URL = "http://localhost:8000/api/health"

try:
    response = requests.get(URL, timeout=5)
    data = response.json()
    print(f"Server Response: {data}")
    
    version = data.get("sota_version")
    if version == "mock-qdrant-fix-v1":
        print("SUCCESS: Running SOTA Version")
        sys.exit(0)
    else:
        print(f"FAILURE: Old Version Running. Expected 'mock-qdrant-fix-v1', got '{version}'")
        sys.exit(1)
except Exception as e:
    print(f"Connection Failed: {e}")
    sys.exit(1)
