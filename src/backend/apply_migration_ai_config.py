import os
import asyncio
import sys

# Ensure backend imports work
# Check if we are in src/backend, if so add it to path.
if os.path.basename(os.getcwd()) == "backend":
    sys.path.append(os.getcwd())
else:
    # If running from root, append src/backend
    sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

from supabase import create_client, Client
from dotenv import load_dotenv, find_dotenv

# Load env using same logic as config.py
env_file = find_dotenv(usecwd=True)
if env_file:
    print(f"Loading .env from: {env_file}")
    load_dotenv(env_file, override=True)
else:
    # Fallback for explicit path
    explicit_env = os.path.join(os.getcwd(), ".env")
    if os.path.exists(explicit_env):
        print(f"Loading .env from explicit path: {explicit_env}")
        load_dotenv(explicit_env, override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def apply_migration():
    print("Applying migration: create_ai_configurations_table...")

    # SQL definition for ai_configurations
    # using 'slug' as primary key for fast lookups
    sql = """
    CREATE TABLE IF NOT EXISTS ai_configurations (
        slug TEXT PRIMARY KEY,
        model_name TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
        system_prompt TEXT NOT NULL,
        temperature FLOAT NOT NULL DEFAULT 0.0,
        max_tokens INTEGER NOT NULL DEFAULT 2048,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Create index on slug (implicitly created by PK but good to be explicit for performance understanding)
    -- CREATE INDEX IF NOT EXISTS idx_ai_configurations_slug ON ai_configurations (slug);
    """

    try:
        # We use rpc call or direct sql execution if enabled. 
        # Since python supabase client doesn't support direct SQL execution easily without a function,
        # we will use the 'exec_sql' pattern if available, or just assume the user has a way to run it.
        # However, for this environment, we usually implement a helper or assume rpc 'exec_sql' exists 
        # OR we just use the table creation via Supabase dashboard if this fails.
        # But wait, looking at previous migrations, they often use a specific postgres connection or just print instructions if RPC fails.
        # Let's try to verify if we can use a standard PG connection or if we need to rely on `rpc`.
        # Assuming we have a `exec_sql` function in Supabase (standard pattern in this repo? - checking previous files)
        # Checking `apply_migration_013.py` pattern in file list... it seems custom.
        # Let's try to query an RPC named 'exec_sql', if it fails, we default to printing the SQL.
        
        # ACTUALLY, checking previous `apply_migration_*.py` files in the file list (step 4), let's stick to the simplest approach: 
        # Attempt to create via Supabase client if possible, or use `psycopg2` if available in env.
        # Given I don't see psycopg2 in `requirements.txt` (checked partially), I will try the RPC method first.
        
        response = supabase.rpc('exec_sql', {'sql_query': sql}).execute()
        print("Migration applied successfully via RPC.")
        
    except Exception as e:
        print(f"RPC 'exec_sql' failed or schema creation error: {e}")
        print("attempting direct connection fallback if available or manual instruction.")
        print("-" * 50)
        print("PLEASE RUN THIS SQL IN SUPABASE SQL EDITOR:")
        print(sql)
        print("-" * 50)

    # Insert default configs for Agent 4 (Oracle) as requested
    seed_sql = """
    INSERT INTO ai_configurations (slug, model_name, system_prompt, temperature, max_tokens)
    VALUES 
    ('oracle_agent', 'gemini-1.5-pro', 'You are the Intervention Oracle. Analyze the conversation transcript in real-time. Detect contradictions, forgotten commitments, and technical inaccuracies. Be concise. Output structured JSON.', 0.0, 1024),
    ('chat_agent', 'gemini-1.5-pro', 'You are an advanced AI assistant. Help the user with their tasks.', 0.7, 2048)
    ON CONFLICT (slug) DO NOTHING;
    """
    
    try:
        supabase.rpc('exec_sql', {'sql_query': seed_sql}).execute()
        print("Seed data inserted successfully.")
    except Exception as e:
        print(f"Seed data insertion failed via RPC: {e}")
        print("PLEASE RUN THIS SEED SQL:")
        print(seed_sql)

if __name__ == "__main__":
    asyncio.run(apply_migration())
