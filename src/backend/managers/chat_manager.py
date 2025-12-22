import logging
import asyncio
import json
import uuid
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import Redis Service
try:
    from services.redis_service import get_redis_service
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis Service not found, defaulting to Local Chat Manager.")

class ChatConnectionManager:
    """
    SOTA Connection Manager for Distributed Chat.
    - Manages local WebSockets.
    - Syncs with Redis Pub/Sub (if available).
    - Heartbeat to kill zombie connections.
    """
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.instance_id = str(uuid.uuid4()) # Identify this backend instance
        self.redis = None
        self.pubsub_task = None

    async def initialize(self):
        """Called on startup to connect Redis and start listeners."""
        if REDIS_AVAILABLE:
            try:
                self.redis = await get_redis_service()
                if self.redis._client:
                    # Start Listener Task
                    self.pubsub_task = asyncio.create_task(self._redis_subscriber())
                    logger.info(f"ChatManager: Distributed Mode (Redis) - Instance {self.instance_id}")
                else:
                    logger.warning("ChatManager: Redis client not connected. Local Mode.")
            except Exception as e:
                logger.error(f"ChatManager: Redis init failed: {e}")

        # Start Heartbeat
        asyncio.create_task(self._heartbeat_loop())

    async def connect(self, websocket: WebSocket, thread_id: str):
        await websocket.accept()
        if thread_id not in self.active_connections:
            self.active_connections[thread_id] = set()
        self.active_connections[thread_id].add(websocket)
        logger.debug(f"WS Connected: {thread_id} | Total: {len(self.active_connections.get(thread_id, []))}")

    def disconnect(self, websocket: WebSocket, thread_id: str):
        if thread_id in self.active_connections:
            self.active_connections[thread_id].discard(websocket)
            if not self.active_connections[thread_id]:
                del self.active_connections[thread_id]
        logger.debug(f"WS Disconnected: {thread_id}")

    async def broadcast(self, thread_id: str, message: dict, exclude_self: bool = False):
        """
        Sends message to all clients in thread.
        If Redis is active, ALSO publishes to cluster (unless exclude_self is set, 
        which means we are processing a Redis message).
        """
        # 1. Send Local
        if thread_id in self.active_connections:
            dead_sockets = set()
            for ws in self.active_connections[thread_id]:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.warning(f"WS Send Error: {e}")
                    dead_sockets.add(ws)
            
            # Clean up
            for ws in dead_sockets:
                self.disconnect(ws, thread_id)

        # 2. Publish to Redis (if this is an ORIGINAL broadcast, not a re-broadcast)
        if not exclude_self and self.redis and self.redis._client:
            try:
                packet = {
                    "source_id": self.instance_id,
                    "thread_id": thread_id,
                    "message": message
                }
                await self.redis._client.publish("chat_events", json.dumps(packet))
            except Exception as e:
                logger.error(f"Redis Publish Error: {e}")

    async def send_personal(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except RuntimeError:
            pass # Socket likely closed

    async def _redis_subscriber(self):
        """Listens for messages from other instances."""
        if not self.redis or not self.redis._client: return
        
        pubsub = self.redis._client.pubsub()
        await pubsub.subscribe("chat_events")
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    sender_id = data.get("source_id")
                    
                    # Ignore own messages (already sent locally)
                    if sender_id == self.instance_id:
                        continue
                        
                    # Re-broadcast locally
                    thread_id = data.get("thread_id")
                    payload = data.get("message")
                    if thread_id and payload:
                        await self.broadcast(thread_id, payload, exclude_self=True)
                        
                except Exception as e:
                    logger.error(f"Redis Sub Error: {e}")

    async def _heartbeat_loop(self):
        """Periodically pings connections to remove Zombies."""
        while True:
            await asyncio.sleep(30) # 30s Heartbeat
            # Iterate over copy keys to avoid runtime error
            for thread_id in list(self.active_connections.keys()):
                websockets = self.active_connections.get(thread_id, set())
                dead = set()
                for ws in websockets:
                    try:
                        # Use Ping frame if supported, or generic "ping" message
                        # FastAPI/Starlette doesn't expose raw low-level ping easily/async?
                        # We'll just try to send a custom "ping" json
                        await ws.send_json({"type": "ping"})
                    except Exception:
                        dead.add(ws)
                
                for ws in dead:
                    self.disconnect(ws, thread_id)
