
import logging
import os
import numpy as np
from faster_whisper import WhisperModel
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class WhisperService:
    def __init__(self, model_size="large-v3", device="cuda", compute_type="float16"):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.model = None
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.is_loading = False

    def load_model(self):
        if self.model is not None:
            return
        
        try:
            logger.info(f"Loading Whisper model: {self.model_size} on {self.device}...")
            self.is_loading = True
            # Load on GPU 1 (Index 1) if available, else 0. User has 3090 at index 1.
            # faster-whisper takes device_index argument.
            device_index = [0] 
            # Check availability or passed config. For now defaulting to 0 or 1 based on config?
            # Let's assume device="cuda" uses default. We can specify device_index=[1] for the 3090.
            
            self.model = WhisperModel(
                self.model_size, 
                device=self.device, 
                compute_type=self.compute_type, 
                device_index=0 # Default to index 0 (Primary GPU)
            )
            logger.info(f"Whisper model loaded successfully on device {self.device} (Index 0).")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
        finally:
            self.is_loading = False

    async def transcribe_audio(self, audio_data: bytes, prompt: str = None, language: str = None) -> dict:
        """
        Transcribe raw PCM audio bytes (16kHz, mono, s16le).
        Returns a dict compatible with the 'Turn' format or partial text.
        """
        if self.model is None:
            if not self.is_loading:
                # Lazy load
                await asyncio.get_running_loop().run_in_executor(self.executor, self.load_model)
            else:
                logger.warning("Whisper model is still loading...")
                return {}

        # Convert bytes to float32 numpy array
        # Input is 16-bit PCM
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0

        # Run transcription in thread
        segments, info = await asyncio.get_running_loop().run_in_executor(
            self.executor, 
            lambda: self.model.transcribe(
                audio_np, 
                beam_size=5, 
                language=language or "pt",
                initial_prompt=prompt, # Context Injection
                vad_filter=True, # Critical: Filter silence to prevent "Obrigado" hallucinations
                vad_parameters=dict(min_silence_duration_ms=400, min_speech_duration_ms=250),
                condition_on_previous_text=False, # Critical: Prevent loop/hallucination from context
                temperature=0.0, # Greedy decoding for accuracy
                word_timestamps=True, # Provide word timestamps for better segmentation
                compression_ratio_threshold=2.0, # Stricter filter for repetitive loops
                log_prob_threshold=-0.9, # Discard low confidence transcription
                no_speech_threshold=0.4 # Higher confidence required to consider it speech (default is 0.6, lower is stricter?)
            ) 
        )
        
        # Collect result
        # Note: model.transcribe returns a generator for segments. We need to iterate it.
        # This blocks until full transcription of the chunk.
        # For *real-time*, we usually need a streaming VAD + buffer approach (like Silero VAD).
        # Simply processing chunks might split words.
        # However, for a basic implementation, we can try.
        
        full_text = ""
        seg_list = list(segments) # This executes the inference
        
        segments_data = []
        for segment in seg_list:
            full_text += segment.text
            segments_data.append({
                "text": segment.text.strip(),
                "start": segment.start,
                "end": segment.end
            })
            
        if not full_text.strip():
            return {}

        return {
            "text": full_text.strip(),
            "segments": segments_data,
            "language": info.language,
            "probability": info.language_probability
        }

_whisper_service = None

def get_whisper_service():
    global _whisper_service
    if _whisper_service is None:
        _whisper_service = WhisperService()
    return _whisper_service
