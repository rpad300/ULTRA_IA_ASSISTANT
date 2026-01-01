import asyncio
import os
import sys
# from dotenv import load_dotenv
from supabase import create_client, Client, create_async_client

# Manual .env loader
def load_env_manual():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), "../../.env")
    
    if os.path.exists(env_path):
        print(f"Loading .env from {env_path}")
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"): continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip('"').strip("'")

load_env_manual()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

async def test_supabase():
    print(f"Testing Supabase connection to: {SUPABASE_URL}")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing Supabase credentials in .env")
        return


    try:
        # 1. Sync Test
        print("\n--- Testing Sync Client ---")
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Sync Client initialized. Attempting fetch...")
        response = supabase.table("companies").select("count", count="exact").limit(1).execute()
        print(f"Sync Success! Data: {response.data}")

        # 2. Async Test
        print("\n--- Testing Async Client ---")
        async_supabase = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
        print("Async Client initialized. Attempting fetch...")
        response = await async_supabase.table("companies").select("count", count="exact").limit(1).execute()
        print(f"Async Success! Data: {response.data}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(test_supabase())
