import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/api/ws/audio-stream?token=valid-token&session_id=test-ws-session"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            msg = await websocket.recv()
            print(f"Received: {msg}")
            
            # Send dummy audio
            await websocket.send(b'\x00' * 1000)
            print("Sent audio bytes")
            
            # Close
            await websocket.close()
            print("Closed")
    except Exception as e:
        print(f"WS Connection Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
