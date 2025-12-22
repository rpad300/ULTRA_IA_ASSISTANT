
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
    def __init__(self, connection_id: str, session_id: Optional[str] = None):
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
        self.wav_buffer = io.BytesIO() # For file writing
        self.eagle_buffer = bytearray() # For Biometrics
        self.transcription_buffer = bytearray() # For Transcription (if needed)

        # Pre-roll Buffer (Circular)
        # 200ms @ 16kHz 16bit = 32000 samples/sec * 2 bytes * 0.2 = ~6400 bytes
        self.pre_roll_buffer = deque(maxlen=10) # Store last 10 chunks
        
        # Constants
        self.EAGLE_FRAME_SIZE = 1024 # Depends on PV Eagle model
        
    def add_raw_audio(self, data: bytes):
        """Producer: Enqueue raw bytes."""
        if self.is_active:
            self.raw_audio_queue.put_nowait(data)
            self.metrics.total_bytes += len(data)

    async def get_raw_audio(self) -> Optional[bytes]:
        """Consumer: Dequeue raw bytes."""
        return await self.raw_audio_queue.get()

    def update_metrics(self, chunk_metrics: Dict[str, float]):
        self.metrics.total_frames += 1
        if chunk_metrics.get("clipping_ratio", 0) > 0.01:
            self.metrics.clipping_events += 1
        if chunk_metrics.get("snr_db", 20) < 10:
            self.metrics.low_snr_events += 1

