
import asyncio
import time
import numpy as np
import uuid
from typing import Optional, List, Dict, AsyncGenerator
from dataclasses import dataclass, field
import logging

from services.silero_vad_service import get_vad_service

logger = logging.getLogger(__name__)

@dataclass
class VoiceBlob:
    id: str
    audio: bytes
    timestamp: float
    duration: float
    source_id: str
    is_final: bool
    sequence_id: int

class AudioPipeline:
    """
    SOTA Audio Pipeline: Source-Independent VAD & Segmentation.
    Handles:
    - VAD (Voice Activity Detection)
    - Buffering & Blob Extraction
    - Real-time Partial Feedback (Streaming)
    """
    def __init__(self, source_id: str):
        self.source_id = source_id
        self.vad_iterator = get_vad_service().create_vad_iterator()
        
        # State
        self.buffer = bytearray()
        self.raw_buffer = bytearray() # Buffer for 512-sample alignment
        self.is_speech_active = False
        self.silence_so_far = 0.0
        self.speech_start_time = 0.0
        
        # Partial Streaming Logic
        self.last_partial_time = 0.0
        self.PARTIAL_INTERVAL = 2.0 # Emit partial every 2s
        
        # SOTA: Blob Sequence for ordering
        self.sequence_counter = 0

    def process_chunk(self, audio_chunk: bytes) -> List[VoiceBlob]:
        """
        Process raw audio chunk (16kHz PCM).
        Buffers audio to ensure VAD receives exactly 512 samples (1024 bytes).
        Returns list of VoiceBlobs (Partial or Final) to be processed.
        """
        blobs = []
        
        # SOTA: Buffer incoming audio to meet VAD requirements (512 samples = 1024 bytes)
        self.raw_buffer.extend(audio_chunk)
        
        # Process in 512-sample chunks (32ms)
        CHUNK_SIZE_BYTES = 1024 # 512 samples * 2 bytes/sample
        
        while len(self.raw_buffer) >= CHUNK_SIZE_BYTES:
            # Extract 512-sample chunk
            vad_chunk = self.raw_buffer[:CHUNK_SIZE_BYTES]
            self.raw_buffer = self.raw_buffer[CHUNK_SIZE_BYTES:]
            
            is_speech = self._check_vad(vad_chunk)
            now = time.time()
            
            if is_speech:
                if not self.is_speech_active:
                    # Speech Start
                    self.is_speech_active = True
                    self.speech_start_time = now
                    self.last_partial_time = now
                    logger.debug(f"[{self.source_id}] Speech Started")
                
                self.buffer.extend(vad_chunk)
                self.silence_so_far = 0.0 # Reset silence counter
                
                # SOTA: Partial Emission (Streaming Feel)
                # Check accumulated buffer size (e.g. > 0.5s) to avoid spamming empty partials
                if (now - self.last_partial_time) > self.PARTIAL_INTERVAL:
                    if len(self.buffer) > 16000 * 0.5: # At least 0.5s
                        blobs.append(self._create_blob(is_final=False))
                        self.last_partial_time = now
                        
            else:
                # Silence Detected
                if self.is_speech_active:
                    self.buffer.extend(vad_chunk) # Include trailing silence
                    self.silence_so_far += (len(vad_chunk) / 2 / 16000) # Should be 0.032s
                    
                    # Silence Threshold (300ms)
                    if self.silence_so_far > 0.3:
                        # Speech End -> Finalize Blob
                        logger.debug(f"[{self.source_id}] Speech Ended (Silence > 300ms)")
                        
                        final_blob = self._create_blob(is_final=True)
                        if final_blob.duration > 0.5: # Filter extremely short glitches
                            blobs.append(final_blob)
                        
                        # Reset State
                        self.buffer = bytearray()
                        self.is_speech_active = False
                else:
                    # Still silence, discard chunk
                    pass
                
        return blobs

    def _check_vad(self, audio_chunk: bytes) -> bool:
        """Runs Silero VAD on chunk."""
        try:
             import torch
             # Convert to tensor
             audio_int16 = np.frombuffer(audio_chunk, dtype=np.int16)
             audio_float32 = audio_int16.astype(np.float32) / 32768.0
             tensor = torch.from_numpy(audio_float32)
             
             # Silero VAD expects implicit 512 samples for 16k
             speech_dict = self.vad_iterator(tensor, return_seconds=True)
             
             # We rely on the iterator's internal state mechanism via `triggered`
             # If `return_seconds=True`, it returns a dict only on transitions.
             # We just check if valid speech is currently active.
             
             # Note: Silero's `vad_iterator` object has attribute `triggered` (bool)
             return self.vad_iterator.triggered
             
        except Exception as e:
            # Fail open if VAD fails
            logger.error(f"VAD Error: {e}")
            return True

    def _create_blob(self, is_final: bool) -> VoiceBlob:
        self.sequence_counter += 1
        return VoiceBlob(
            id=str(uuid.uuid4()),
            audio=bytes(self.buffer),
            timestamp=self.speech_start_time,
            duration=len(self.buffer) / 2 / 16000,
            source_id=self.source_id,
            is_final=is_final,
            sequence_id=self.sequence_counter
        )
