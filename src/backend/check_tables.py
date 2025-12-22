from db.supabase_client import get_supabase_client

def check_tables():
    print("Checking for 'companies' table...", end=" ")
    supabase = get_supabase_client()
    try:
        # Try to select 1 row. If table doesn't exist, it throws an error.
        supabase.table("companies").select("id").limit(1).execute()
        print("EXISTS! (Schema applied)")
    except Exception as e:
        print(f"MISSING. ({e})")

if __name__ == "__main__":
    check_tables()
