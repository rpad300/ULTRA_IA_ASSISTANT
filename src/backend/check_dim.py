
import os
import sys

# Mock wespeaker execution if possible or just check documentation/code assumptions
# Since I cannot easily run heavy ML models in this environment without potential issues or long downloads, 
# I will check the `wespeaker_service.py` code I wrote and simple python check if package installed.
# But wait, looking at my `wespeaker_service.py` implementation:
# self.model = wespeaker.load_model('english')
# This enables the pretrained model.

# I will write a script to print the dimension.
try:
    import wespeaker
    import torch
    
    print("Loading Wespeaker...")
    model = wespeaker.load_model('english')
    # Create dummy audio
    dummy_wav = torch.randn(1, 16000) # 1 sec
    embedding = model(dummy_wav)
    print(f"Embedding Dimension: {embedding.shape}")
except ImportError:
    print("Wespeaker not installed.")
except Exception as e:
    print(f"Error: {e}")
