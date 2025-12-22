
import logging
import torch
import numpy as np
import wespeaker

logger = logging.getLogger(__name__)

class WespeakerService:
    _instance = None
    
    def __init__(self):
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = WespeakerService()
        return cls._instance
        
    def load_model(self):
        if self.model is None:
            logger.info(f"Loading Wespeaker ResNet34 on {self.device}...")
            try:
                # Load pre-trained model
                # 'resnet34_peaked' is a good balance of speed/accuracy
                self.model = wespeaker.load_model('english') 
                self.model.to(self.device)
                self.model.eval()
                logger.info("Wespeaker loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load Wespeaker: {e}")
                raise

    def extract_embedding(self, audio_bytes: bytes) -> np.ndarray:
        """
        Extracts a 256-dim embedding from audio bytes (16kHz PCM).
        """
        if self.model is None:
            self.load_model()
            
        try:
            # Convert bytes to float32 tensor
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            tensor = torch.from_numpy(audio_float32).unsqueeze(0).to(self.device)
            
            # Extract
            with torch.no_grad():
                embedding = self.model(tensor)
                embedding = embedding.cpu().numpy()[0]
            
            return embedding
            
        except Exception as e:
            logger.error(f"Embedding Extraction Failed: {e}")
            return None

def get_wespeaker_service():
    return WespeakerService.get_instance()
