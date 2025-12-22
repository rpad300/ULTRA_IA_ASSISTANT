import requests
import sys

URL = "http://localhost:8001/api/audio-service/status"
try:
    print(f"Connecting to {URL}...")
    resp = requests.get(URL, timeout=2)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
