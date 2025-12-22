
import asyncio
import json
import logging
from unittest.mock import MagicMock, AsyncMock, patch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VERIFY_STREAM")

async def verify_streaming_manager():
    """
    Verifies the SOTA Audio Stream Refactor.
    Focuses on Manager Logic: Buffering, Queueing, Eagle Chunker.
    """
    print("\n--- Verifying Streaming Manager ---")
    
    try:
        from managers.streaming_manager import StreamingManager
        from managers.streaming_session import StreamingSession
        from schemas.stream import StreamStatusMessage
        
        # Mock dependencies
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        mock_ws.receive = AsyncMock() # We won't run full loop here, just unit test methods
        
        manager = StreamingManager(mock_ws, session_id="test_session")
        
        # 1. Verify Session Initialization
        print("[CHECK] Session Initialization...")
        assert manager.session is not None
        assert isinstance(manager.session, StreamingSession)
        print(" -> PASSED")
        
        # 2. Verify Audio Buffering (Rolling Flush)
        print("[CHECK] Audio Buffering...")
        # Add small chunk
        kb_chunk = b'\x00' * 1024
        manager.session.write_to_wav_buffer(kb_chunk)
        
        # Verify it's in buffer
        assert len(manager.session.wav_buffer.getvalue()) == 1024
        
        # Test Flush
        chunk_read = manager.session.get_wav_chunk()
        assert len(chunk_read) == 1024
        assert len(manager.session.wav_buffer.getvalue()) == 0
        print(" -> PASSED")
        
        # 3. Verify Eagle Chunker
        print("[CHECK] Eagle Chunker...")
        # Eagle wants 1024 bytes (EAGLE_FRAME_SIZE default in session)
        
        # Case A: Partial Frame (500 bytes)
        partial = b'\x00' * 500
        frames = manager.session.buffer_for_eagle(partial)
        assert len(frames) == 0
        assert len(manager.session.eagle_buffer) == 500
        
        # Case B: Complete Frame (add rest)
        rest = b'\x00' * 524 # 500 + 524 = 1024
        frames = manager.session.buffer_for_eagle(rest)
        assert len(frames) == 1
        assert len(frames[0]) == 1024
        assert len(manager.session.eagle_buffer) == 0
        
        # Case C: Multiple Frames (2048 bytes)
        double = b'\x00' * 2048
        frames = manager.session.buffer_for_eagle(double)
        assert len(frames) == 2
        print(" -> PASSED")
        
        print("\n--- Verification Complete: SOTA Manager Logic Valid ---")
        
    except ImportError as e:
        print(f"\n[FAIL] Import Error: {e}")
    except AssertionError as e:
        print(f"\n[FAIL] Assertion Error: {e}")
    except Exception as e:
        print(f"\n[FAIL] Unknown Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_streaming_manager())
