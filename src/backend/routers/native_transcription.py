from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import logging
import asyncio

from managers.transcription_manager import TranscriptionManager

# Configure logic
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["native-transcription"])

@router.websocket("/native-transcription")
async def ws_native_transcription_endpoint(
    websocket: WebSocket, 
    client_id: str = Query(None),
    session_id: str = Query(None)
):
    print(f"TRAP: /api/ws/native-transcription hit! Client: {client_id} Session: {session_id}")

    """
    SOTA Native Transcription Endpoint.
    Delegates all logic to TranscriptionManager (Producer-Consumer).
    """
    # Use provided session_id or fallback to client_id or Generate
    if not client_id and not session_id:
        import uuid
        client_id = str(uuid.uuid4())
    
    active_session_id = session_id if session_id else client_id
    
    # HACK: Force TEST_SESSION if globally in test mode (orchestrated by audio_service_control)
    # This aligns the C# service stream (random UUID) with the Frontend Test Dialog (TEST_SESSION)
    if hasattr(websocket.app.state, "is_audio_test_active") and websocket.app.state.is_audio_test_active:
        active_session_id = "TEST_SESSION"
    
    logger.info(f"New Native Transcription Connection: {client_id} (Session: {active_session_id})")
    
    # Instantiate Manager for this connection (Option B: Per-connection state)
    manager = TranscriptionManager(websocket, active_session_id)
    
    try:
        # Run the manager (Handles Connect -> Loop -> Disconnect)
        # We await it; it blocks until connection closes.
        await manager.run()
        
    except WebSocketDisconnect:
        logger.info(f"Client disconnected gracefully: {client_id}")
    except Exception as e:
        logger.error(f"Unexpected error in WS endpoint: {e}", exc_info=True)
    finally:
        # Ensure cleanup happens if run() exits unexpectedly
        if manager.is_running:
            await manager.disconnect()
        logger.info(f"Connection closed for {client_id}")
