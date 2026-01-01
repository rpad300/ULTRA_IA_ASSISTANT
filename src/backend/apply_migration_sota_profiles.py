
import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

URL = os.environ.get("SUPABASE_URL")
# Use Service Role Key for Admin Access if available, else Anon (but Anon can't see all)
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

supabase: Client = create_client(URL, KEY)

def print_sql():
    print("\n" + "="*60)
    print(" MANUAL MIGRATION REQUIRED ")
    print(" The automated tool connection failed. Please run this SQL:")
    print("="*60 + "\n")
    
    sql = """
    -- 1. Add project_id to profiles (Foreign Key)
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

    -- 2. Update knowledge_sources to JSONB
    -- We drop the old text[] column if it exists to replace with JSONB structure
    -- WARNING: This deletes existing knowledge_sources data. 
    -- If you need to keep it, backup first.
    DO $$ 
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'knowledge_sources' AND data_type = 'ARRAY') THEN
            ALTER TABLE profiles DROP COLUMN knowledge_sources;
        END IF;
    END $$;

    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS knowledge_sources JSONB DEFAULT '[]'::jsonb;

    -- 3. Add other SOTA fields if missing
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS instructions JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS few_shot_examples JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS response_format TEXT,
    ADD COLUMN IF NOT EXISTS icon TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT;
    """
    print(sql)
    print("\n" + "="*60 + "\n")

def verify_migration():
    print("Context: Checking current schema via REST API...")
    try:
        # Try to select the new columns. If this fails, migration is not applied.
        res = supabase.table("profiles").select("project_id, knowledge_sources").limit(1).execute()
        print("✅ SUCCESS: 'project_id' and 'knowledge_sources' columns exist!")
        
        # Check type of knowledge_sources if possible (REST returns JSON)
        # We can't strict check type via REST easily without inspecting a row value, 
        # but if the select success, columns exist.
        
    except Exception as e:
        print("❌ VERIFICATION FAILED: Columns likely missing.")
        print(f"Error details: {e}")
        print("\nACTION: Please run the SQL above in your Supabase SQL Editor.")

if __name__ == "__main__":
    print_sql()
    verify_migration()
