import os
import logging
from typing import List, Dict, Union, Optional
import numpy as np
import torch

# Graceful Degradation for Biometric Dependencies
try:
    from pyannote.audio import Model, Inference
    PYANNOTE_AVAILABLE = True
except ImportError as e:
    # SOTA: Log as INFO to keep test output clean in dev environments without GPU/Audio libs
    logging.getLogger(__name__).info(f"Pyannote not available (ImportError): {e}")
    PYANNOTE_AVAILABLE = False
except OSError as e:
    logging.getLogger(__name__).debug(f"Pyannote/Torch DLL Load Failed (OSError): {e}")
    PYANNOTE_AVAILABLE = False
except Exception as e:
    logging.getLogger(__name__).debug(f"Pyannote failed to load: {e}")
    PYANNOTE_AVAILABLE = False

logger = logging.getLogger(__name__)

class PyannoteService:
    _instance = None
    
    def __init__(self):
        self.inference = None
        self.segmentation = None
        # Check cuda availability safely
        try:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        except Exception:
            self.device = 'cpu'
            
        if not PYANNOTE_AVAILABLE:
            logger.warning("Running in MOCK IDENTITY mode due to missing dependencies.")
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = PyannoteService()
        return cls._instance
        
    def warmup(self):
        """
        SOTA: Pre-load models to avoid cold-start latency.
        Called by main.py on startup.
        """
        if PYANNOTE_AVAILABLE:
            logger.info("Warming up Biometric Sensor (Loading Models)...")
            self.load_model()
            self.load_segmentation()
            # Run dummy inference to compile CUDA graphs?
            # Maybe too heay for startup, loading weights is enough for now.
            
    def load_model(self):
        if not PYANNOTE_AVAILABLE: 
            return

        if self.inference is None:
            logger.info(f"Loading Pyannote/Wespeaker (ResNet34) on {self.device}...")
            try:
                # SOTA: Fix for PyTorch 2.6+ weights_only=True default
                try:
                    import torch.torch_version
                    import pyannote.audio.core.task
                    torch.serialization.add_safe_globals([
                        torch.torch_version.TorchVersion,
                        pyannote.audio.core.task.Specifications,
                        pyannote.audio.core.task.Problem,
                        pyannote.audio.core.task.Resolution
                    ])
                except AttributeError:
                    pass
                except ImportError:
                    pass
                except Exception:
                    pass

                token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_TOKEN")
                model = Model.from_pretrained("pyannote/wespeaker-voxceleb-resnet34-LM", 
                                            use_auth_token=token)
                if model:
                    self.inference = Inference(model, window="whole")
                    self.inference.to(self.device)
                    logger.info("Pyannote/Wespeaker loaded successfully.")
                else:
                    logger.error("Failed to download Pyannote/Wespeaker model (returned None).")
            except Exception as e:
                logger.error(f"Failed to load Pyannote: {e}")
                # Don't raise, just stay None so we mock

    def load_segmentation(self):
        if not PYANNOTE_AVAILABLE: 
            return

        if self.segmentation is None:
            logger.info(f"Loading Pyannote/Segmentation on {self.device}...")
            try:
                # SOTA: Fix for PyTorch 2.6+ weights_only=True default
                # Allow TorchVersion global which is present in some checkpoints
                try:
                    import torch.torch_version
                    import pyannote.audio.core.task
                    torch.serialization.add_safe_globals([
                        torch.torch_version.TorchVersion,
                        pyannote.audio.core.task.Specifications,
                        pyannote.audio.core.task.Problem,
                        pyannote.audio.core.task.Resolution
                    ])
                except AttributeError:
                    # torch.serialization.add_safe_globals might not exist in older torch versions
                    pass
                except ImportError:
                    pass
                except Exception as e:
                    logger.warning(f"Could not add safe globals: {e}")

                token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_TOKEN")
                model = Model.from_pretrained("pyannote/segmentation-3.0", 
                                            use_auth_token=token)
                if model:
                    self.segmentation = model
                    self.segmentation.to(self.device)
                    logger.info("Pyannote/Segmentation loaded successfully.")
                else:
                    logger.error("Failed to download Pyannote/Segmentation model (returned None). Check HF_TOKEN.")
            except Exception as e:
                logger.error(f"Failed to load Segmentation: {e}")
                # Don't raise, graceful degradation logic in detect_overlap handles None

    def extract_embedding(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """
        Extracts embedding from audio bytes (16kHz PCM).
        Returns a 512-dim vector (zero-padded if model is 256).
        """
        # MOCK MODE
        if not PYANNOTE_AVAILABLE or (self.inference is None and not self._try_load_inference()):
            # Fallback to dummy embedding if model can't be loaded
            np.random.seed(len(audio_bytes) % 1000)
            mock_vec = np.random.rand(512).astype(np.float32)
            mock_vec = mock_vec / np.linalg.norm(mock_vec)
            return mock_vec

        try:
            if not audio_bytes or len(audio_bytes) < 3200: # Ignore < 0.1s
                return None

            if self.inference is None: self.load_model()
            
            # SOTA: Optimize GPU Memory
            # Use no_grad to prevent graph construction for inference
            with torch.no_grad():
                # Pyannote Inference expects a dict with waveform and sample_rate
                # Convert bytes to tensor
                audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
                audio_float32 = audio_int16.astype(np.float32) / 32768.0
                tensor = torch.from_numpy(audio_float32).unsqueeze(0).to(self.device)
                
                # SOTA: Safety check for empty tensor
                if tensor.numel() == 0:
                    return None

                # Extract
                # SOTA: Must provide sample_rate=16000 for raw tensors
                embedding = self.inference({"waveform": tensor, "sample_rate": 16000})
                
                # Check output type and convert to numpy vector
                # Inference usually returns SlidingWindowFeature (numpy wrapper)
                if embedding is None:
                    return None
                    
                # Handle SlidingWindowFeature or Check for tuple/empty
                if hasattr(embedding, '__len__') and len(embedding) == 0:
                    return None

                # Safe access to first element
                try:
                    vec = embedding[0]
                except (IndexError, TypeError):
                    logger.warning(f"Pyannote Inference returned unexpected format: {type(embedding)}")
                    return None

                if hasattr(vec, 'cpu'):
                    vec = vec.cpu()
                if hasattr(vec, 'numpy'):
                    vec = vec.numpy()
                
                # SOTA: Fix for IndexError: tuple index out of range
                # Ensure vec is a valid array with dimensions
                if vec is None:
                    return None
                    
                if np.ndim(vec) == 0:
                    logger.warning(f"Pyannote Inference returned 0-d array (scalar). Shape: {vec.shape}")
                    return None
                    
                if len(vec.shape) == 0: # Double check
                     logger.warning(f"Pyannote Inference returned 0-d shape: {vec.shape}")
                     return None

                # SOTA: Explicit L2 Normalization
                # Essential for Cosine Similarity based Biometrics
                norm = np.linalg.norm(vec)
                if norm > 1e-6:
                    vec = vec / norm
                
                # PAD TO 512 if necessary (DB is 512)
                # Safe access to shape[0] now that we checked ndim
                if vec.shape[0] == 256:
                    vec = np.pad(vec, (0, 256), 'constant')
                    
                # Occasional Cleanup? 
                # Doing empty_cache() on every call is slow. 
                # We assume standard gc handles it or use a specialized worker manager.
                # For now, no_grad() is the big win.
                return vec
            
        except Exception as e:
            # Use logger.exception to print full stack trace including line numbers
            logger.exception(f"Pyannote Embedding Failed: {e}")
            return None
            
    def _try_load_inference(self):
        try:
            self.load_model()
            return self.inference is not None
        except:
            return False

    def detect_overlap(self, audio_bytes: bytes) -> bool:
        """
        Detects if multiple speakers are speaking simultaneously.
        Returns True if overlap detected.
        """
        if not PYANNOTE_AVAILABLE:
            return False # Fail open (Assume valid)

        if self.segmentation is None:
            self.load_segmentation()
        
        if self.segmentation is None:
            return False 

        try:
            # Prepare tensor
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            tensor = torch.from_numpy(audio_float32).unsqueeze(0).to(self.device)
            
            # Run Segmentation
            segmentation = self.segmentation(tensor)
            scores = segmentation.data # (frames, speakers)
            
            active_speakers = np.sum(scores > 0.5, axis=1)
            overlap_frames = np.sum(active_speakers > 1)
            
            if overlap_frames > 5: # Tolerance: 5 frames (~80ms)
                return True
                
            return False
            
        except Exception as e:
            logger.warning(f"Overlap detection failed: {e}")
            return False

def get_biometric_service():
    return PyannoteService.get_instance()
