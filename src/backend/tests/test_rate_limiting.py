"""
Test Rate Limiting
Verifies that rate limiting middleware works correctly
"""

import requests
import time
from typing import List

BASE_URL = "http://localhost:8000"


def test_rate_limiting():
    """Test rate limiting by making 101 requests rapidly."""
    print("Testing Rate Limiting...")
    print("=" * 50)
    
    # Make 101 requests rapidly
    responses: List[requests.Response] = []
    start_time = time.time()
    
    for i in range(101):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            responses.append(response)
            if i % 10 == 0:
                print(f"Request {i+1}/101: Status {response.status_code}")
        except Exception as e:
            print(f"Request {i+1} failed: {e}")
    
    elapsed = time.time() - start_time
    
    # Analyze results
    status_codes = {}
    rate_limit_headers = []
    
    for resp in responses:
        status = resp.status_code
        status_codes[status] = status_codes.get(status, 0) + 1
        
        if "X-RateLimit-Limit" in resp.headers:
            rate_limit_headers.append({
                "limit": resp.headers.get("X-RateLimit-Limit"),
                "remaining": resp.headers.get("X-RateLimit-Remaining")
            })
    
    print("\n" + "=" * 50)
    print("Results:")
    print(f"Total requests: {len(responses)}")
    print(f"Time elapsed: {elapsed:.2f}s")
    print(f"Requests per second: {len(responses)/elapsed:.2f}")
    print("\nStatus codes:")
    for status, count in status_codes.items():
        print(f"  {status}: {count}")
    
    # Check if rate limiting kicked in
    if 429 in status_codes:
        print("\n✅ Rate limiting is WORKING! (429 errors detected)")
        print(f"   Blocked requests: {status_codes[429]}")
    else:
        print("\n⚠️  Rate limiting may not be active (no 429 errors)")
        print("   Note: Rate limiting is disabled in development mode")
    
    if rate_limit_headers:
        print("\nRate limit headers (sample):")
        for header in rate_limit_headers[:3]:
            print(f"  Limit: {header['limit']}, Remaining: {header['remaining']}")
    
    return status_codes


if __name__ == "__main__":
    print("Rate Limiting Test")
    print("=" * 50)
    print("Note: Rate limiting is disabled in development mode")
    print("Set ENVIRONMENT=production to enable it")
    print("=" * 50)
    print()
    
    test_rate_limiting()





