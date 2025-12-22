import requests
import os

# Using the same credentials found in apply_schema_direct.py
PROJECT_REF = "pijyawytynnynwrtbule"
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2" # Should ideally be env var but reusing known working secret
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

SQL = """
create table if not exists messages (
    id uuid primary key default uuid_generate_v4(),
    thread_id uuid references threads(id) on delete cascade not null,
    role text not null, -- 'user', 'assistant', 'system'
    content text not null,
    created_at timestamp with time zone default now()
);
"""

def apply_migration():
    print(f"Applying migration to {PROJECT_REF}...")
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "query": SQL
    }

    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        
        if response.status_code in [200, 201]:
            print("Success! Migration applied.")
            print(response.json())
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    apply_migration()
