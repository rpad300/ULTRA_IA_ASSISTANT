
import sys
import torchaudio
import logging
from typing import NamedTuple

# SOTA: Configure logging locally since this might run before main logging setup
logger = logging.getLogger("patches.torchaudio_fix")

# Polyfill for torchaudio.AudioMetaData (removed/moved in 2.1.0+)
if not hasattr(torchaudio, "AudioMetaData"):
    logger.warning("🛠️ [SOTA Path] Patching torchaudio.AudioMetaData for compatibility...")
    
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
            logger.debug("✅ Also patched torchaudio.backend.common.AudioMetaData")
    except ImportError:
        pass # backend.common might be gone too
else:
    # Se a classe existir, o patch não faz nada (segurança total)
    # Use debug level to avoid noise in prod if not needed
    logger.debug("✅ torchaudio.AudioMetaData is present, no patch needed.")
