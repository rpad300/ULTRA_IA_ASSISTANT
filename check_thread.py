import asyncio
from db.supabase_client import get_supabase_client

async def check_thread():
    try:
        supabase = get_supabase_client()
        thread_id = "5aaad0cb-1e83-443b-a850-c02f0b781be2"
        print(f"Checking for thread: {thread_id}")
        
        response = supabase.table("threads").select("*").eq("id", thread_id).execute()
        
        if response.data:
            print("Thread FOUND!")
            print(response.data[0])
        else:
            print("Thread NOT FOUND.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_thread())
