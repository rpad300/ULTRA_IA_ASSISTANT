from managers.chat_manager import ChatConnectionManager
from services.chat_logic import ChatService

# Global Singletons
# Shared between HTTP and WebSocket routers to ensure 
# that HTTP-sent messages are broadcasted to connected WS clients.

chat_manager = ChatConnectionManager()
chat_service = ChatService(chat_manager)

async def get_chat_service():
    """Dependency for HTTP endpoints."""
    return chat_service

async def get_chat_manager():
    """Dependency for HTTP endpoints (if needed directly)."""
    return chat_manager
