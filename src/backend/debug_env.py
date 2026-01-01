import os
from dotenv import load_dotenv

load_dotenv()

print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
print(f"SUPABASE_KEY: {'[SET]' if os.getenv('SUPABASE_KEY') else '[MISSING]'}")

try:
    from db.supabase_client import get_supabase_client
    client = get_supabase_client()
    print("Supabase Configured OK")
except Exception as e:
    print(f"Supabase Client Error: {e}")
