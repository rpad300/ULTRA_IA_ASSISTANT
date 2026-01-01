import requests
import sys

def test_live_server():
    url = "http://localhost:8000/api/companies"
    print(f"Testing {url}...")
    try:
        response = requests.get(url, timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_live_server()
