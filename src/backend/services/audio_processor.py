import numpy as np
import logging
import io
from typing import Tuple, Optional, List, Dict

# SOTA: Resilience against missing dependencies (e.g. Broken Torch DLLs)
try:
    import torch
    import torchaudio
    SOTA_AVAILABLE = True
except ImportError as e:
    # also catch OSError for DLL load failures
    SOTA_AVAILABLE = False
except OSError as e:
    SOTA_AVAILABLE = False

logger = logging.getLogger(__name__)
if not SOTA_AVAILABLE:
    logger.warning("SOTA Audio Processor: Torch/Torchaudio not available. Running in Degraded Mode.")

class AudioProcessor:
    """
    SOTA Audio Processor for Quality Control & Normalization.
    Acts as a 'Quality Gate' for the Audio Pipeline.
    
    Features:
    - Tensor-based processing (minimized CPU copies)
    - DC Offset Removal
    - Peak Normalization
    - Clipping Detection & AGC Suggestions
    - SNR Estimation
    - VAD Integration
    """
    def __init__(self):
        # We try to use CUDA if available for heavy operations, else CPU
        if SOTA_AVAILABLE:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = "cpu" # Dummy
            
    def process_raw_audio(self, audio_data: bytes, sample_rate: int = 16000, encoding: str = 'int16', channels: int = 1) -> Tuple[Optional[bytes], Dict[str, float]]:
        """
        Main pipeline: Decode -> Downmix -> Remove DC -> Resample -> Normalize -> Encode.
        Returns: (processed_bytes, metrics)
        """
        metrics = {
            "clipping_ratio": 0.0,
            "snr_db": 0.0,
            "rms": 0.0,
            "peak": 0.0
        }
        
        if not SOTA_AVAILABLE:
            # Pass-through in degraded mode
            # We assume input is already what we need or we just return it raw
            # Ideally we might want to minimally validate bytes, but for now just pass back.
            return audio_data, metrics

        try:
            # 1. Decode to Tensor (Float32)
            tensor = self._decode_to_tensor(audio_data, encoding)
            if tensor is None: return None, metrics
            
            # Check Clipping (Pre-processing)
            metrics["clipping_ratio"] = self._check_clipping(tensor)
            
            # 2. Downmix if needed (Stereo -> Mono)
            if channels > 1:
                tensor = self._downmix(tensor, channels)
                
            # 3. Remove DC Offset (High-pass filter equivalent)
            tensor = self._remove_dc_offset(tensor)
            
            # Calculate RMS before normalization for metrics
            metrics["rms"] = torch.sqrt(torch.mean(tensor**2)).item()
            metrics["peak"] = torch.max(torch.abs(tensor)).item()

            # 4. Resample if needed
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000).to(self.device)
                tensor = resampler(tensor)
                
            # 5. Peak Normalization (Target -3dB = ~0.707)
            # Only normalize if signal exists to avoid amplifying noise
            if metrics["rms"] > 0.001:
                tensor = self._normalize_audio(tensor, target_db=-3.0)
            
            # 6. Estimate SNR (crude estimation based on this chunk)
            # For SOTA SNR we usually need noise floor state, but we estimate here based on P95 vs P05
            metrics["snr_db"] = self._estimate_snr_chunk(tensor)

            # 7. Convert back to Int16 Bytes
            processed_bytes = self._encode_to_bytes(tensor)
            
            return processed_bytes, metrics
            
        except Exception as e:
            logger.error(f"SOTA Audio processing failed: {e}", exc_info=True)
            return None, metrics

    def _decode_to_tensor(self, data: bytes, encoding: str) -> Optional["torch.Tensor"]:
        if not SOTA_AVAILABLE: return None
        try:
            if encoding == 'float32':
                np_array = np.frombuffer(data, dtype=np.float32)
            elif encoding == 'int16':
                np_array = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                return None
            
            # Create tensor and move to device
            return torch.from_numpy(np_array).to(self.device)
        except Exception:
            return None

    def _downmix(self, tensor: "torch.Tensor", channels: int) -> "torch.Tensor":
        if not SOTA_AVAILABLE: return tensor
        # Assuming interleaved: [L, R, L, R...]
        # Flattened size N. 
        # Check alignment
        if tensor.numel() % channels != 0:
            return tensor # Callback to raw

        # Reshape to (Samples, Channels)
        reshaped = tensor.view(-1, channels)
        
        # SOTA: Just take Channel 0 (Left/Mono) often better than mixing noise
        # But (L+R)/2 is standard. Let's do Mean.
        return torch.mean(reshaped, dim=1)

    def _remove_dc_offset(self, tensor: "torch.Tensor") -> "torch.Tensor":
        """Subtracts mean (DC component)."""
        if not SOTA_AVAILABLE: return tensor
        return tensor - torch.mean(tensor)

    def _normalize_audio(self, tensor: "torch.Tensor", target_db: float = -3.0) -> "torch.Tensor":
        """Scales peak to target_db."""
        if not SOTA_AVAILABLE: return tensor
        peak = torch.max(torch.abs(tensor))
        if peak == 0: return tensor
        
        target_linear = 10 ** (target_db / 20)
        
        # If already quieter than target, we boost. 
        # But we limit boost to +20dB to avoid exploding noise.
        # If louder (clipping?), we reduce.
        
        gain = target_linear / peak
        gain = torch.clamp(gain, max=10.0) # Max 20dB boost
        
        return tensor * gain

    def _check_clipping(self, tensor: "torch.Tensor", threshold: float = 0.99) -> float:
        """Returns percentage of samples that are clipping."""
        if not SOTA_AVAILABLE: return 0.0
        num_clipped = torch.sum(torch.abs(tensor) >= threshold).item()
        return num_clipped / tensor.numel() if tensor.numel() > 0 else 0.0

    def _estimate_snr_chunk(self, tensor: "torch.Tensor") -> float:
        """
        Estimates SNR of a single chunk using percentile method.
        Signal = 95th percentile, Noise = 10th percentile.
        """
        if not SOTA_AVAILABLE: return 0.0
        if tensor.numel() < 100: return 0.0
        
        # Sorting is expensive on CPU, check if we want this every chunk
        # On GPU it's fast.
        sorted_abs, _ = torch.sort(torch.abs(tensor))
        
        p95_idx = int(0.95 * tensor.numel())
        p10_idx = int(0.10 * tensor.numel())
        
        signal_level = sorted_abs[p95_idx].item()
        noise_level = sorted_abs[p10_idx].item()
        
        if noise_level < 1e-9: noise_level = 1e-9
        if signal_level < 1e-9: return 0.0
        
        return 20 * np.log10(signal_level / noise_level)

    def _encode_to_bytes(self, tensor: "torch.Tensor") -> bytes:
        if not SOTA_AVAILABLE: return b""
        # Clamp, Scale, Cast
        clamped = torch.clamp(tensor, -1.0, 1.0)
        scaled = (clamped * 32767).short() # torch.short is int16
        # Move to CPU for bytes conversion
        return scaled.cpu().numpy().tobytes()

    def check_vad(self, audio_bytes: bytes, sample_rate: int = 16000) -> bool:
        """
        Checks if the audio chunk contains speech using Silero VAD.
        NOTE: This still assumes bytes input for compatibility with existing VAD service.
        """
        try:
            from services.silero_vad_service import get_vad_service
            vad_service = get_vad_service()
            return vad_service.is_speech(audio_bytes, sample_rate)
        except Exception:
            return True # Fail open

    def extract_speaker_embedding(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        try:
            from services.local_speaker_service import get_local_speaker_service
            svc = get_local_speaker_service()
            return svc.extract_embedding(audio_bytes)
        except Exception:
            return None
