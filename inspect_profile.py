
import os
import asyncio
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    # Try reading from .env file directly if env vars not set in shell
    try:
        env_path = os.path.join(os.getcwd(), "src", "backend", ".env")
        if os.path.exists(env_path):
            print(f"Loading env from {env_path}")
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        # Clean quotes
                        v = v.strip("'").strip('"')
                        if k == "SUPABASE_URL":
                            url = v
                        elif k == "SUPABASE_KEY":
                            key = v
        else:
            print(f"Env file not found at {env_path}")
    except Exception as e:
        print(f"Error reading .env: {e}")

if not url:
    print("FATAL: SUPABASE_URL not found")
    exit(1)
if not key:
    print("FATAL: SUPABASE_KEY not found")
    exit(1)

print(f"Connecting to {url}...")
supabase: Client = create_client(url, key)

async def main():
    try:
        response = supabase.table("contacts").select("id, name, voice_profile").not_.is_("voice_profile", "null").limit(1).execute()
        if response.data:
            profile = response.data[0]["voice_profile"]
            print(f"--- RAW DATA START ---")
            print(f"Type: {type(profile)}")
            print(f"Value: {profile}")
            print(f"--- RAW DATA END ---")
        else:
            print("No profiles found with voice_profile data.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
