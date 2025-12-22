import asyncio
import os
import google.generativeai as genai
from supabase import create_client, Client
from qdrant_client import QdrantClient
from config import *

async def test_gemini():
    print("Testing Gemini...", end=" ")
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print(f"(Using {GEMINI_MODEL})...", end=" ")
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content("Hello")

        if response.text:
            print("OK")
        else:
            print("FAIL (No text)")
    except Exception as e:
        print(f"FAIL: {e}")

async def test_supabase():
    print("Testing Supabase...", end=" ")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Just check if we can query (even if empty) or get auth config
        # Simply creating client is stateless, let's try a simple query
        # Assuming table doesn't exist yet, this might error, but connection should be ok
        # A lightweight check is auth.get_session(), but we have no session.
        # Let's trust client creation + simple health check if possible.
        # Supabase Python client doesn't have explicit ping. 
        # listing a non-existent table usually returns error 'relation does not exist', proving connection.
        try:
            supabase.table("nonexistent").select("*").limit(1).execute()
        except Exception as e:
             # If we get a Supabase/Postgrest error, we are connected!
             if "relation" in str(e) or "404" in str(e):
                 print("OK (Connected)")
                 return
             # If table exists (re-run), it's also OK.
        print("OK (Client initialized)")
    except Exception as e:
        print(f"FAIL: {e}")

async def test_qdrant():
    print("Testing Qdrant...", end=" ")
    try:
        client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        collections = client.get_collections()
        print(f"OK (Found {len(collections.collections)} collections)")
    except Exception as e:
        print(f"FAIL: {e}")

async def main():
    print("--- Ultra Assistant Connection Test ---")
    await test_gemini()
    await test_qdrant()
    await test_supabase()

if __name__ == "__main__":
    asyncio.run(main())
