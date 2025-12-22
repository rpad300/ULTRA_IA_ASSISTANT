import asyncio
import aiohttp
import json
import logging
import sys
from datetime import datetime

import logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# We use the Backend API to start the service, as it handles the API Key injection.
# This mimics the real frontend flow.
BACKEND_API_URL = "http://localhost:8000/api/audio-service"
AUDIO_SERVICE_START_URL = f"{BACKEND_API_URL}/start"

# We still fetch devices directly from C# (8001) or via Backend (8000). 
# Let's use Backend for consistency: /api/audio-service/devices
DEVICES_URL = f"{BACKEND_API_URL}/devices"

BACKEND_WS_URL = "ws://localhost:8000/api/ws/transcription"

async def get_audio_devices():
    """Fetches available audio devices via the Python Backend."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(DEVICES_URL) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Devices Payload Keys: {list(data.keys())}")
                    
                    # Based on logs, the key is 'devices'
                    # It likely contains a list of combined devices with 'dataFlow' property
                    return data.get("devices", [])
                else:
                    logger.error(f"Failed to fetch devices: {response.status}")
                    return []
    except Exception as e:
        logger.error(f"Failed to fetch devices: {e}")
        return []

async def verify_transcription():
    logger.info("Starting Transcription Verification...")

    # 1. Fetch Devices and Finding HyperX
    devices = await get_audio_devices()
    selected_device_id = None
    
    if devices:
        logger.info(f"Found {len(devices)} devices:")
        for device in devices:
            logger.info(f" - {device.get('name')} (ID: {device.get('id')})")
            if "HyperX" in device.get("name", ""):
                 logger.info(f"Found HyperX Device: {device['name']} (ID: {device['id']})")
                 selected_device_id = device['id']
    
    if not selected_device_id:
        logger.warning("HyperX device not found. Using default/first available if any.")

    # 2. Start Audio Service via Backend
    async with aiohttp.ClientSession() as session:
        # No apiKey needed here, backend adds it
        payload = {
            "language": "pt"
        }
        if selected_device_id:
            payload["microphoneDeviceId"] = selected_device_id

        logger.info(f"Starting audio service via Backend with payload: {payload}")
        try:
            # Send valid JSON body to avoid 422
            async with session.post(AUDIO_SERVICE_START_URL, json=payload) as resp:
                if resp.status == 200:
                    logger.info("Audio Service start command sent successfully.")
                else:
                    text = await resp.text()
                    logger.error(f"Failed to start audio service: {resp.status} - {text}")
                    return
        except Exception as e:
            logger.error(f"Failed to call start endpoint: {e}")
            return

    # 3. Connect to WebSocket
    logger.info(f"Connecting to WebSocket: {BACKEND_WS_URL}")
    async with aiohttp.ClientSession() as session:
        try:
            async with session.ws_connect(BACKEND_WS_URL) as ws:
                logger.info("WebSocket Connected!")
                
                # Send "connect" message (if your protocol requires it, meetingStore suggests it might just need connection)
                # But let's just listen.
                
                logger.info("Listening for messages... (Please speak into your microphone)")
                
                message_count = 0
                max_messages = 5 # Exit after receiving 5 messages to prove it works
                
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        msg_type = data.get("type")
                        
                        logger.info(f"Received Message: Type='{msg_type}'")
                        
                        if msg_type == "transcript":
                            text = data.get("text", "")
                            is_final = data.get("is_final", False)
                            logger.info(f"✅ TRANSCRIPT RECEIVED: '{text}' (Final: {is_final})")
                            logger.info("SUCCESS: The transformation logic is working!")
                            message_count += 1
                        elif msg_type == "status":
                            logger.info(f"Status Update: {data.get('status')} - {data.get('message', '')}")
                        else:
                            logger.info(f"Other Data: {data}")
                            
                        if message_count >= max_messages:
                            logger.info("Verification Complete: Received enough transcripts.")
                            break
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        logger.error('ws connection closed with exception %s', ws.exception())

        except Exception as e:
            logger.error(f"WebSocket connection failed: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(verify_transcription())
    except KeyboardInterrupt:
        logger.info("Verification stopped by user.")
