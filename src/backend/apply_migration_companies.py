import requests
import os

# Using the same credentials
PROJECT_REF = "pijyawytynnynwrtbule"
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

SQL = """
alter table companies 
add column if not exists website text,
add column if not exists status text default 'active',
add column if not exists industry text;
"""

def apply_migration():
    print(f"Applying migration 002 to {PROJECT_REF}...")
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {"query": SQL}

    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        if response.status_code in [200, 201]:
            print("Success! Migration 002 applied.")
            print(response.json())
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    apply_migration()
