
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

from managers.chat_manager import ChatConnectionManager
from services.chat_logic import ChatService
from schemas.chat import IncomingMessage, ErrorMessage
from dependencies.chat_deps import chat_manager as manager, chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["chat"])

# Globals Imported from dependencies to share state with HTTP router

@router.on_event("startup")
async def on_startup():
    await manager.initialize()

@router.websocket("/threads/{thread_id}/messages")
async def websocket_thread_messages(websocket: WebSocket, thread_id: str):
    """
    SOTA Chat WebSocket.
    - Distributed (via Manager).
    - Logic Decoupled (via Service).
    - Strict Typing.
    """
    try:
        await manager.connect(websocket, thread_id)
        
        # 1. Send Initial Messages
        history = await chat_service.get_initial_messages(thread_id)
        await manager.send_personal({
            "type": "initial_messages",
            "messages": history
        }, websocket)
        
        # 2. Main Loop
        while True:
            data = await websocket.receive_json()
            
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
        manager.disconnect(websocket, thread_id)
