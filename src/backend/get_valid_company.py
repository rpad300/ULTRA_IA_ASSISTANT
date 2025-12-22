import sys
import os

# Add script directory (backend root) to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.supabase_service import get_supabase_client
import asyncio
import json

async def main():
    try:
        supabase = get_supabase_client()
        # Fetch one company
        response = supabase.table('companies').select('id').limit(1).execute()
        if response.data:
            print(json.dumps({"status": "success", "id": response.data[0]['id']}))
        else:
            print(json.dumps({"status": "error", "message": "No companies found"}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
