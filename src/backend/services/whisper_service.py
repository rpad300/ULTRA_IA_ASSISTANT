
import logging
import os
import numpy as np
from faster_whisper import WhisperModel
import asyncio
from concurrent.futures import ThreadPoolExecutor
import torch
from managers.gpu_manager import get_gpu_manager

logger = logging.getLogger(__name__)

class WhisperService:
    def __init__(self, model_size="distil-large-v3", compute_type="float16"):
        """
        SOTA Config:
        - model_size: 'distil-large-v3'
        - compute_type: 'float16' 
        """
        self.model_size = model_size
        self.compute_type = compute_type
        self.model = None
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.is_loading = False
        self.gpu_manager = get_gpu_manager()

    def load_model(self):
        if self.model is not None:
            return
        
        try:
            best_device = self.gpu_manager.get_best_device()
            device_str = "cuda" if best_device.type == "cuda" else "cpu"
            device_index = best_device.index if best_device.index is not None else 0

            logger.info(f"Loading Whisper SOTA ({self.model_size}) on {device_str}:{device_index}...")
            self.is_loading = True
            
            # SOTA: Auto-switch compute type for CPU
            if device_str == "cpu" and self.compute_type == "float16":
                logger.warning("CPU detected: Switching compute_type from float16 to int8 for compatibility.")
                self.compute_type = "int8"

            self.model = WhisperModel(
                self.model_size, 
                device=device_str, 
                compute_type=self.compute_type, 
                device_index=device_index,
                local_files_only=False
            )
            logger.info(f"[OK] Whisper SOTA Ready: {self.model_size} loaded.")
        except Exception as e:
            logger.error(f"Failed to load Whisper on GPU: {e}")
            # Fallback
            if self.gpu_manager.get_best_device().type == "cuda":
                logger.warning("Falling back to CPU (int8)...")
                try:
                    self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
                except Exception as cpu_error:
                    logger.critical(f"Fatal: CPU Fallback failed: {cpu_error}")
            raise
        finally:
            self.is_loading = False

    async def transcribe_audio(self, audio_data: bytes, prompt: str = None, language: str = None) -> dict:
        """
        Transcribe raw PCM audio bytes (16kHz, mono, s16le).
        """
        if self.model is None:
            if not self.is_loading:
                await asyncio.get_running_loop().run_in_executor(self.executor, self.load_model)
            else:
                while self.is_loading:
                    await asyncio.sleep(0.1)
                if self.model is None: return {}
        
        try:
            # Zero-copy buffer interface if possible, else copy
            audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0

            # Run transcription in thread
            def _run_transcribe():
                segments, info = self.model.transcribe(
                    audio_np, 
                    beam_size=1, # SOTA Latency
                    language=language or "pt",
                    initial_prompt=prompt,
                    vad_filter=True, 
                    vad_parameters=dict(min_silence_duration_ms=400, min_speech_duration_ms=250),
                    condition_on_previous_text=False, # Avoid loop lock
                    temperature=0.0,
                    repetition_penalty=1.1
                )
                return list(segments), info

            start_time = asyncio.get_running_loop().time()
            segments_list, info = await asyncio.get_running_loop().run_in_executor(
                self.executor, _run_transcribe
            )
            duration = (asyncio.get_running_loop().time() - start_time) * 1000
            
            # Telemetry
            if segments_list:
                logger.debug(f"[WhisperService] Transcribed {len(audio_data)/32000:.2f}s in {duration:.2f}ms. Prompt: {prompt[:30]}...")

            full_text = "".join([s.text for s in segments_list]).strip()
            
            return {
                "text": full_text,
                "language": info.language,
                "probability": info.language_probability
            }
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return {}

_whisper_service = None

def get_whisper_service():
    global _whisper_service
    if _whisper_service is None:
        _whisper_service = WhisperService()
    return _whisper_service
