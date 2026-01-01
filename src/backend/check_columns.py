import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env from current directory
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY") # SOTA: Use the key available in config

if not url or not key:
    print(f"Missing credentials. URL={url}, KEY={key}")
    print(f"Env Path: {env_path}")
    exit(1)

supabase: Client = create_client(url, key)

def check_table(table_name):
    print(f"\nScanning table: {table_name}")
    try:
        # Fetch one row to see keys
        res = supabase.table(table_name).select("*").limit(1).execute()
        if res.data:
            print(f"Columns in {table_name}: {list(res.data[0].keys())}")
        else:
             print(f"Table {table_name} exists but is empty/no-access.")
    except Exception as e:
        print(f"Error accessing {table_name}: {e}")

if __name__ == "__main__":
    check_table("sessions")
    check_table("projects")
    check_table("documents")
