import requests
import sys

try:
    print("Testing GET /api/contacts...")
    # Using backend port 8000 directly to bypass frontend proxy issues if any
    r = requests.get("http://localhost:8000/api/contacts") 
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        print("Success! Contacts retrieved.")
        sys.exit(0)
    else:
        print(f"Failed: {r.text}")
        sys.exit(1)
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)
