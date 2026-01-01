
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
from pydantic import BaseModel

from managers.chat_manager import ChatConnectionManager
from services.chat_logic import ChatService
from schemas.chat import IncomingMessage, ErrorMessage
from dependencies.chat_deps import get_chat_manager, get_chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["chat"])

@router.on_event("startup")
async def on_startup():
    # Ensure manager is initialized
    await get_chat_manager()

@router.websocket("/threads/{thread_id}/messages")
async def websocket_thread_messages(websocket: WebSocket, thread_id: str, token: Optional[str] = Query(None)):
    """
    SOTA Chat WebSocket.
    - Distributed (via Manager).
    - Logic Decoupled (via Service).
    - Strict Typing.
    """
    try:
        # SOTA: Get dependencies BEFORE accepting to prevent zombie connections if deps fail
        # This also ensures we don't accept if the system isn't ready (e.g. Redis down)
        print(f"DEBUG_WS: Attempting Thread={thread_id}")
        manager = await get_chat_manager()
        print("DEBUG_WS: Manager OK")
        chat_service = await get_chat_service()
        print("DEBUG_WS: Service OK")

        await websocket.accept()
        print(f"DEBUG_WS: Accepted Thread {thread_id}")
        logger.info(f"WS Accepted: Thread {thread_id}")
    except Exception as e:
        logger.error(f"WS Handshake/Dependency Failed: {e}")
        print(f"DEBUG_WS: Handshake ERROR: {e}")
        # If we haven't accepted, we can't really send a close code easily in standard FastAPI 
        # without accepting first, but returning here will close the transport.
        return

    logger.debug(f"WS Processing: Thread {thread_id} | Token: {bool(token)}")
    
    try:
        # Register connection (Manager no longer accepts, just registers)
        await manager.connect(websocket, thread_id)
        
        # 1. Send Initial Messages
        try:
            history = await chat_service.get_initial_messages(thread_id)
            await manager.send_personal({
                "type": "initial_messages",
                "messages": history
            }, websocket)
        except Exception as e:
            logger.error(f"Failed to fetch history: {e}")
            await manager.send_personal({"type": "error", "message": "Failed to load history"}, websocket)
        
        # 2. Main Loop
        while True:
            try:
                data = await websocket.receive_json()
            except RuntimeError as e:
                if "not connected" in str(e).lower() or "close" in str(e).lower():
                    logger.info(f"WS Disconnect (RuntimeError): {thread_id}")
                    break
                raise e
            
            try:
                # Validation
                # We strictly assume 'send_message' or similar. 
                # Ideally validation happens here.
                # Simplification: We check type manually or blindly pass to schema if struct matches.
                
                msg_type = data.get("type")
                
                if msg_type == "send_message":
                    # Pydantic Validate
                    try:
                        validated = IncomingMessage(**data)
                        content = validated.content
                        role = validated.role
                        
                        await chat_service.handle_user_message(thread_id, content, role)
                        
                    except Exception as e:
                        logger.warning(f"Invalid Message: {e}")
                        await manager.send_personal({"type": "error", "message": "Invalid message format."}, websocket)
                
                elif msg_type == "ping":
                    await manager.send_personal({"type": "pong"}, websocket)
                    
            except Exception as e:
                logger.error(f"Message Processing Error: {e}", exc_info=True)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, thread_id)
        logger.info(f"Client disconnected: {thread_id}")
    except Exception as e:
        logger.error(f"Connection Error: {e}", exc_info=True)
        # Try to disconnect if manager available
        try:
             manager.disconnect(websocket, thread_id)
        except: pass

class TranscriptionPreferenceRequest(BaseModel):
    session_id: Optional[str] = None
    service: str

@router.post("/preference")
async def set_transcription_preference(request: TranscriptionPreferenceRequest):
    """
    Set transcription preference for a session.
    """
    logger.info(f"Setting transcription preference: {request}")
    # Here we would typically update a store or notify the audio service.
    # For now, we mock the success to satisfy the frontend.
    return {"status": "success", "service": request.service}

