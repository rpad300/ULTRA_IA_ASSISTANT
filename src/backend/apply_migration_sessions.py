import requests
import os

# Using the same credentials as previous scripts
PROJECT_REF = "pijyawytynnynwrtbule"
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

def apply_migration():
    print(f"Applying migration 003 (Sessions) to {PROJECT_REF}...")
    
    try:
        with open("src/backend/migrations/003_add_sessions.sql", "r") as f:
            sql_content = f.read()
    except FileNotFoundError:
        print("Error: Migration file not found.")
        return

    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {"query": sql_content}

    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        if response.status_code in [200, 201]:
            print("Success! Migration 003 applied.")
            # print(response.json()) # Verbose
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    apply_migration()

