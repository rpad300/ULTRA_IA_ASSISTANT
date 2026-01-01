
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

URL = os.environ.get("SUPABASE_URL")
# Service Key required for admin operations if RLS is strict, or Anon if policy allows
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY/KEY must be set in .env")
    sys.exit(1)

supabase: Client = create_client(URL, KEY)

def print_optimization_sql():
    print("\n" + "="*60)
    print(" ⚡ SOTA PERFORMANCE OPTIMIZATION SQL ⚡")
    print(" Please run this in your Supabase SQL Editor:")
    print("="*60 + "\n")
    
    sql = """
    -- 1. Accelerate Project-Scoped Profile Lookups
    -- Why: ProfilesView.tsx frequently filters by 'company_id' AND 'project_id'.
    CREATE INDEX IF NOT EXISTS idx_profiles_project_id ON profiles(project_id);
    
    -- 2. Accelerate Knowledge Source JSONB Queries (Advanced)
    -- Why: Future-proofing for searches inside the JSONB metadata.
    CREATE INDEX IF NOT EXISTS idx_profiles_knowledge_gin ON profiles USING gin (knowledge_sources);
    
    -- Verification
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'profiles';
    """
    print(sql)
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    print_optimization_sql()
