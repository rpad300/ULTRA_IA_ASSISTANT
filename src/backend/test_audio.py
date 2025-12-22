import asyncio
import httpx
import json

async def test_audio_service():
    url = "http://localhost:8000/api/audio-service/test/start"
    payload = {
        "microphoneDeviceId": "{0.0.1.00000000}.{e67b64f6-f4b6-41ce-993a-fd29f3ea9007}",
        "systemDeviceId": "{0.0.0.00000000}.{79544968-1dc0-471d-b3e7-9f09605bdf79}"
    }
    
    print(f"Sending POST to {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_audio_service())
