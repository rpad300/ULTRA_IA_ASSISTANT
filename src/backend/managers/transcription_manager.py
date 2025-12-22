import asyncio
import numpy as np
import logging
import json
import uuid
import time
from datetime import datetime
from typing import Optional, Dict

from fastapi import WebSocket, WebSocketDisconnect
from managers.connection_manager import manager as global_connection_manager
from services.audio_processor import AudioProcessor
from models.transcription import MessageType, TranscriptMessage, VoiceIdMessage
# Services injection
from services.whisper_service import get_whisper_service
from services.local_speaker_service import get_local_speaker_service
from db.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

class TranscriptionManager:
    """
    Per-session manager for Transcription Flow.
    Orchestrates Producer-Consumer pattern for audio.
    """
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.audio_processor = AudioProcessor()
        
        # State
        self.queue = asyncio.Queue() # For audio chunks
        self.is_running = False
        self.tasks = []
        
        # Buffers
        self.whisper_buffer = bytearray()
        self.vad_silence_counter = 0
        
        # Speaker ID State
        self.session_unknowns = {} # guest_id -> embedding
        self.session_unknown_counts = {}
        self.guest_to_contact_map = {}
        self.current_speaker = "Unknown" # SOTA: Track active speaker from Audio Path
        
        # Identity Logic
        self.trace_id = str(uuid.uuid4())
        
        # Counters for stats
        self.chunks_received = 0
        self.chunks_processed = 0







    def _get_broadcast_id(self) -> str:
        """
        SOTA: Dynamically determine target session.
        If Test Mode is active, route everything to TEST_SESSION
        ignoring the actual C# connection ID.
        """
        if hasattr(self.websocket.app.state, "is_audio_test_active") and self.websocket.app.state.is_audio_test_active:
             return "TEST_SESSION"
        return self.session_id

    async def run(self):
        """Main entry point called by Router."""
        # Use a loop that handles both text (config) and bytes (audio)
        try:
            await global_connection_manager.connect(self.websocket, self.session_id)
            self.is_running = True
            
            self.consumer_task = asyncio.create_task(self.consumer_handler())
            self.tasks.append(self.consumer_task)
            
            while self.is_running:
                # Wait for next message
                # Accepts TEXT (JSON) or BYTES (Audio)
                message = await self.websocket.receive()
                
                if message["type"] == "websocket.disconnect":
                    raise WebSocketDisconnect(code=message.get("code", 1000))

                
                if "bytes" in message and message["bytes"]:
                    # FAST PATH: Binary Audio (C# Service typical behavior)
                    # Bypass JSON validation overhead for raw chunks
                    self.chunks_received += 1
                    await self.queue.put({"type": "audio", "data": message["bytes"]})
                    
                elif "text" in message and message["text"]:
                    # JSON Config/Control path
                    logger.debug(f"WS Received Text: {message['text'][:200]}...")
                    try:
                        raw_data = json.loads(message["text"])
                        # SOTA: Strict Validation with Discriminator
                        from pydantic import TypeAdapter
                        from models.transcription import (
                            NativeMessage, AudioMessage, ConfigMessage, PingMessage, 
                            TranscriptMessage, SessionTurnMessage, SessionUpdateMessage
                        )
                        
                        validated_msg = TypeAdapter(NativeMessage).validate_python(raw_data)
                        
                        if isinstance(validated_msg, PingMessage):
                            await self.websocket.send_json({"type": "pong"})
                            
                        elif isinstance(validated_msg, SessionUpdateMessage):
                            # SOTA: Dynamic Session Switching
                            logger.info(f"Received Session Update Request: {validated_msg}")
                            old_session = self.session_id
                            new_session = validated_msg.session_id
                            
                            if old_session != new_session:
                                await global_connection_manager.reassign_active_connection(
                                    old_session, new_session, self.websocket
                                )
                                self.session_id = new_session
                                logger.info(f"Session Switched Successfully: {old_session} -> {new_session}")

                        
                        elif isinstance(validated_msg, ConfigMessage):
                            # Handle config update
                            logger.info(f"Received Config: {validated_msg}")
                            # TODO: Apply config logic here
                            
                        elif isinstance(validated_msg, AudioMessage) and validated_msg.data:
                             # Handle Base64 audio if sent via JSON
                             # Decode and put in queue
                             import base64
                             audio_bytes = base64.b64decode(validated_msg.data)
                             self.chunks_received += 1
                             await self.queue.put({"type": "audio", "data": audio_bytes})
                        
                        elif isinstance(validated_msg, (TranscriptMessage, SessionTurnMessage)):
                             # Handle incoming transcripts from C# (e.g. from AssemblyAI)
                             
                             # SOTA Fix: Map AssemblyAI's 'end_of_turn' to 'is_final' for Frontend Consumption
                             # The frontend expects 'is_final' to commit the block.
                             if isinstance(validated_msg, SessionTurnMessage):
                                 if validated_msg.end_of_turn:
                                     validated_msg.is_final = True # SOTA Fix
                                 
                                 # SOTA: Inject Speaker ID from Audio Path if missing
                                 if not validated_msg.speaker and self.current_speaker != "Unknown":
                                      validated_msg.speaker = self.current_speaker
                             
                             # Broadcast immediately
                             payload = validated_msg.model_dump(by_alias=False, mode='json')
                             # If it's a Turn from AAI, we might want to ensure 'type' is compatible with frontend
                             target_session = self._get_broadcast_id()
                             logger.info(f"Broadcast Transcript to {target_session}: {payload}")
                             await global_connection_manager.broadcast_to_monitors(target_session, payload)
                        
                    except json.JSONDecodeError:
                        logger.warning("Received invalid JSON text")
                    except Exception as e:
                        logger.error(f"Validation Error: {e}")
                        # Optional: Send error back
                        await self.websocket.send_json({
                            "type": "error", 
                            "code": "VALIDATION_ERROR", 
                            "detail": str(e)
                        })
                        

                
        except WebSocketDisconnect:
            logger.info(f"WS Disconnect {self.session_id}")
        except Exception as e:
            logger.error(f"WS Error {self.session_id}: {e}", exc_info=True)
        finally:
            # Ensure disconnect is called
            if self.is_running:
                await self.disconnect()

    async def disconnect(self):
        """Cleanup resources."""
        if not self.is_running:
             return

        self.is_running = False
        logger.info(f"Disconnecting session {self.session_id}...")
        
        # Cancel tasks
        for task in self.tasks:
            task.cancel()
        
        # Remove from global manager
        await global_connection_manager.disconnect(self.session_id)
        
        # Flush buffer (optional behavior: transcribe remaining?)
        if len(self.whisper_buffer) > 0:
            logger.info(f"Session {self.session_id} ended with {len(self.whisper_buffer)} bytes in buffer.")


    async def handle_control_message(self, payload: dict):
        """Handle JSON config/commands."""
        msg_type = payload.get("type")
        if msg_type == "ping":
            await self.websocket.send_json({"type": "pong"})
        elif msg_type == "config":
            # Update session settings (language, etc)
            pass

    async def consumer_handler(self):
        """Process Audio from Queue."""
        loop = asyncio.get_running_loop()
        
        while self.is_running:
            try:
                # Wait for item
                item = await self.queue.get()
                
                if item["type"] == "audio":
                    raw_bytes = item["data"]
                    # DEBUG: Log audio reception
                    # logger.debug(f"Queue received audio: {len(raw_bytes)} bytes")
                    
                    # 1. Offload CPU processing (Resample/Decode)
                    # Run in Executor to avoid blocking event loop
                    # SOTA: process_raw_audio returns (bytes, metrics)
                    processed_result = await loop.run_in_executor(
                        None, 
                        lambda: self.audio_processor.process_raw_audio(
                            raw_bytes, 
                            sample_rate=16000, 
                            encoding='int16', 
                            channels=1
                        ) 
                    )
                    
                    processed_audio, metrics = processed_result
                    
                    if not processed_audio:
                        continue
                        
                    # 2. VAD Check (also CPU bound likely, but fast)
                    # We can run in executor too if needed
                    is_speech = await loop.run_in_executor(
                        None,
                        self.audio_processor.check_vad,
                        processed_audio
                    )
                    
                    if is_speech:
                        self.whisper_buffer.extend(processed_audio)
                        self.vad_silence_counter = 0
                        logger.debug(f"VAD: Speech detected. Buffer: {len(self.whisper_buffer)} bytes")
                    else:
                        self.vad_silence_counter += 1
                        
                    # 3. Transcription Trigger
                    # If buffer > 16k * 30s (too big) or VAD silence > threshold?
                    # Simpler strategy: Process every X seconds if we have data.
                    # Or Sliding window.
                    
                    # For SOTA latency, we often transcribe continuously or aggressive chunks.
                    # Current logic echoes native_transcription: Accumulate until silence or size limit.
                    
                    # SOTA Adjustment: Lower threshold to 0.5s for faster ID updates
                    # Was 16000 * 2 (2s)
                    if len(self.whisper_buffer) > 16000 * 0.5: 
                        # Trigger processing
                        chunk_to_process = bytes(self.whisper_buffer)
                        self.whisper_buffer.clear() # Clear immediately to prepare next
                        logger.info(f"Triggering Transcription/ID. Buffer size: {len(chunk_to_process)} bytes")
                        
                        # Fork processing task (Fire and Forget or Await?)
                        # Logic: We should process it. 
                        # Ideally await to not overload GPU queue, but here we want responsiveness.
                        asyncio.create_task(self.process_audio_chunk(chunk_to_process))
                        
                self.queue.task_done()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Consumer Error: {e}")

    async def process_audio_chunk(self, audio_bytes: bytes):
        """Run AI services on the chunk."""
        try:
            trace_id = str(uuid.uuid4())
            loop = asyncio.get_running_loop()
            
            # 1. Speaker ID (Parallel)
            speaker_name = "Unknown"
            contact_id = None
            
            # Retrieve Services
            svc_speaker = get_local_speaker_service()
            
            # Embedding (CPU bound)
            embedding = await loop.run_in_executor(
                None,
                self.audio_processor.extract_speaker_embedding,
                audio_bytes
            )
            
            if embedding is not None:
                # Identification (Vector Search - Fast RAM)
                # Note: recognize is likely CPU bound but fast.
                spk_id, score = svc_speaker.recognize(embedding, threshold=0.5)
                
                if spk_id:
                     speaker_name = svc_speaker.get_name(spk_id)
                     contact_id = spk_id
                else:
                     # Guest Handling (Buffer Mode)
                     speaker_name = self.handle_unknown_speaker(embedding)
                
                # Update State
                self.current_speaker = speaker_name
                
                # Notify Frontend of Voice ID
                vid_msg = VoiceIdMessage(
                    contact_id=contact_id or "guest",
                    contact_name=speaker_name,
                    is_auto_created=False,
                    trace_id=trace_id,
                    score=float(score) if score else 0.0
                )
                payload = vid_msg.model_dump(by_alias=False, mode='json')
                await self.websocket.send_json(payload)
                # Broadcast to Frontend
                await global_connection_manager.broadcast_to_monitors(self._get_broadcast_id(), payload)

            # 2. Transcription (GPU bound)
            # svc_whisper = get_whisper_service()
            # res = await svc_whisper.transcribe_audio(audio_bytes) 
            # (Assuming transcribe_audio exists and handles bytes)
            
            # Using specific logic for now to match interface
            # Note: We need to import get_whisper_service
            svc_whisper = get_whisper_service()
            res = await svc_whisper.transcribe_audio(audio_bytes, prompt=f"O orador é {speaker_name}")
            
            if res and res.get("text"):
                text = res["text"].strip()
                if text:
                    msg = TranscriptMessage(
                        text=text,
                        is_final=True,
                        speaker=speaker_name,
                        contact_id=contact_id,
                        trace_id=trace_id,
                        timestamp=datetime.now().timestamp()
                    )
                    payload = msg.model_dump(by_alias=False, mode='json')
                    await self.websocket.send_json(payload)
                    # Broadcast to Frontend
                    await global_connection_manager.broadcast_to_monitors(self._get_broadcast_id(), payload)

        except Exception as e:
            logger.error(f"Processing Chunk Failed: {e}")

    def handle_unknown_speaker(self, embedding) -> str:
        """Resolve Guest ID using embedding similarity."""
        # Simple Euclidean/Cosine check against session_unknowns
        best_guest = None
        best_dist = 1.0 # arbitrary threshold
        
        # This is strictly linear search, okay for small sessions
        for gid, emb in self.session_unknowns.items():
            dist = np.linalg.norm(embedding - emb)
            if dist < 0.6: # Threshold
                if dist < best_dist:
                    best_dist = dist
                    best_guest = gid
        
        if best_guest:
             logger.debug(f"[SpeakerID] Reusing Guest: {best_guest} (Dist: {best_dist:.2f})")
             return best_guest
        
        # Create new Guest
        new_id = f"Guest {len(self.session_unknowns) + 1}"
        self.session_unknowns[new_id] = embedding
        logger.info(f"[SpeakerID] New Guest Created: {new_id}")
        return new_id
