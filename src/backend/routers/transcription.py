"""
Transcription Router - Universal Streaming API v3
Uses AssemblyAI's Universal Streaming API directly via WebSocket v3.
Supports language detection, partial results, speaker labels, and keep-alive.
Reference: https://www.assemblyai.com/docs/universal-streaming
"""

import asyncio
import json
import uuid
from typing import Optional
from urllib.parse import urlencode
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.websockets import WebSocketState
import websockets.exceptions
import logging

from managers.streaming_manager import StreamingManager
from managers.connection_manager import manager as connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["transcription"])

# AssemblyAI Universal Streaming API endpoint
ASSEMBLYAI_STREAMING_URL = "wss://streaming.assemblyai.com/v3/ws"


@router.websocket("/transcription")
async def transcription_websocket(
    websocket: WebSocket,
    language: Optional[str] = Query(None, description="Language code (e.g. 'pt', 'en')"),
    company_name: Optional[str] = Query(None, description="Company name for word boost"),
    project_name: Optional[str] = Query(None, description="Project name for word boost"),
    session_id: Optional[str] = Query(None, description="Session ID - if provided and C# service is active, only receives transcriptions"),
    mode: Optional[str] = Query("auto", description="Mode: 'auto' (detect), 'native' (receive only), 'browser' (send audio)"),
    use_assemblyai: bool = Query(True, alias="useAssemblyAI", description="Use AssemblyAI (default) or Local Whisper"),
):
    print(f"TRAP: /api/ws/transcription hit! Mode: {mode} Session: {session_id}")

    """
    Universal Streaming WebSocket endpoint for realtime transcription.
    Delegates orchestration to SOTA StreamingManager.
    """
    try:
        await websocket.accept()
    except Exception as e:
        logger.error(f"Failed to accept WebSocket: {e}")
        return

    # Check for Native Mode (C# Service)
    if mode == "native" or (mode == "auto" and connection_manager.has_active_csharp_connection()):
        await _handle_native_mode(websocket, session_id)
        return

    # Browser Mode (SOTA StreamingManager)
    connection_id = str(uuid.uuid4())
    manager = StreamingManager(websocket, session_id, connection_id)
    
    # Heartbeat Task (SOTA Keep-Alive)
    heartbeat_task = None

    # SOTA: Handshake State & Compression
    handshake_complete = False
    compression_enabled = False # Detect from handshake
    
    try:
        logger.info(f"Starting Browser Mode Session {connection_id}. Use AAI: {use_assemblyai}")
        
        # Initialize Resources
        await manager.initialize_resources(
            language=language or "pt",
            company_name=company_name,
            project_name=project_name,
            use_assemblyai=use_assemblyai
        )
        
        # SOTA: Active Server-Side Heartbeat to keep connection alive through firewalls
        async def _heartbeat_loop():
            try:
                while True:
                    await asyncio.sleep(15) # Send ping every 15s
                    await websocket.send_json({"type": "ping", "timestamp": str(asyncio.get_event_loop().time())})
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.debug(f"Heartbeat failed: {e}")

        heartbeat_task = asyncio.create_task(_heartbeat_loop())

        # SOTA: Rate Limiting / Backpressure
        # Prevent queue overflow from malicious or buggy clients
        BYTES_THRESHOLD = 500000 
        
        import zlib # SOTA: Local import for compression

        while True:
            # VRAM/Queue Load Check (SOTA VRAM Awareness)
            session_queue_size = manager.session.raw_audio_queue.qsize()
            if session_queue_size > 500:
                 logger.warning(f"Backpressure: Queue full ({session_queue_size}), slowing down read.")
                 # Emit System Load Warning
                 if session_queue_size % 100 == 0:
                     await websocket.send_json({"type": "system_load", "load": "high", "queue": session_queue_size})
                 await asyncio.sleep(0.1)
            
            message = await websocket.receive()
            
            if message["type"] == "websocket.disconnect":
                 raise WebSocketDisconnect(message.get("code", 1000))
            
            if "bytes" in message:
                payload = message["bytes"]

                # SOTA: Decompression (ZLIB)
                if compression_enabled:
                    try:
                        payload = zlib.decompress(payload)
                    except zlib.error:
                        logger.warning(f"ZLib Decompression Failed for {connection_id}. Assuming raw PCM.")
                
                await manager.process_audio_packet(payload)
                
            elif "text" in message:
                # SOTA: Intercept Handshake
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "handshake":
                        specs = data.get("specs", {})
                        logger.info(f"SOTA Handshake [{connection_id}]: {specs}")
                        handshake_complete = True
                        if specs.get("compression") == "zlib":
                            compression_enabled = True
                            logger.info(f"Compression Enabled (ZLIB) for {connection_id}")
                        
                        # Instant Calibration (mock)
                        # manager.set_sample_rate(specs.get("sampleRate", 16000))

                        # Reply
                        await websocket.send_json({"type": "handshake_ack", "status": "ready"})
                        continue
                except:
                    pass

                await _handle_control_message(websocket, message["text"], connection_id)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected {connection_id}")
    except Exception as e:
        logger.error(f"Streaming Error {connection_id}: {e}", exc_info=True)
        try:
             await websocket.close(code=1011)
        except: pass
    finally:
        if heartbeat_task: heartbeat_task.cancel()
        await manager.stop()

