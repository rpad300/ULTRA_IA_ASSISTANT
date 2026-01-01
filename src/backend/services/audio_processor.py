
import numpy as np
import logging
import io
import time
from typing import Tuple, Optional, List, Dict

# SOTA: Resilience against missing dependencies
try:
    import torch
    import torchaudio
    from managers.gpu_manager import get_gpu_manager
    SOTA_AVAILABLE = True
except ImportError as e:
    SOTA_AVAILABLE = False

logger = logging.getLogger(__name__)

if not SOTA_AVAILABLE:
    logger.warning("SOTA Audio Processor: Torch/Torchaudio not available. Running in Degraded Mode.")

class AudioProcessor:
    """
    SOTA Audio Processor for Quality Control & Normalization.
    Features:
    - Stateful DeepFilterNet3 Denoising (No clicks)
    - GPU-accelerated Resampling
    - Hardware-aware device selection
    """
    def __init__(self):
        if SOTA_AVAILABLE:
            self.device = get_gpu_manager().get_best_device()
        else:
            self.device = "cpu"
            
        # SOTA: DeepFilterNet Init
        self.df_model = None
        self.df_state = None
        self.df_enhance = None
        
        if SOTA_AVAILABLE:
            try:
                # Import DF
                from df.enhance import enhance, init_df
                
                # Load default model (DeepFilterNet3)
                # SOTA: Check if we can pin Df to GPU
                self.df_model, self.df_state, _ = init_df(config_allow_defaults=True)
                self.df_enhance = enhance
                
                # Move model to device
                if hasattr(self.df_model, 'to'):
                    self.df_model.to(self.device)
                    logger.info(f"AudioProcessor: DFNet3 loaded on {self.device}")
                
            except ImportError:
                 logger.warning("DeepFilterNet not installed. Denoising disabled.")
            except Exception as e:
                 logger.warning(f"DeepFilterNet init failed: {e}")
            
    def process_raw_audio(self, audio_data: bytes, sample_rate: int = 16000, encoding: str = 'int16', channels: int = 1) -> Tuple[Optional[bytes], Dict[str, float]]:
        """
        Main pipeline: Decode -> Stream Denoise -> Normalize -> Encode.
        Returns: (processed_bytes, metrics)
        """
        from services.metrics_service import get_metrics_service, TimerContext
        
        start_time = time.time()
        metrics = {
            "clipping_ratio": 0.0,
            "snr_db": 0.0,
            "rms": 0.0,
            "peak": 0.0,
            "processing_ms": 0.0
        }
        
        if not SOTA_AVAILABLE:
            return audio_data, metrics

        try:
            # SOTA Observability: Track P95 Latency for Audio Processing
            with TimerContext(get_metrics_service(), "audio_processing_latency", {"device": str(self.device)}):
                # 1. Decode to Tensor (Float32)
                tensor = self._decode_to_tensor(audio_data, encoding)
                if tensor is None: return None, metrics
                
                # Check Clipping
                metrics["clipping_ratio"] = self._check_clipping(tensor)
                
                # 2. Downmix
                if channels > 1:
                    tensor = self._downmix(tensor, channels)
                
                # Track SR
                current_sr = sample_rate
                
                # SOTA: Denoise (Stateful)
                tensor, current_sr = self._denoise_audio_stream(tensor, current_sr)
                    
                # 3. Remove DC
                tensor = self._remove_dc_offset(tensor)
                
                # Metrics
                metrics["rms"] = torch.sqrt(torch.mean(tensor**2)).item()
                metrics["peak"] = torch.max(torch.abs(tensor)).item() # Update peak after denoise

                # 4. Resample to 16k if needed
                if current_sr != 16000:
                    resampler = torchaudio.transforms.Resample(orig_freq=current_sr, new_freq=16000).to(self.device)
                    tensor = resampler(tensor)
                    current_sr = 16000
                    
                # 5. Peak Normalization (Safe headroom)
                if metrics["rms"] > 0.001:
                    tensor = self._normalize_audio(tensor, target_db=-3.0)
                
                # 6. Estimate SNR
                metrics["snr_db"] = self._estimate_snr_chunk(tensor)

                # 7. Convert Back
                processed_bytes = self._encode_to_bytes(tensor)
            
            # Telemetry
            metrics["processing_ms"] = (time.time() - start_time) * 1000
            # Low noise logging
            if metrics["processing_ms"] > 100: # Only log slow chunks
                logger.debug(f"[AudioProcessor] Slow Chunk: {metrics['processing_ms']:.2f}ms")
            
            return processed_bytes, metrics
            
        except Exception as e:
            logger.error(f"SOTA Audio processing failed: {e}", exc_info=True)
            return audio_data, metrics # Fail safe: return original

    def _denoise_audio_stream(self, tensor: "torch.Tensor", current_sr: int) -> Tuple["torch.Tensor", int]:
        """
        Applies DeepFilterNet streaming denoising.
        Maintains internal self.df_state to avoid clicks.
        """
        if not SOTA_AVAILABLE or not self.df_model:
            return tensor, current_sr
            
        try:
            target_sr = 48000
            
            # 1. Upsample to 48k (DF Requirement)
            if current_sr != target_sr:
                # SOTA: Use torchaudio on GPU
                resampler = torchaudio.transforms.Resample(orig_freq=current_sr, new_freq=target_sr).to(self.device)
                input_tensor = resampler(tensor)
            else:
                input_tensor = tensor
                
            # Shape check: (1, 1, T)
            if input_tensor.ndim == 1:
                input_tensor = input_tensor.unsqueeze(0).unsqueeze(0)
            elif input_tensor.ndim == 2:
                input_tensor = input_tensor.unsqueeze(0)
                
            # 2. Run Enhancement with STATE
            # enhance() usually returns only enhanced audio, but updates state in-place if passed
            with torch.no_grad():
                # self.df_enhance(model, state, audio)
                enhanced_tensor = self.df_enhance(self.df_model, self.df_state, input_tensor)
                
            # Flatten
            enhanced_tensor = enhanced_tensor.squeeze(0).squeeze(0)
            
            # 3. Downsample to 16k
            # No need to resample here if the main loop does it, BUT we return logic says we update SR
            # If we return 48k here, main loop will resample to 16k. efficient.
            
            return enhanced_tensor, target_sr
            
        except Exception as e:
            logger.warning(f"DeepFilterNet failed: {e}")
            return tensor, current_sr

    def _decode_to_tensor(self, data: bytes, encoding: str) -> Optional["torch.Tensor"]:
        if not SOTA_AVAILABLE: return None
        try:
            if encoding == 'float32':
                np_array = np.frombuffer(data, dtype=np.float32)
            elif encoding == 'int16':
                np_array = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                return None
            return torch.from_numpy(np_array).to(self.device)
        except Exception:
            return None

    def _downmix(self, tensor: "torch.Tensor", channels: int) -> "torch.Tensor":
        if not SOTA_AVAILABLE: return tensor
        if tensor.numel() % channels != 0: return tensor
        reshaped = tensor.view(-1, channels)
        return torch.mean(reshaped, dim=1)

    def _remove_dc_offset(self, tensor: "torch.Tensor") -> "torch.Tensor":
        if not SOTA_AVAILABLE: return tensor
        return tensor - torch.mean(tensor)

    def _normalize_audio(self, tensor: "torch.Tensor", target_db: float = -3.0) -> "torch.Tensor":
        if not SOTA_AVAILABLE: return tensor
        peak = torch.max(torch.abs(tensor))
        if peak == 0: return tensor
        gain = (10 ** (target_db / 20)) / peak
        gain = torch.clamp(gain, max=10.0)
        return tensor * gain

    def _check_clipping(self, tensor: "torch.Tensor", threshold: float = 0.99) -> float:
        if not SOTA_AVAILABLE: return 0.0
        num_clipped = torch.sum(torch.abs(tensor) >= threshold).item()
        return num_clipped / tensor.numel() if tensor.numel() > 0 else 0.0

    def _estimate_snr_chunk(self, tensor: "torch.Tensor") -> float:
        if not SOTA_AVAILABLE: return 0.0
        if tensor.numel() < 100: return 0.0
        # GPU fast sort
        sorted_abs, _ = torch.sort(torch.abs(tensor))
        p95 = sorted_abs[int(0.95 * tensor.numel())].item()
        p10 = sorted_abs[int(0.10 * tensor.numel())].item()
        if p10 < 1e-9: p10 = 1e-9
        if p95 < 1e-9: return 0.0
        return 20 * np.log10(p95 / p10)

    def _encode_to_bytes(self, tensor: "torch.Tensor") -> bytes:
        if not SOTA_AVAILABLE: return b""
        clamped = torch.clamp(tensor, -1.0, 1.0)
        scaled = (clamped * 32767).short()
        return scaled.cpu().numpy().tobytes()

    def check_vad(self, audio_bytes: bytes, sample_rate: int = 16000) -> bool:
        # Legacy hook, preferred is VADService.is_speech_streaming
        try:
            from services.silero_vad_service import get_vad_service
            return get_vad_service().is_speech(audio_bytes, sample_rate)
        except Exception:
            return True

    def extract_speaker_embedding(self, audio_bytes: bytes) -> Optional["np.ndarray"]:
        """
        Extracts speaker embedding using the Biometric Service (Facade).
        Called by TranscriptionManager in an executor.
        """
        try:
            from services.pyannote_service import get_biometric_service
            bio_service = get_biometric_service()
            return bio_service.extract_embedding(audio_bytes)
        except Exception as e:
            logger.warning(f"Embedding extraction failed: {e}")
            return None
