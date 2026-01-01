import requests
import os
import sys

# SOTA: Migration System using Service Key
PROJECT_REF = "pijyawytynnynwrtbule"
# Using the SERVICE_ROLE JWT provided by the user
API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpanlhd3l0eW5ueW53cnRidWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI4MTM5NCwiZXhwIjoyMDc5ODU3Mzk0fQ.R-RJtAs77zIAoSw6xhHGjj_wgLhgMvS2lhZMAYx7hqg"

# Note: The /query endpoint usually requires a Platform Token (PAT), not the Service Role.
# However, we test this as a last resort since the user provided this specific JWT.
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

SQL_MIGRATIONS = [
    {
        "name": "fix_companies_schema",
        "sql": """
        alter table companies 
        add column if not exists website text,
        add column if not exists status text default 'active',
        add column if not exists industry text;
        """
    },
    {
        "name": "fix_messages_schema",
        "sql": """
        alter table messages 
        add column if not exists status text default 'sent';
        """
    }
]

def apply_migrations():
    print(f"Starting SOTA Migration Sequence on {PROJECT_REF}...")
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    for migration in SQL_MIGRATIONS:
        print(f"Applying: {migration['name']}...")
        payload = {"query": migration['sql']}
        
        try:
            response = requests.post(API_URL, json=payload, headers=headers)
            if response.status_code in [200, 201]:
                print(f"✅ Success: {migration['name']}")
                print(response.json())
            else:
                print(f"❌ Failed: {migration['name']} (Status {response.status_code})")
                print("Body:", response.text)
        except Exception as e:
            print(f"❌ Exception during {migration['name']}: {e}")

if __name__ == "__main__":
    apply_migrations()
