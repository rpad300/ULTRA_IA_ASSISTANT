
import logging
from typing import Dict, Optional
from managers.streaming_session import StreamingSession

logger = logging.getLogger(__name__)

class SessionRegistry:
    """
    SOTA Session Registry.
    Singleton that holds StreamingSession objects independently of WebSocket connections.
    Ensures 'DeepFilterNet' state and 'Speaker History' survive disconnects.
    """
    _instance = None
    
    def __init__(self):
        self._sessions: Dict[str, StreamingSession] = {}
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SessionRegistry()
        return cls._instance
        
    def get_session(self, session_id: str) -> Optional[StreamingSession]:
        return self._sessions.get(session_id)
        
    def register_session(self, session_id: str, session: StreamingSession):
        if session_id in self._sessions:
            logger.warning(f"SessionRegistry: Overwriting existing session {session_id}")
        self._sessions[session_id] = session
        logger.info(f"SessionRegistry: Registered {session_id}")
        
    def end_session(self, session_id: str):
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.info(f"SessionRegistry: Removed {session_id}")

def get_session_registry():
    return SessionRegistry.get_instance()
