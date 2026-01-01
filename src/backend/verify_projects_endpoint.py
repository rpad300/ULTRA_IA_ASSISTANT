
import asyncio
import httpx
import sys

BASE_URL = "http://localhost:8000"
COMPANY_ID = "519e1c22-6945-4cbb-aa2b-0e4cbd023937"

async def verify_projects():
    print(f"Testing projects endpoint for company: {COMPANY_ID}")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Test Unauthenticated (should access if public or fail gracefully)
        try:
            resp = await client.get(f"/api/companies/{COMPANY_ID}/projects")
            print(f"GET /projects (No Auth): {resp.status_code}")
            if resp.status_code == 200:
                print(" -> Success! Data:", resp.json()[:1]) # Show first item
            else:
                print(f" -> Failure: {resp.text}")
        except Exception as e:
            print(f"Request Failed: {e}")

        # 2. Test Authenticated (Simulated)
        try:
            headers = {"Authorization": "Bearer test-token"}
            resp = await client.get(f"/api/companies/{COMPANY_ID}/projects", headers=headers)
            print(f"GET /projects (With Auth): {resp.status_code}")
            if resp.status_code == 200:
                print(" -> Success! Data:", resp.json()[:1])
            else:
                print(f" -> Failure: {resp.text}")
        except Exception as e:
            print(f"Request Failed: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_projects())
