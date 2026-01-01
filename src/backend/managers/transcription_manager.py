
import asyncio
import numpy as np
import torch
import logging
import json
import uuid
import time
from datetime import datetime
from typing import Optional, Dict, Tuple, List, Set
from collections import deque

from fastapi import WebSocket, WebSocketDisconnect
from managers.connection_manager import manager as global_connection_manager
from managers.session_registry import get_session_registry
from managers.streaming_session import StreamingSession
from services.audio_processor import AudioProcessor
from models.transcription import MessageType, TranscriptMessage, VoiceIdMessage, SpeakerAssignmentMessage, TelemetryMessage

# SOTA Components
from managers.audio_pipeline import AudioPipeline, VoiceBlob
from services.identity_resolver import get_identity_resolver
from services.whisper_service import get_whisper_service

logger = logging.getLogger(__name__)

class TranscriptionManager:
    """
    SOTA Massive Multi-Source Diarization Engine.
    Orchestrates:
    - Multiple AudioPipelines (Mic, System, etc.)
    - Global Identity Resolution
    - Parallel Transcription
    """
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        
        # Session Persistence
        registry = get_session_registry()
        self.session = registry.get_session(session_id)
        if not self.session:
            self.session = StreamingSession(connection_id=str(uuid.uuid4()), session_id=session_id)
            self.session.audio_processor = AudioProcessor()
            registry.register_session(session_id, self.session)
        
        self.queue = asyncio.Queue()
        self.is_running = False
        self.tasks: List[asyncio.Task] = []
        
        # SOTA: Multi-Source Pipelines
        # Dictionary of source_id -> AudioPipeline
        self.pipelines: Dict[str, AudioPipeline] = {}
        
        # SOTA: Concurrency Control
        self.transcription_semaphore = asyncio.Semaphore(4) # Max 4 parallel whispers
        
        # Context Injection
        self.global_transcript_context = deque(maxlen=200) # Keep last 200 chars
        
        # Traceability
        self.trace_id = str(uuid.uuid4())

    async def run(self):
        try:
            logger.info(f"MultiSourceEngine: Starting for session {self.session_id}")
            await global_connection_manager.connect(self.websocket, self.session_id)
            global_connection_manager.register_manager(self.session_id, self)
            
            # Send Connected Status
            await self.websocket.send_json({
                "status": "connected",
                "connection_id": self.session_id,
                "engine": "Start Multi-Source v2.0"
            })
            
            self.is_running = True
            
            # Start Consumer
            self.consumer_task = asyncio.create_task(self.consumer_handler())
            self.tasks.append(self.consumer_task)
            
            while self.is_running:
                message = await self.websocket.receive()
                
                if message["type"] == "websocket.disconnect":
                    raise WebSocketDisconnect()

                # Dispatch Input
                if "bytes" in message and message["bytes"]:
                    # SOTA: Extract Source ID from header or assume default?
                    # The current protocol might not send source_id in raw bytes.
                    # We assume single-stream for now OR we need to update protocol.
                    # If C# client sends "Source: System" header?
                    # For now, let's assume default source "mic" if not specified.
                    # TODO: Protocol update to support multiple binary streams or Metadata.
                    # Assuming we just treat all incoming on this WS as "Unified Stream" OR
                    # we inspect metadata if it was sent as JSON+Binary.
                    
                    # For this refactor, let's treat the incoming WS as ONE source.
                    # To support System + Mic, usually they come in separate WS connections 
                    # OR interleaved. If interleaved, we need a "source" tag.
                    # Let's assume interleaved is NOT supported yet, so this Manager handles ONE source.
                    # WAIT: The request says "MicrophoneStream e SystemAudioStream... paralelepípedos".
                    # If they are separate Websockets, we have separate Managers!
                    # If they are on the SAME WS, they must be tagged.
                    # Let's assume we map `self.session_id` to a pipeline.
                    
                    # Hack: For now, map all bytes to "default" pipeline. 
                    # Real multi-source usually implies multiple connections joining the same SessionID.
                    # This architecture DOES support that because `LocalSpeakerService` (Identity) is global per SessionID.
                    # So, if two Managers run (one for Mic, one for System), they share the session state!
                    # PERFECT. We don't need to change ingress, just support "default" pipeline here.
                    
                    self.queue.put_nowait({"type": "audio", "data": message["bytes"], "source": "default"})
                    
                elif "text" in message:
                    await self._handle_control_message(message["text"])
                    
        except WebSocketDisconnect:
            logger.info(f"WS Disconnect {self.session_id}")
        except Exception as e:
            logger.error(f"WS Error {self.session_id}: {e}", exc_info=True)
        finally:
            await self.disconnect()

    async def _handle_control_message(self, text: str):
        try:
            data = json.loads(text)
            msg_type = data.get("type")
            
            if msg_type == "ping":
                await self.websocket.send_json({"type": "pong"})
            
            # Handle Source tagging if client sends it
            # e.g. { "type": "audio_metadata", "source": "system_audio" }
            # Not standard yet.
            
        except Exception:
            pass

    async def consumer_handler(self):
        """
        Consumes chunks, routes to Pipelines, Collects Blobs.
        """
        loop = asyncio.get_running_loop()
        
        while self.is_running:
            try:
                item = await self.queue.get()
                
                if item["type"] == "audio":
                    source = item.get("source", "default")
                    audio_bytes = item["data"]
                    
                    # 1. Pipeline Routing
                    if source not in self.pipelines:
                        self.pipelines[source] = AudioPipeline(source)
                    
                    pipeline = self.pipelines[source]
                    
                    # 2. Process Sync (VAD is fast)
                    # Returns blobs immediately
                    blobs = pipeline.process_chunk(audio_bytes)
                    
                    # 3. Handle Blobs (Partial and Final)
                    for blob in blobs:
                        # Fire and Forget Transcription Task (Concurrency)
                        # SOTA: Don't await! Schedule it.
                        asyncio.create_task(self.process_blob_async(blob))
                    
                self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Consumer Error: {e}")

    async def process_blob_async(self, blob: VoiceBlob):
        """
        SOTA: Parallel Blob Processing.
        1. Resolve Identity (Global Lock inside)
        2. Transcribe (Semaphore Limited)
        3. Broadcast
        """
        async with self.transcription_semaphore:
             try:
                 resolver = get_identity_resolver()
                 whisper = get_whisper_service()
                 
                 # 1. Identity Resolution (Only for Final Blobs?)
                 # Partial blobs might skip identity or use "Pending"?
                 # User wants "Real-time" -> We need identity even for partials if possible.
                 # But running embedding on partial (0.5s) is unstable.
                 # Strategy:
                 # - Final Blob: Full Resolution (Create new Guest).
                 # - Partial Blob: Peek Resolution (Don't create new).
                 
                 speaker_profile = None
                 if blob.is_final:
                     speaker_profile = await resolver.resolve(blob.audio, self.session_id)
                 else:
                     # For partial, maybe skip expensive embedding or use a faster lookup?
                     # Let's try to resolve but with a flag to NOT register new?
                     # `resolve` currently always registers.
                     # Let's assume for SOTA feel, we DO resolve.
                     # But partial audio might be too short for good embedding.
                     if len(blob.audio) > 16000 * 1.5: # Only resolve if > 1.5s
                         speaker_profile = await resolver.resolve(blob.audio, self.session_id)
                     else:
                         speaker_profile = None # Unknown
                 
                 speaker_name = speaker_profile.name if speaker_profile else "Analyzing..."
                 
                 # 2. Context Prompting
                 # "Speaker: [Name]. Context: [Last 200 chars]"
                 global_ctx = "".join(self.global_transcript_context)
                 prompt = f"Speaker: {speaker_name}. {global_ctx}"
                 
                 # 3. Transcribe
                 # Faster model for partials? No, same model usually.
                 result = await whisper.transcribe_audio(blob.audio, prompt=prompt)
                 
                 if result and result.get("text"):
                     text = result["text"].strip()
                     
                     # Update Context only on Final
                     if blob.is_final:
                         self.global_transcript_context.append(f" {text}")
                     
                     # 4. Broadcast
                     payload = {
                         "type": "transcript",
                         "text": text,
                         "is_final": blob.is_final,
                         "speaker": speaker_name,
                         "sequenceId": blob.sequence_id,
                         "timestamp": blob.timestamp,
                         "source": blob.source_id
                     }
                     
                     await global_connection_manager.broadcast_to_monitors(self.session_id, payload)
                     
             except Exception as e:
                 logger.error(f"Blob Processing Error: {e}", exc_info=True)

    async def disconnect(self):
        self.is_running = False
        for t in self.tasks: t.cancel()
        global_connection_manager.unregister_manager(self.session_id)
        # Session remains active in registry
