import asyncio
import logging
import sys
import os

# Ensure src/backend is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.supabase_client import SupabaseManager
from config import SUPABASE_URL, SUPABASE_KEY

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def reset_db():
    print(f"DEBUG: URL={SUPABASE_URL}")
    
    try:
        print("Initializing Supabase Client...")
        client = await SupabaseManager.get_async_client()
        
        print("WARNING: Wiping dependent tables first...")
        
        # 1. Clear child tables (Order matters due to FKs)
        tables_to_clear = ["voice_traces", "meetings", "projects"] 
        # Note: 'meetings' might depend on 'projects', 'voice_traces' on 'companies'/'profiles'
        
        for table in tables_to_clear:
            try:
                print(f"Cleaning {table}...")
                await client.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            except Exception as e:
                 print(f"[{table}] Cleanup Skipped/Failed (might be empty or wrong name): {e}")

        print("WARNING: Wiping 'companies' table...")
        # Delete all companies
        res = await client.table("companies").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        print(f"SUCCESS: Deleted {len(res.data) if res.data else 0} companies.")
        print("Database state reset for Companies.")
        
    except Exception as e:
        print(f"RESET FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(reset_db())
