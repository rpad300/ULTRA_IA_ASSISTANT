from supabase import create_client
import config

url = config.SUPABASE_URL
key = config.SUPABASE_KEY # Use KEY (service role usually if locally set, or anon)

if not url or not key:
    print(f"Missing credentials in config. URL={url}")
    exit(1)

supabase = create_client(url, key)

sql_commands = [
    # 1. Create Documents Table
    """
    CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id),
        name TEXT NOT NULL,
        drive_file_id TEXT,
        drive_folder_id TEXT, 
        file_path TEXT, 
        mime_type TEXT,
        size_bytes BIGINT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    # 2. Add drive_folder_id to Sessions if not exists
    """
    ALTER TABLE sessions 
    ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
    """
]

print("Applying SOTA DB Migrations...")

for cmd in sql_commands:
    try:
        # We can't execute raw SQL with supabase-py directly unless we have a specific function or use pg driver.
        # But commonly we have a 'rpc' or we rely on 'rest' which doesn't do DDL.
        # Wait, previous migrations in this project used `apply_migration_*.py`? Let's check one.
        # Checking `apply_migration_ai_config.py` in file list...
        pass
    except Exception as e:
        print(f"Error preparing command: {e}")

# RE-STRATEGY: Previous migrations likely used a text/rpc workaround or just printed SQL?
# Let's assume we can't run DDL via REST client directly.
# BUT we can try if there is an RPC function `exec_sql` (common pattern).
try:
    for cmd in sql_commands:
        # Try RPC if available
        # res = supabase.rpc('exec_sql', {'query': cmd}).execute()
        # If not, we might be stuck without DDL access via this client.
        print(f"Please run this SQL manually if RPC fails:\n{cmd}\n")
except Exception as e:
    print(f"Migration via RPC failed: {e}")

# Alternative: We can't easily auto-migrate without a Service Key that allows it, or a DB Driver.
# The user asked "is everything referenced in DB?".
# I will output the SQL to a file `db/migrations/20251230_drive_tracking.sql` and ask user to run or try to run it.
# Actually, I'll store it in artifacts for reference.
