
import pytest
from unittest.mock import MagicMock, patch
import logging

# We need to import AudioPipeline. 
# Since it imports get_vad_service at top level, we might need to patch strictly.
# But AudioPipeline imports `get_vad_service` inside `__init__` or global?
# It's at global level: `from services.silero_vad_service import get_vad_service`

# We need to ensure we can import it even if dependencies are missing, 
# but we are in the same env so it should be fine.

from managers.audio_pipeline import AudioPipeline

class MockVADIterator:
    def __init__(self):
        self.triggered = False
    
    def __call__(self, tensor, return_seconds=False):
        # Emulate Silero behavior vaguely
        return None

@pytest.fixture
def mock_pipeline():
    with patch("managers.audio_pipeline.get_vad_service") as mock_service:
        mock_iterator = MockVADIterator()
        mock_service.return_value.create_vad_iterator.return_value = mock_iterator
        
        pipeline = AudioPipeline("test_source")
        # Spy on _check_vad to verify chunk sizes
        pipeline._check_vad_real = pipeline._check_vad
        pipeline._check_vad = MagicMock(side_effect=pipeline._check_vad_real)
        
        # Patch the real VAD iterator inside the instance too if needed
        pipeline.vad_iterator = mock_iterator
        
        return pipeline

def test_buffering_irregular_chunks(mock_pipeline):
    # 800 samples = 1600 bytes
    chunk_800_samples = b'\x00' * 1600 
    
    # 1. Process first 800 samples
    # Expected: 1 full 512-sample (1024 bytes) chunk processed. 
    # Remainder: 576 bytes buffered.
    mock_pipeline.process_chunk(chunk_800_samples)
    
    assert mock_pipeline._check_vad.call_count == 1
    # Check arg size
    call_args = mock_pipeline._check_vad.call_args[0][0]
    assert len(call_args) == 1024 # 512 samples
    assert len(mock_pipeline.raw_buffer) == 576
    
    # 2. Process another 800 samples
    # Total available: 576 + 1600 = 2176 bytes
    # Expected: 2 full chunks (1024 * 2 = 2048 bytes) processed.
    # Remainder: 128 bytes.
    mock_pipeline.process_chunk(chunk_800_samples)
    
    assert mock_pipeline._check_vad.call_count == 1 + 2 # Total 3 calls
    assert len(mock_pipeline.raw_buffer) == 128

def test_buffering_small_chunks(mock_pipeline):
    # 100 samples = 200 bytes
    chunk_100 = b'\x00' * 200
    
    # Send 5 chunks (1000 bytes) -> Not enough for 1024
    for _ in range(5):
        mock_pipeline.process_chunk(chunk_100)
    
    assert mock_pipeline._check_vad.call_count == 0
    assert len(mock_pipeline.raw_buffer) == 1000
    
    # Send 1 more chunk -> 1200 bytes
    mock_pipeline.process_chunk(chunk_100)
    
    assert mock_pipeline._check_vad.call_count == 1
    assert len(mock_pipeline.raw_buffer) == 1200 - 1024 # 176
