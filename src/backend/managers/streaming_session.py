
import asyncio
import io
import wave
from collections import deque
from typing import Optional, List, Dict
from dataclasses import dataclass, field

@dataclass
class SessionMetrics:
    total_bytes: int = 0
    clipping_events: int = 0
    low_snr_events: int = 0
    total_frames: int = 0
    avg_rms: float = 0.0

class StreamingSession:
    """
    SOTA Session State.
    Holds State, Buffers, Queues, and Metrics.
    """
    def __init__(self, connection_id: str, session_id: Optional[str] = None, eagle_frame_size: int = 1024):
        self.connection_id = connection_id
        self.session_id = session_id
        
        # Async Queues for Producer-Consumer
        self.raw_audio_queue = asyncio.Queue()  # Input from WS
        self.processed_audio_queue = asyncio.Queue() # Output from AudioWorker -> Transcription/Bio
        
        # State
        self.is_active = True
        self.is_speaking = False # VAD State
        self.metrics = SessionMetrics()
        
        # Buffers
        # NOTE: wav_buffer removed (Memory Optimization). We write directly to disk in StreamingManager.
        self.eagle_buffer = bytearray() # For Biometrics
        self.transcription_buffer = bytearray() # For Transcription (if needed)

        # Pre-roll Buffer (Circular)
        # 200ms @ 16kHz 16bit = 32000 samples/sec * 2 bytes * 0.2 = ~6400 bytes
        self.pre_roll_buffer = deque(maxlen=10) # Store last 10 chunks
        

        # Dynamic Eagle Frame Size
        self.EAGLE_FRAME_SIZE = eagle_frame_size
        
        # SOTA Persistence: Components with Internal State
        # These are lazy-loaded or assigned by Manager
        self.audio_processor = None 
        self.vad_iterator = None
        
        # SOTA: Speaker Identity State
        self.speaker_history = deque(maxlen=5) # Temporal smoothing
        self.current_speaker = "Unknown"
        self.guest_map = {} # guest_id -> contact_name
        self.session_guests = {} # guest_id -> centroid (managed by LocalSpeakerService usually, but handy here?)
        
    def add_raw_audio(self, data: bytes) -> bool:
        """Producer: Enqueue raw bytes. Returns False if dropped (Backpressure)."""
        if self.is_active:
             # SOTA: Backpressure limit (e.g. 5x reasonable buffer ~ 5 seconds)
             if self.raw_audio_queue.qsize() > 250: # Assuming ~20ms chunks, 250 = 5s
                  return False # Drop packet to recover realtime
                  
             self.raw_audio_queue.put_nowait(data)
             self.metrics.total_bytes += len(data)
             return True
        return False

    async def get_raw_audio(self) -> Optional[bytes]:
        """Consumer: Dequeue raw bytes."""
        return await self.raw_audio_queue.get()

    def update_metrics(self, chunk_metrics: Dict[str, float]):
        self.metrics.total_frames += 1
        if chunk_metrics.get("clipping_ratio", 0) > 0.01:
            self.metrics.clipping_events += 1
        if chunk_metrics.get("snr_db", 20) < 10:
            self.metrics.low_snr_events += 1

    def buffer_for_eagle(self, pcm_chunk: bytes) -> List[bytes]:
        """Buffers audio and returns list of complete frames for Eagle processing."""
        self.eagle_buffer.extend(pcm_chunk)
        frames = []
        
        # Eagle expects fixed frame size (usually 512 samples/frame? Check specific model)
        # Assuming standard Picovoice Eagle frame length (varies, but usually need window)
        # We'll rely on the service to know, or pass standard chunks.
        # But typically we need to accumulate.
        # Let's assume we pass what we have if it's large enough, or chunks of N bytes.
        # For simplicity in this session manager, we slice by EAGLE_FRAME_SIZE (bytes)
        
        # 16kHz 16-bit = 2 bytes/sample. 
        # If Eagle wants 512 samples -> 1024 bytes.
        # If Eagle wants 1024 samples -> 2048 bytes.
        # We defined self.EAGLE_FRAME_SIZE = 1024 (lines 45).
        
        while len(self.eagle_buffer) >= self.EAGLE_FRAME_SIZE:
             # Extract frame
             frame = self.eagle_buffer[:self.EAGLE_FRAME_SIZE]
             frames.append(bytes(frame))
             # Shift buffer
             self.eagle_buffer = self.eagle_buffer[self.EAGLE_FRAME_SIZE:]
             
        return frames
