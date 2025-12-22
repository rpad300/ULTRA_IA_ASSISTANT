import asyncio
import httpx
import json

async def test_stop_start():
    base_url = "http://localhost:8001/api/audio-service"
    
    # 1. STOP
    print(f"1. Sending STOP to {base_url}/test/stop")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{base_url}/test/stop")
            print(f"STOP Status: {response.status_code}")
            print(f"STOP Response: {response.text}")
    except Exception as e:
        print(f"STOP Error: {e}")

    await asyncio.sleep(1)

    # 2. START
    print(f"2. Sending START to {base_url}/test/start")
    payload = {
        "microphoneDeviceId": "{0.0.1.00000000}.{e67b64f6-f4b6-41ce-993a-fd29f3ea9007}",
        "systemDeviceId": "{0.0.0.00000000}.{79544968-1dc0-471d-b3e7-9f09605bdf79}"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{base_url}/test/start", json=payload)
            print(f"START Status: {response.status_code}")
            print(f"START Response: {response.text}")
    except Exception as e:
        print(f"START Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_stop_start())