async def _handle_native_mode(websocket: WebSocket, session_id: Optional[str]):
    """Handles logic when C# service is providing audio, Frontend just listens."""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    logger.info(f"Using NATIVE mode. Session: {session_id}")
    await connection_manager.register_monitor(session_id, websocket)
    
    await websocket.send_json({
        "type": "status",
        "status": "connected",
        "mode": "native",
        "session_id": session_id,
        "message": "Connected in native mode"
    })
    
    # Heartbeat Task for Native Monitor
    heartbeat_task = asyncio.create_task(_native_heartbeat(websocket))

    try:
        while True:
            message = await websocket.receive()
            
            if message["type"] == "websocket.disconnect":
                 raise WebSocketDisconnect(message.get("code", 1000))
                 
            if "text" in message:
                 # Allow speaker assignment etc. in native mode too
                 await _handle_native_control_message(websocket, message["text"], session_id)
    except WebSocketDisconnect:
        logger.info("Native listener disconnected")
    finally:
        heartbeat_task.cancel()
        await connection_manager.unregister_monitor(session_id, websocket)

async def _native_heartbeat(websocket: WebSocket):
    try:
        while True:
            await asyncio.sleep(15)
            await websocket.send_json({"type": "ping"})
    except: pass

async def _handle_control_message(websocket: WebSocket, text: str, connection_id: str):
    """Parses JSON control messages."""
    try:
        data = json.loads(text)
        msg_type = data.get("type")
        if msg_type == "ping":
            # SOTA: Telemetry Sync - Echo client timestamp for RTT calc
            response = {"type": "pong"}
            if "client_timestamp" in data:
                response["client_timestamp"] = data["client_timestamp"]
            await websocket.send_json(response)
        elif msg_type == "stop":
            raise WebSocketDisconnect() 
    except json.JSONDecodeError:
        pass

async def _handle_native_control_message(websocket: WebSocket, text: str, session_id: str):
    """Handles speaker updates in native mode."""
    try:
        data = json.loads(text)
        msg_type = data.get("type")
        
        if msg_type == "ping":
            await websocket.send_json({"type": "pong"})
            
        elif msg_type == "assign_speaker":
            # SOTA: Bridge to Biometric Real-time Assignment
            # Frontend sent: {type: "assign_speaker", trace_id: "...", contact_id: "..."}
            trace_id = data.get("trace_id")
            contact_id = data.get("contact_id")
            guest_id = data.get("guest_id") # Optional alias
            
            if trace_id and contact_id:
                # We need to notify the Active Manager for this session to update its map
                # This calls the method we just implemented in TranscriptionManager!
                from managers.connection_manager import manager as global_manager
                session_manager = global_manager.get_manager(session_id)
                
                if session_manager:
                    # We need the contact name for the mapping. 
                    # Ideally passed in payload or fetched.
                    # Fetching from DB is safer but slower. 
                    # For speed, if frontend sends contact_name, use it.
                    contact_name = data.get("contact_name")
                    
                    if not contact_name:
                         # Quick fetch or default
                         # SOTA: Ideally we don't block here. But let's defer.
                         # Actually `voice_optimization.py` endpoint is the robust path.
                         # This WS path is "Control Plane".
                         # Let's call the manager update directly if we have name.
                         pass

                    if contact_name:
                         # Guest ID is usually the 'speaker' label in the transcript (e.g. "Guest 1")
                         # If trace_id is what identifies the bubble, we map that trace's speaker?
                         # Usually we map "Guest 1" -> "Pedro".
                         # So we need 'guest_id' in the payload.
                         target_guest_id = guest_id or "Unknown"
                         await session_manager.update_guest_mapping(target_guest_id, contact_name, contact_id)
                         
                         # Acknowledge
                         await websocket.send_json({
                             "type": "ack", 
                             "reply_to": "assign_speaker", 
                             "status": "success",
                             "message": f"Mapped {target_guest_id} to {contact_name}"
                         })
    
    except Exception as e:
        logger.error(f"Native Control Error: {e}")

