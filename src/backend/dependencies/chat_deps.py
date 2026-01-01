
from typing import Optional
from managers.chat_manager import ChatConnectionManager
from services.chat_logic import ChatService

# SOTA: Initialize globals to None to prevent premature execution
_chat_manager: Optional[ChatConnectionManager] = None
_chat_service: Optional[ChatService] = None

async def init_chat_system():
    """
    SOTA Lifecycle: Called on startup (main.py lifespan).
    Ensures Redis and Heartbeat are safely started.
    """
    global _chat_manager, _chat_service
    
    if _chat_manager is None:
        _chat_manager = ChatConnectionManager()
        # Async initialization of Pub/Sub and Heartbeat
        # This is CRITICAL: waiting for this ensures Redis is ready 
        # before any user can connect.
        await _chat_manager.initialize()
        
    if _chat_service is None:
        # Inject initialized manager into service
        _chat_service = ChatService(_chat_manager)
    
    return _chat_manager, _chat_service

async def get_chat_manager() -> ChatConnectionManager:
    """SOTA Dependency injection for WebSocket and Logic."""
    if _chat_manager is None:
        raise RuntimeError("Chat System not initialized. Call init_chat_system() on startup.")
    return _chat_manager

async def get_chat_service() -> ChatService:
    """SOTA Dependency injection for Routers."""
    if _chat_service is None:
        raise RuntimeError("Chat System not initialized. Call init_chat_system() on startup.")
    return _chat_service
