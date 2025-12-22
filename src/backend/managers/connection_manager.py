from fastapi import WebSocket
from typing import List, Dict, Optional, Set
import logging
import asyncio    

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Manages WebSocket connections for the transcription service.
    Handles lifecycle (connect, disconnect) and broadcasting.
    """
    def __init__(self):
        # Active connections: session_id -> WebSocket (C# Service)
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Frontend Monitors: session_id -> Set[WebSocket]
        self.monitors: Dict[str, Set[WebSocket]] = {}
        
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, session_id: str):
        """Connect C# Service"""
        await websocket.accept()
        async with self.lock:
            self.active_connections[session_id] = websocket
            logger.info(f"WebSocket connected for session: {session_id}")

    async def disconnect(self, session_id: str):
        """Disconnect C# Service"""
        async with self.lock:
            if session_id in self.active_connections:
                del self.active_connections[session_id]
                logger.info(f"WebSocket disconnected for session: {session_id}")

    async def reassign_active_connection(self, old_session_id: str, new_session_id: str, websocket: WebSocket):
        """
        Dynamically update the session ID for an active connection.
        Used when the Producer (C#) notifies it has started a specific session.
        """
        async with self.lock:
            # 1. Remove old mapping if it matches this websocket
            if old_session_id in self.active_connections and self.active_connections[old_session_id] == websocket:
                del self.active_connections[old_session_id]
            
            # 2. Add new mapping
            self.active_connections[new_session_id] = websocket
            logger.info(f"Reassigned Producer Connection: {old_session_id} -> {new_session_id}")

    # New methods for Frontend Monitoring
    async def register_monitor(self, session_id: str, websocket: WebSocket):
        """Register a frontend client to monitor a session."""
        async with self.lock:
            if session_id not in self.monitors:
                self.monitors[session_id] = set()
            self.monitors[session_id].add(websocket)
            logger.info(f"Frontend registered to monitor session: {session_id}")

    async def unregister_monitor(self, session_id: str, websocket: WebSocket):
        async with self.lock:
            if session_id in self.monitors:
                if websocket in self.monitors[session_id]:
                    self.monitors[session_id].remove(websocket)
                if not self.monitors[session_id]:
                    del self.monitors[session_id]

    async def broadcast_to_monitors(self, session_id: str, data: dict):
        """Send data to all frontend monitors for a session."""
        # Use copy of set to avoid modification during iteration issues (though async lock protects structure)
        monitors = []
        async with self.lock:
            if session_id in self.monitors:
                monitors = list(self.monitors[session_id])
        
        for ws in monitors:
            try:
                await ws.send_json(data)
            except Exception as e:
                # If send fails, we might want to unregister, but let's let lifecycle handle it or use heartbeat
                logger.debug(f"Failed to send to monitor: {e}")

    def has_active_csharp_connection(self) -> bool:
         """Check if any C# service is connected."""
         return len(self.active_connections) > 0

    async def send_json(self, session_id: str, data: dict):
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.error(f"Failed to send JSON to {session_id}: {e}")

    async def broadcast(self, data: dict):
        """Send to all connected clients (debug/admin use)."""
        for session_id, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except:
                pass

manager = ConnectionManager()
