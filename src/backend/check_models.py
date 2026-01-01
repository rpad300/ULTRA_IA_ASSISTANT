
import asyncio
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

async def list_models():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set")
        return

    client = genai.Client(api_key=api_key)
    
    print("Fetching models...")
    # The new SDK might use client.models.list() or similar
    try:
        # Paging through models
        # Note: 'genai.Client' is the V2 SDK. 
        # We need to find the specific method. usually client.models.list()
        # It usually returns an pager.
        
        # Let's try to verify the exact method by just printing what we find or guessing standard
        # Based on previous file reads, it is `client.aio.models` or `client.models`
        
        pager = client.models.list() 
        
        best_model = None
        max_context = 0
        
        for model in pager:
            # Inspection
            print(f"Model: {model.name}")
            print(f"  Display: {model.display_name}")
            try:
                # Try common attributes
                print(f"  Context: {model.input_token_limit}")
                # print(f"  Methods: {model.supported_generation_methods}") # This failed
            except:
                pass

    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
