import asyncio
import logging
import sys
import os

# Ensure src/backend is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.supabase_client import SupabaseManager
from config import SUPABASE_URL, SUPABASE_KEY
from supabase.lib.client_options import ClientOptions

# Configure logging to stdout
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def debug_init():
    try:
        print("Inspecting ClientOptions...")
        opts = ClientOptions(schema="public")
        print(f"ClientOptions dir: {dir(opts)}")
        print(f"ClientOptions vars: {vars(opts) if hasattr(opts, '__dict__') else 'No __dict__'}")
    except Exception as e:
        print(f"Inspection Failed: {e}")

    print(f"DEBUG: URL={SUPABASE_URL}")
    print(f"DEBUG: KEY_LEN={len(SUPABASE_KEY) if SUPABASE_KEY else 'None'}")
    
    try:
        print("Attempting to get async client...")
        client = await SupabaseManager.get_async_client()
        print("SUCCESS: Client initialized.")
        
        print("Attempting query...")
        res = await client.table("companies").select("count", count="exact").limit(1).execute()
        print(f"SUCCESS: Query result: {res}")
        
    except Exception as e:
        print(f"CRITICAL FAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_init())
