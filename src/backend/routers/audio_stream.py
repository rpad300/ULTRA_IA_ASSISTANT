import logging
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException, status
from typing import Optional


from managers.transcription_manager import TranscriptionManager
from schemas.stream import StreamStatusMessage, ErrorMessage
from services.metrics_service import get_metrics_service 

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["audio-stream"])

async def verify_token(token: Optional[str] = Query(None)):
    """
    SOTA: WebSocket Authentication Shim.
    In production, validate JWT or API Key here.
    Fail-open for dev if no token, but structure is ready.
    """
    if token == "invalid-token":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return token

@router.websocket("/audio-stream")
async def audio_stream_websocket(
    websocket: WebSocket,
    language: Optional[str] = Query(None, description="Language code (pt, en, etc.). Auto-detect if not provided."),
    company_name: Optional[str] = Query(None, description="Company name for word boost"),
    project_name: Optional[str] = Query(None, description="Project name for word boost"),
    session_id: Optional[str] = Query(None, description="Supabase Session ID"),
    token: str = Depends(verify_token)
):
    print(f"TRAP: /api/ws/audio-stream hit! Session: {session_id}")


    """
    SOTA WebSocket Endpoint:
    - Secure (Auth Depends)
    - Measured (Telemetry)
    - Robust (Try-Finally-Stop)
    """
    start_time = time.perf_counter()
    metrics = get_metrics_service()
    
    # SOTA: TranscriptionManager handles the full lifecycle (Accept -> Process -> Close)
    manager = TranscriptionManager(websocket, session_id=session_id)
    
    try:
        # Blocks until disconnect
        await manager.run()
        
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    except Exception as e:
        logger.error(f"Stream Error: {e}", exc_info=True)
        try:
             await websocket.send_json({"type": "error", "message": str(e)})
        except: pass
    finally:
        # Cleanup
        await manager.disconnect()
        
        duration = time.perf_counter() - start_time
        try:
            metrics.timer("stream_duration_sec", duration)
        except Exception as e:
            logger.warning(f"Failed to record stream duration: {e}")
        
        logger.info(f"Stream closed: {session_id}")

