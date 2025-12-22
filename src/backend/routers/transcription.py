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
    
    try:
        logger.info(f"Starting Browser Mode Session {connection_id}. Use AAI: {use_assemblyai}")
        
        # Initialize Resources
        await manager.initialize_resources(
            language=language or "pt",
            company_name=company_name,
            project_name=project_name,
            use_assemblyai=use_assemblyai
        )

        while True:
            message = await websocket.receive()
            
            if message["type"] == "websocket.disconnect":
                 raise WebSocketDisconnect(message.get("code", 1000))
            
            if "bytes" in message:
                await manager.process_audio_packet(message["bytes"])
                
            elif "text" in message:
                await _handle_control_message(websocket, message["text"], connection_id)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected {connection_id}")
    except Exception as e:
        logger.error(f"Streaming Error {connection_id}: {e}", exc_info=True)
        try:
             await websocket.close(code=1011)
        except: pass
    finally:
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
        await connection_manager.unregister_monitor(session_id, websocket)

async def _handle_control_message(websocket: WebSocket, text: str, connection_id: str):
    """Parses JSON control messages."""
    try:
        data = json.loads(text)
        msg_type = data.get("type")
        if msg_type == "ping":
            await websocket.send_json({"type": "pong"})
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
            # Just broadcast update to others (frontend state update)
            # Native service might handle actual re-clustering but we can update UI
            pass 
    except Exception:
        pass
