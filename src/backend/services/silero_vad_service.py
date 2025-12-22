
import logging
import torch
import numpy as np
import os

logger = logging.getLogger(__name__)

class SileroVADService:
    _instance = None
    
    def __init__(self):
        self.model = None
        self.utils = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SileroVADService()
        return cls._instance
        
    def load_model(self):
        if self.model is None:
            logger.info(f"Loading Silero VAD v5 on {self.device}...")
            try:
                # Load Silero VAD from Torch Hub
                self.model, self.utils = torch.hub.load(
                    repo_or_dir='snakers4/silero-vad',
                    model='silero_vad',
                    force_reload=False,
                    trust_repo=True, 
                    onnx=False # Use Torch for now, ONNX requires separate runtime
                )
                self.model.to(self.device)
                logger.info("Silero VAD loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load Silero VAD: {e}")
                raise

    def is_speech(self, audio_chunk: bytes, sample_rate: int = 16000) -> bool:
        """
        Determines if the given audio chunk (bytes, PCM 16-bit) contains speech.
        Silero VAD only supports 8000 and 16000 Hz.
        If other sample rates are provided, we will fail open (return True) to avoid crashing.
        """
        if self.model is None:
            self.load_model()
            
        # Supported sample rates
        if sample_rate not in [8000, 16000]:
            # logger.warning(f"Silero VAD received unsupported sample rate: {sample_rate}. Defaulting to speech=True.")
            return True

        try:
            # Convert bytes to tensor
            # Assume 16-bit PCM integer
            audio_int16 = np.frombuffer(audio_chunk, dtype=np.int16)
            
            # Normalize to float32 [-1, 1]
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            tensor = torch.from_numpy(audio_float32).to(self.device)
            
            # Use Silero Utils for robust VAD (handles arbitrary lengths)
            # utils = (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks)
            if self.utils:
                get_speech_timestamps = self.utils[0]
                speech_timestamps = get_speech_timestamps(tensor, self.model, sampling_rate=sample_rate)
                return len(speech_timestamps) > 0
            else:
                # Fallback if utils not loaded (shouldn't happen)
                if tensor.ndim == 1:
                    tensor = tensor.unsqueeze(0)
                with torch.no_grad():
                    speech_prob = self.model(tensor, sample_rate).item()
                return speech_prob > 0.5
            
        except Exception as e:
            logger.error(f"VAD Error: {e}")
            return True # Fail open (assume speech) to not lose audio

def get_vad_service():
    return SileroVADService.get_instance()
