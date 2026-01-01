import uuid
import json
import asyncio
import logging
from fastapi import WebSocket
from typing import List, Dict, Optional, Set, Any
from services.redis_service import get_redis_service

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Manages WebSocket connections for the transcription service.
    Handles lifecycle (connect, disconnect) and distributed broadcasting via Redis.
    """
    def __init__(self):
        self.instance_id = str(uuid.uuid4())
        logger.info(f"Initializing ConnectionManager (Instance ID: {self.instance_id})")

        # Active connections: session_id -> WebSocket (C# Service)
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Frontend Monitors: session_id -> Set[WebSocket]
        self.monitors: Dict[str, Set[WebSocket]] = {}
        
        # SOTA: Registry for Logic Managers (e.g. TranscriptionManager)
        self.active_managers: Dict[str, Any] = {}
        
        self.lock = asyncio.Lock()
        self._redis_task = None

    async def initialize_distributed(self):
        """Start the Redis Pub/Sub listener loop."""
        self._redis_task = asyncio.create_task(self._redis_listener())

    async def _redis_listener(self):
        """Background task to listen for distributed events."""
        redis = await get_redis_service()
        if not redis:
            logger.warning("Redis not available. Distributed broadcasting disabled.")
            return

        pubsub = await redis.subscribe("transcription_events")
        if not pubsub: return

        logger.info("Started Distributed Redis Listener.")
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                
                try:
                    # Generic handling of msgpack or json
                    # RedisService handles decoding if we used its get/set, but pubsub.listen yields bytes
                    # We need to handle decoding manually or trust the lib
                    data_bytes = message["data"]
                    
                    # Try msgpack first if available
                    data = None
                    try:
                        import msgpack
                        data = msgpack.unpackb(data_bytes)
                    except:
                        data = json.loads(data_bytes.decode('utf-8'))
                    
                    if not data: continue

                    # Loop Prevention: Ignore messages from self
                    sender_id = data.get("sender_instance_id")
                    if sender_id == self.instance_id:
                        continue

                    # Process Event
                    event_type = data.get("event_type")
                    session_id = data.get("session_id")
                    payload = data.get("payload")

                    if event_type == "monitor_broadcast":
                         await self._broadcast_local(session_id, payload)

                except Exception as e:
                    logger.error(f"Error processing distributed message: {e}")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Redis Listener crashed: {e}")

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
        """Register a frontend client to monitor a session. Enforces Singleton to prevent zombies."""
        async with self.lock:
            if session_id in self.monitors:
                # Close existing monitors to prevent duplicates/zombies (Race Condition Fix)
                existing_monitors = list(self.monitors[session_id])
                if existing_monitors:
                    logger.warning(f"Closing {len(existing_monitors)} zombie monitors for session {session_id}")
                    for ws in existing_monitors:
                         if ws != websocket:
                            try:
                                await ws.close(code=4001, reason="Session takeover")
                            except:
                                pass
                self.monitors[session_id].clear()

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
        """
        Send data to monitors.
        1. Send to local monitors immediately.
        2. Publish to Redis for remote monitors.
        """
        # 1. Local Delivery
        await self._broadcast_local(session_id, data)

        # 2. Distributed Delivery
        try:
            redis = await get_redis_service()
            if redis:
                message = {
                    "sender_instance_id": self.instance_id,
                    "event_type": "monitor_broadcast",
                    "session_id": session_id,
                    "payload": data
                }
                await redis.publish("transcription_events", message)
        except Exception as e:
            logger.debug(f"Failed to publish distributed event: {e}")

    async def _broadcast_local(self, session_id: str, data: dict):
        """Internal helper to send to local monitors."""
        monitors = []
        async with self.lock:
            if session_id in self.monitors:
                monitors = list(self.monitors[session_id])
        
        print(f"DEBUG: Broadcast to {len(monitors)} monitors for session {session_id}")
        if not monitors:
            print(f"DEBUG: No monitors found for {session_id}. Known sessions: {list(self.monitors.keys())}")
            pass

        for ws in monitors:
            try:
                await ws.send_json(data)
            except Exception as e:
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

    # SOTA: Manager Registry for Inter-Service Communication
    # Allows Router to call methods on active TranscriptionManager instances
    def register_manager(self, session_id: str, manager_instance):
        self.active_managers[session_id] = manager_instance
        
    def unregister_manager(self, session_id: str):
        if session_id in self.active_managers:
            del self.active_managers[session_id]
            
    def get_manager(self, session_id: str):
        return self.active_managers.get(session_id)

manager = ConnectionManager()
