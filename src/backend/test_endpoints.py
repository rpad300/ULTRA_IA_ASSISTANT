import requests
import asyncio
import sys

BASE_URL = "http://localhost:8000/api"

def test_dashboard_validation():
    print("Testing Dashboard Validation (project_id='debug-test-thread')...")
    try:
        # No auth needed? middleware.auth usually requires token.
        # But for 500 vs 400 checks, the validation often runs before auth or inside the route.
        # Wait, validation is inside the route. Auth happens first.
        # If I don't provide auth, I might get 401.
        # However, the user is getting 500.
        # I need a valid token? Or maybe I can rely on the fact that I'm running locally?
        # The Supabase client in backend uses service role? 
        # No, middleware checks JWT properly.
        # I can reproduce the 22P02 easily if I can get past auth.
        
        # Let's try without auth first. If 401, I know auth is working.
        # If I want to trigger the route logic, I need to mock the user.
        # I can set a dummy token if I have a dev bypass.
        # Checking middleware/auth.py might contain a dev bypass.
        pass
    except Exception as e:
        print(e)

# Checking auth bypass
# In routers/analytics.py, user = Depends(get_current_user)
# In middleware/auth.py, is there a bypass?
# Often local setups have one.

def main():
    print("--- API SMOKE TEST ---")
    
    # 1. Test Companies (No params needed, but Auth needed?)
    # If auth is required, I'll get 401.
    print("\n[GET] /companies")
    try:
        resp = requests.get(f"{BASE_URL}/companies")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}")
    except Exception as e:
        print(f"Request failed: {e}")

    # 2. Test Dashboard with Bad Project ID
    print("\n[GET] /analytics/dashboard/stats?project_id=debug-test-thread")
    try:
        resp = requests.get(f"{BASE_URL}/analytics/dashboard/stats", params={"project_id": "debug-test-thread"})
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    main()
