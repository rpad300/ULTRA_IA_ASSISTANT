import sys
import torchaudio
from typing import NamedTuple

# Polyfill for torchaudio.AudioMetaData (removed/moved in 2.10+)
if not hasattr(torchaudio, "AudioMetaData"):
    print("[PATCH] Injecting torchaudio.AudioMetaData polyfill...")
    
    class AudioMetaData(NamedTuple):
        sample_rate: int
        num_frames: int
        num_channels: int
        bits_per_sample: int
        encoding: str
        
    torchaudio.AudioMetaData = AudioMetaData
    
    # Also inject into backend.common if it exists, as some libs might look there
    try:
        import torchaudio.backend.common
        if not hasattr(torchaudio.backend.common, "AudioMetaData"):
            torchaudio.backend.common.AudioMetaData = AudioMetaData
    except ImportError:
        pass # backend.common might be gone too
