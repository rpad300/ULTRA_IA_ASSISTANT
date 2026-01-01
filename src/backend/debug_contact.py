
import asyncio
import os
from supabase import create_client, Client

def load_env_manual(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value.strip('"').strip("'")
    except Exception as e:
        print(f"Error loading .env: {e}")

async def main():
    load_env_manual('src/backend/.env')
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("Missing Supabase credentials")
        return

    supabase: Client = create_client(url, key)
    
    # 1. Check for email
    email = "rdias.100@gmail.com"
    print(f"Checking for email: {email}")
    res = supabase.table("contacts").select("*").eq("email", email).execute()
    if res.data:
        print("Contact FOUND:")
        print(res.data[0])
    else:
        print("Contact NOT found.")

    # 2. Check table columns by inserting a dummy or just inspecting one
    print("\nfetching one contact to see columns:")
    res = supabase.table("contacts").select("*").limit(1).execute()
    if res.data:
        print("Columns available:", res.data[0].keys())
    else:
        print("No contacts found to inspect columns.")

if __name__ == "__main__":
    asyncio.run(main())
