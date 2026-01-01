import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO, filename='debug_output.txt', filemode='w')
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger('').addHandler(console)
logger = logging.getLogger("debug_copilot")

async def test_copilot_connection():
    uri = "ws://localhost:8000/api/ws/threads/debug-test-thread/messages"
    logger.info(f"Connecting to {uri}...")
    
    headers = {
        "Origin": "http://localhost:5999" # Simulate valid origin
    }

    try:
        # SOTA: Test with valid Origin to verify CORS
        async with websockets.connect(uri, origin="http://localhost:5999") as websocket:
            logger.info("Successfully connected with Origin!")
            
            # Wait for initial messages
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                logger.info(f"Received: {msg}")
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for initial message")
            
            # Send a ping
            await websocket.send(json.dumps({"type": "ping", "content": "ping"}))
            logger.info("Sent ping")
            
            # Wait for response
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                logger.info(f"Received response: {msg}")
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for response")

    except websockets.exceptions.InvalidStatusCode as e:
        logger.error(f"Connection rejected with status code: {e.status_code}")
    except websockets.exceptions.ConnectionClosed as e:
        logger.error(f"Connection closed: {e.code} {e.reason}")
    except Exception as e:
         logger.error(f"Connection error: {e}")

if __name__ == "__main__":
    asyncio.run(test_copilot_connection())
