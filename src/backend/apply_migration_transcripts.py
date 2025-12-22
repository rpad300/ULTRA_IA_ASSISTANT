import requests
import os

# Using the same credentials found in apply_schema_direct.py
PROJECT_REF = "pijyawytynnynwrtbule"
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2" # Reusing known working secret
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

SQL = """
CREATE TABLE IF NOT EXISTS session_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL,
    speaker TEXT,
    text TEXT,
    timestamp FLOAT,
    is_final BOOLEAN DEFAULT FALSE,
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id ON session_transcripts(session_id);
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
