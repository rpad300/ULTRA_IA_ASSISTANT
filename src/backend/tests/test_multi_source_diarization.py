
import pytest
import asyncio
import uuid
import numpy as np
from unittest.mock import MagicMock, AsyncMock, patch
from managers.transcription_manager import TranscriptionManager
from managers.connection_manager import ConnectionManager
from services.local_speaker_service import LocalSpeakerService

# Mocks
@pytest.fixture
def mock_websocket():
    ws = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive = AsyncMock()
    # Mock app state for broadcast_id check
    ws.app = MagicMock() 
    ws.app.state = MagicMock()
    ws.app.state.is_audio_test_active = False
    return ws

@pytest.fixture
def mock_managers():
    with patch("managers.transcription_manager.global_connection_manager", new_callable=AsyncMock) as mock_conn, \
         patch("managers.transcription_manager.get_session_registry") as mock_registry:
        
        # Session Registry Mock
        mock_session = MagicMock()
        mock_session.audio_processor = MagicMock()
        mock_session.audio_processor.process_raw_audio = lambda x: x # Pass through
        mock_session.vad_iterator = MagicMock()
        
        mock_registry.return_value.get_session.return_value = mock_session
        
        yield mock_conn, mock_registry, mock_session

@pytest.fixture
def mock_services():
    with patch("managers.transcription_manager.AudioPipeline") as MockAudioPipeline, \
         patch("managers.transcription_manager.get_identity_resolver") as mock_resolver_getter, \
         patch("managers.transcription_manager.get_whisper_service") as mock_whisper_getter:
        
        # AudioPipeline Logic (We want to test the Manager, not the Pipeline deep internals, 
        # BUT the Manager depends on Pipeline output. 
        # Better: let's use REAL AudioPipeline but with MOCKED VAD.)
        pass
        
    # We will use real TranscriptionManager logic, but patch the factories it calls internally.
    # Note: AudioPipeline is imported in TranscriptionManager.
    # To test integration, we should probably mock the "get_vad_service" used by AudioPipeline.

@pytest.mark.asyncio
async def test_multi_source_flow(mock_websocket, mock_managers):
    """
    Verifies:
    1. Manager accepts audio from 'mic' and 'system'
    2. Routes to generic 'default' pipeline (as per current impl) or distinct if enhanced.
    3. Emits 'transcript' messages.
    """
    mock_conn, mock_registry, mock_session = mock_managers
    
    # Setup
    session_id = str(uuid.uuid4())
    manager = TranscriptionManager(mock_websocket, session_id)
    
    # Mock Components
    manager.pipelines = {} # Reset
    
    # Mock VAD Iterator in Session (Used by Manager's _check_vad_streaming for telemetry, 
    # but the AudioPipeline has its OWN VAD).
    # Wait, the refactored Manager uses `AudioPipeline` which has `get_vad_service()`.
    
    with patch("managers.audio_pipeline.get_vad_service") as mock_vad_service, \
         patch("services.identity_resolver.get_biometric_service") as mock_bio_service, \
         patch("services.local_speaker_service.get_local_speaker_service") as mock_local_speaker_getter, \
         patch("managers.transcription_manager.get_whisper_service") as mock_whisper_getter:
        
        # 1. Mock VAD to trigger Speech
        mock_vad_iterator = MagicMock()
        # Trigger on first calls, then silence
        mock_vad_iterator.side_effect = [True, True, True, False, False, False] * 10
        mock_vad_iterator.triggered = True # Simplify
        mock_vad_service.return_value.create_vad_iterator.return_value = mock_vad_iterator
        
        # 2. Mock Whisper
        mock_whisper_svc = AsyncMock()
        mock_whisper_svc.transcribe_audio.return_value = {"text": "Hello World"}
        mock_whisper_getter.return_value = mock_whisper_svc
        
        # 3. Mock Identity
        mock_resolver = AsyncMock() # Verification of Identity Resolver logic is usually separate unit test
        # Here we mock the result of `get_identity_resolver().resolve()`
        pass

    # We need to patch `get_identity_resolver` in `transcription_manager` scope
    with patch("managers.transcription_manager.get_identity_resolver") as mock_resolver_getter:
        mock_resolver_inst = AsyncMock()
        mock_resolver_inst.resolve.return_value = MagicMock(name="Guest 1", id="guest_1", is_known=False)
        mock_resolver_getter.return_value = mock_resolver_inst
        
        # Run Manager (in background)
        # We need to feed the queue manually or mock websocket receive
        
        # Start Manager
        run_task = asyncio.create_task(manager.run())
        await asyncio.sleep(0.1) # Let it start
        
        # Feed Audio (Source: Mic)
        # 16kHz audio chunk (0.1s) = 3200 bytes
        chunk = b'\x00' * 3200 
        
        # Simulate WS Audio Message
        await manager.queue.put({"type": "audio", "data": chunk, "source": "mic"})
        await manager.queue.put({"type": "audio", "data": chunk, "source": "mic"})
        
        # Feed Audio (Source: System)
        await manager.queue.put({"type": "audio", "data": chunk, "source": "system"})
        
        # Wait for processing
        await asyncio.sleep(2.0)
        
        # Assertions
        # 1. Check Pipelines created
        assert "mic" in manager.pipelines
        assert "system" in manager.pipelines
        
        # 2. Check Whisper Called (Async)
        # The VAD Mock needs to trigger "Speech End" to emit Final Blob for Whisper to be called in Final mode.
        # Or "Speech Start" + 2s for Partial.
        # We sent very little audio (0.3s total per source).
        # We probably need to send MORE audio to trigger the threshold.
        
        # Send 3 seconds of audio to trigger partial
        for _ in range(30): # 30 * 0.1s = 3s
            await manager.queue.put({"type": "audio", "data": chunk, "source": "mic"})
            
        await asyncio.sleep(1.0)
        
        # Verify Whisper called
        assert mock_whisper_svc.transcribe_audio.called
        
        # Verify Broadcast
        mock_conn.broadcast_to_monitors.assert_called()
        call_args = mock_conn.broadcast_to_monitors.call_args[0]
        assert call_args[0] == session_id
        payload = call_args[1]
        assert payload["type"] == "transcript"
        assert payload["text"] == "Hello World"
        
        # Cleanup
        manager.is_running = False
        await asyncio.sleep(0.1)
        run_task.cancel()

