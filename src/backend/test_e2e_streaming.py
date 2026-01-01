
import asyncio
import websockets
import json
import numpy as np
import argparse
import logging
import time
import struct

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TestClient")

def generate_sine_wave(duration_sec, freq=440, sample_rate=16000):
    """Generates a sine wave audio signal (16-bit PCM)."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    # Generate sine wave
    audio = 0.5 * np.sin(2 * np.pi * freq * t)
    # Convert to 16-bit PCM
    audio_int16 = (audio * 32767).astype(np.int16)
    return audio_int16.tobytes()

async def run_test(uri, token, dur):
    full_uri = f"{uri}?token={token}&session_id=test-session-{int(time.time())}"
    logger.info(f"Connecting to {full_uri}...")
    
    try:
        async with websockets.connect(full_uri) as websocket:
            logger.info("WebSocket connected.")
            
            # 1. Wait for Ready Status
            status_msg = await websocket.recv()
            status = json.loads(status_msg)
            logger.info(f"Received Status: {status}")
            
            if status.get("status") != "connected":
                logger.error("Failed to receive 'connected' status.")
                return

            # 2. Stream Audio
            logger.info(f"Streaming {dur} seconds of audio...")
            audio_bytes = generate_sine_wave(dur)
            chunk_size = 3200 # 200ms at 16kHz (2 bytes/sample * 16000 * 0.2)
            
            offset = 0
            start_stream = time.time()
            
            # Sending Task
            async def send_audio():
                nonlocal offset
                while offset < len(audio_bytes):
                    chunk = audio_bytes[offset:offset+chunk_size]
                    await websocket.send(chunk)
                    offset += chunk_size
                    await asyncio.sleep(0.1) # Simulate real-time (100ms sleep for 200ms chunk is fast, let's do 0.2 sleep)
                    await asyncio.sleep(0.1) 
                    logger.debug(f"Sent chunk {len(chunk)} bytes")
                
                # Send explicit EOF check if needed, or just stop
                logger.info("Finished sending audio.")
            
            # Receiving Task
            async def receive_transcripts():
                while True:
                    try:
                         # Set generic timeout to verify response
                        msg = await asyncio.wait_for(websocket.recv(), timeout=dur + 5.0)
                        data = json.loads(msg)
                        
                        if "type" in data and data["type"] == "error":
                            logger.error(f"Received Error: {data}")
                        
                        logger.info(f"Received Message: {data}")
                        
                        # Check for transcript
                        if data.get("type") == "transcript":
                            logger.info(f"✅ TRANSCRIPT RECEIVED: {data.get('text')}")
                            
                    except asyncio.TimeoutError:
                        logger.warning("Timeout waiting for response.")
                        break
                    except websockets.exceptions.ConnectionClosed:
                        logger.info("Connection closed by server.")
                        break
            
            # Run both
            sender = asyncio.create_task(send_audio())
            receiver = asyncio.create_task(receive_transcripts())
            
            # Wait for sender to finish
            await sender
            
            # Wait a bit more for final processing
            await asyncio.sleep(2.0)
            
            # Close
            await websocket.close()
            try:
                await receiver
            except: pass

            logger.info("Test Complete.")

    except Exception as e:
        logger.error(f"Connection Failed: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="E2E Streaming Test")
    parser.add_argument("--url", default="ws://localhost:8000/api/ws/audio-stream", help="WebSocket URL")
    parser.add_argument("--token", default="valid-token", help="Auth token")
    parser.add_argument("--dur", type=int, default=5, help="Duration in seconds")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(run_test(args.url, args.token, args.dur))
    except KeyboardInterrupt:
        pass
