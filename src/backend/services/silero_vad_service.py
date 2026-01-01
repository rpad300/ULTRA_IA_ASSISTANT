
import logging
import torch
import numpy as np
import os
from managers.gpu_manager import get_gpu_manager

logger = logging.getLogger(__name__)

class SileroVADService:
    _instance = None
    
    def __init__(self):
        self.model = None
        self.utils = None
        # VAD is lightweight, CPU is preferred to reduce GPU context switching for small chunks
        # unless we are batching massive amounts. For streaming (~512 samples), CPU is usually lower latency.
        self.device = torch.device('cpu') 
        
        # We can also check GPUManager if we *really* want VAD on GPU
        # self.device = get_gpu_manager().get_best_device() 
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SileroVADService()
        return cls._instance
        
    def load_model(self):
        if self.model is not None:
            return

        logger.info(f"Loading Silero VAD v5 on {self.device}...")
        try:
            # Load Silero VAD from Torch Hub
            self.model, self.utils = torch.hub.load(
                repo_or_dir='snakers4/silero-vad',
                model='silero_vad',
                force_reload=False,
                trust_repo=True, 
                onnx=False
            )
            self.model.to(self.device)
            # JIT optimization
            self.model.eval()
            
            logger.info("Silero VAD v5 loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Silero VAD: {e}")
            raise


    def create_vad_iterator(self, threshold: float = None, sampling_rate: int = 16000, min_silence_duration_ms: int = None):
        """
        Factory method for Per-Session VAD State.
        Supports Configuration Injection for Tuning.
        """
        if self.model is None:
            self.load_model()
        
        # Env Overrides (SOTA Tuning)
        if threshold is None:
            threshold = float(os.getenv("VAD_THRESHOLD", "0.5"))
        if min_silence_duration_ms is None:
             min_silence_duration_ms = int(os.getenv("VAD_MIN_SILENCE_MS", "100"))

        (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks) = self.utils
        
        logger.info(f"Creating VAD Iterator: Threshold={threshold}, MinSilence={min_silence_duration_ms}ms")
        
        # Note: VADIterator constructor args might vary by version. 
        # Standard: model, threshold, sampling_rate, min_silence_duration_ms, speech_pad_ms
        return VADIterator(self.model, sampling_rate=sampling_rate, threshold=threshold, min_silence_duration_ms=min_silence_duration_ms)

    def is_speech(self, audio_chunk: bytes, sample_rate: int = 16000) -> bool:
        """
        Stateless check (Legacy).
        """
        if self.model is None:
            self.load_model()
            
        try:
            audio_int16 = np.frombuffer(audio_chunk, dtype=np.int16)
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            tensor = torch.from_numpy(audio_float32).to(self.device)
            
            with torch.no_grad():
                speech_prob = self.model(tensor, sample_rate).item()
            return speech_prob > 0.5
        except Exception as e:
            logger.error(f"VAD Error: {e}")
            return True

def get_vad_service():
    return SileroVADService.get_instance()
