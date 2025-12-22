import asyncio
import httpx

async def stop_test():
    # Hit the backend proxy stop endpoint (port 8000) or C# directly (8001)
    # Let's hit C# directly to be sure we unblock it.
    url = "http://localhost:8001/api/audio-service/test/stop"
    print(f"Sending POST to {url}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(stop_test())
