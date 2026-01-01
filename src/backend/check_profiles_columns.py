
import json
import os
import urllib.request
import urllib.error

def load_env_manual(path):
    env = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env[key] = value.strip('"').strip("'")
    except Exception as e:
        print(f"Error loading .env: {e}")
    return env

def main():
    env = load_env_manual('.env')
    url = env.get("SUPABASE_URL")
    key = env.get("SUPABASE_KEY") or env.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    endpoint = f"{url}/rest/v1/profiles?select=*&limit=1"
    req = urllib.request.Request(endpoint)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read().decode()
            data = json.loads(content)
            if len(data) > 0:
                print("Columns:", list(data[0].keys()))
                # Check specific types if possible by looking at values
                ks = data[0].get('knowledge_sources')
                print(f"knowledge_sources value example: {ks} (Type: {type(ks)})")
            else:
                print("Table empty.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
