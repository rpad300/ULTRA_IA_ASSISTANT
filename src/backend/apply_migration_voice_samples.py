
import requests
import os

# Using the credentials from the codebase (same as apply_migration_companies.py)
PROJECT_REF = "pijyawytynnynwrtbule"
# Note: Ideally these should be env vars, but we reuse existing pattern for quick fix
# This token appears to be a Service Role or Management API token
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2" 
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

SQL = """
-- Create table if it incorrectly didn't exist
create table if not exists voice_samples (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references contacts(id) on delete cascade not null,
    file_path text not null,
    file_name text,
    duration_ms int,
    transcript text,
    word_count int,
    created_at timestamp with time zone default now()
);

-- Add columns if missing
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'voice_samples' and column_name = 'transcript') then
        alter table voice_samples add column transcript text;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'voice_samples' and column_name = 'word_count') then
        alter table voice_samples add column word_count int;
    end if;
end $$;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload config';
"""

def apply_migration():
    print(f"Applying voice_samples migration to {PROJECT_REF}...")
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {"query": SQL}

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
