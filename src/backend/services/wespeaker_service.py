
import logging
import torch
import numpy as np
import wespeaker
from typing import Optional

# SOTA: Hardware Awareness
try:
    from utils.gpu_utils import get_best_gpu_indices
except ImportError:
    # Fallback to simple check
    def get_best_gpu_indices(): 
        return [0] if torch.cuda.is_available() else []

logger = logging.getLogger(__name__)

class WespeakerService:
    _instance = None
    
    def __init__(self):
        self.model = None
        # SOTA: Hardware Awareness
        # WeSpeaker usually runs fine on any decent GPU, but we pick the best one.
        self.priority_gpus = get_best_gpu_indices()
        self.device_index = self.priority_gpus[0] if self.priority_gpus else None
        self.device = torch.device(f'cuda:{self.device_index}' if self.device_index is not None else 'cpu')
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = WespeakerService()
        return cls._instance

    def load_model(self):
        """Carrega o motor ResNet34 na GPU prioritária."""
        if self.model is None:
            device_name = torch.cuda.get_device_name(self.device_index) if self.device_index is not None else "CPU"
            logger.info(f"🚀 Wespeaker SOTA: Loading ResNet34 on {device_name}...")
            try:
                # 'english' maps to the ResNet34 pre-trained on VoxCeleb
                self.model = wespeaker.load_model('english') 
                self.model.to(self.device)
                self.model.eval()
                logger.info("✅ Wespeaker engine started and ready.")
            except Exception as e:
                logger.error(f"❌ Failed to load Wespeaker: {e}")
                raise

    def extract_embedding(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """
        Extrai um embedding de 256 dimensões com Normalização L2.
        SOTA: Usa torch.inference_mode() para speedup em Ampere+ GPUs.
        """
        if self.model is None:
            self.load_model()
            
        try:
            # 1. Conversão ultra-rápida para Tensor
            # PCM 16-bit -> Float32
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            tensor = torch.from_numpy(audio_float32).unsqueeze(0).to(self.device)
            
            # 2. Inferência SOTA (inference_mode é mais rápido que no_grad e safer)
            with torch.inference_mode():
                embedding = self.model(tensor)
                embedding = embedding.cpu().numpy()[0]
            
            # 3. L2 Normalization (Crítico para Cosine Similarity)
            # Sem isto, a comparação de distância não funciona corretamente.
            norm = np.linalg.norm(embedding)
            if norm > 1e-6:
                embedding = embedding / norm
            
            return embedding
            
        except torch.cuda.OutOfMemoryError:
            logger.warning("⚠️ Wespeaker GPU OOM: Falling back to CPU for this embedding...")
            torch.cuda.empty_cache()
            return self._extract_on_cpu(audio_bytes)
        except Exception as e:
            logger.error(f"❌ Embedding Extraction Failed: {e}")
            return None

    def _extract_on_cpu(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """Fallback de emergência em CPU."""
        try:
            # Move o modelo temporariamente ou infelizmente temos de mover.
            # Mover modelo grande para CPU pode ser lento, mas é melhor que crashar.
            # Alternativa seria ter um small model em CPU.
            # Aqui movemos o atual.
            logger.info("Moving Wespeaker model to CPU for fallback...")
            self.model.to('cpu')
            
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            tensor = torch.from_numpy(audio_float32).unsqueeze(0) # on CPU
            
            with torch.inference_mode():
                embedding = self.model(tensor)
                embedding = embedding.numpy()[0]
                norm = np.linalg.norm(embedding)
                if norm > 1e-6:
                    embedding = embedding / norm
            
            # Tenta devolver à GPU se possível, ou mantém em CPU se estiver instável?
            # Vamos tentar devolver.
            try:
                self.model.to(self.device)
            except:
                pass # Mantém na CPU se GPU estiver mesmo cheia
                
            return embedding
        except Exception as e:
            logger.error(f"CPU Fallback also failed: {e}")
            return None

def get_wespeaker_service():
    return WespeakerService.get_instance()
