"""
Integration Tests for AssemblyAI Service
Tests real API calls to AssemblyAI (consumes API credits).

WARNING: Running these tests consumes AssemblyAI API credits.
Only run when you need to verify the integration works with real data.
"""

import pytest
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.assemblyai_service import get_assemblyai_service
from config import ASSEMBLYAI_API_KEY


@pytest.mark.skipif(
    not ASSEMBLYAI_API_KEY,
    reason="ASSEMBLYAI_API_KEY not set"
)
@pytest.mark.skipif(
    os.getenv("SKIP_LIVE_TESTS") == "true",
    reason="Live tests skipped via SKIP_LIVE_TESTS env var"
)
class TestAssemblyAILive:
    """Live integration tests with real AssemblyAI API."""
    
    @pytest.fixture
    def service(self):
        """Get AssemblyAI service instance."""
        return get_assemblyai_service()
    
    @pytest.fixture
    def sample_audio_file(self):
        """
        Sample audio file for testing.
        
        NOTE: You need to provide a real audio file for this test.
        Place a test audio file (e.g., sample.mp3) in tests/fixtures/
        or update this path to point to your test file.
        """
        test_file = Path(__file__).parent / "fixtures" / "sample.mp3"
        if not test_file.exists():
            pytest.skip(f"Test audio file not found: {test_file}")
        return str(test_file)
    
    def test_transcribe_file_basic(self, service, sample_audio_file):
        """Test basic file transcription."""
        result = service.transcribe_file(
            file_path=sample_audio_file,
            speaker_labels=False,
            language_detection=True,
            sentiment_analysis=False,
            entity_detection=False,
            iab_categories=False
        )
        
        assert "text" in result
        assert isinstance(result["text"], str)
        assert len(result["text"]) > 0
        print(f"\n✅ Basic transcription successful")
        print(f"   Text length: {len(result['text'])} characters")
        print(f"   Language: {result.get('language_code', 'unknown')}")
        print(f"   Confidence: {result.get('confidence', 0.0)}")
    
    def test_transcribe_file_with_speakers(self, service, sample_audio_file):
        """Test transcription with speaker diarization."""
        result = service.transcribe_file(
            file_path=sample_audio_file,
            speaker_labels=True,
            language_detection=True,
            sentiment_analysis=False,
            entity_detection=False,
            iab_categories=False
        )
        
        assert "text" in result
        assert "speakers" in result
        assert isinstance(result["speakers"], list)
        
        print(f"\n✅ Transcription with speakers successful")
        print(f"   Number of speaker segments: {len(result['speakers'])}")
        
        if result["speakers"]:
            print(f"   First speaker segment:")
            print(f"     Speaker: {result['speakers'][0].get('speaker')}")
            print(f"     Text: {result['speakers'][0].get('text', '')[:100]}...")
    
    def test_transcribe_file_full_intelligence(self, service, sample_audio_file):
        """Test transcription with all Audio Intelligence features."""
        result = service.transcribe_file(
            file_path=sample_audio_file,
            speaker_labels=True,
            language_detection=True,
            sentiment_analysis=True,
            entity_detection=True,
            iab_categories=True
        )
        
        assert "text" in result
        assert "speakers" in result
        assert "sentiment" in result
        assert "entities" in result
        assert "topics" in result
        
        print(f"\n✅ Full intelligence transcription successful")
        print(f"   Transcript length: {len(result['text'])} characters")
        print(f"   Speaker segments: {len(result['speakers'])}")
        print(f"   Sentiment segments: {len(result['sentiment'])}")
        print(f"   Entities detected: {len(result['entities'])}")
        print(f"   Topics detected: {len(result['topics'])}")
    
    def test_format_transcript_with_speakers(self, service, sample_audio_file):
        """Test transcript formatting with speaker labels."""
        result = service.transcribe_file(
            file_path=sample_audio_file,
            speaker_labels=True,
            language_detection=True
        )
        
        formatted = service.format_transcript_with_speakers(result)
        
        assert isinstance(formatted, str)
        assert len(formatted) > 0
        
        # Check that speaker labels are present
        if result.get("speakers"):
            assert "[" in formatted or "Speaker" in formatted
        
        print(f"\n✅ Transcript formatting successful")
        print(f"   Formatted length: {len(formatted)} characters")
        print(f"   First 200 chars: {formatted[:200]}...")
    
    def test_word_boost(self, service):
        """Test word boost generation."""
        word_boost = service.get_smart_word_boost(
            company_name="Acme Corp",
            project_name="Project Alpha",
            contact_names=["John Doe", "Jane Smith"]
        )
        
        assert word_boost is not None
        assert isinstance(word_boost, list)
        assert len(word_boost) > 0
        assert "Acme Corp" in word_boost
        assert "Project Alpha" in word_boost
        assert "John Doe" in word_boost
        assert "Jane Smith" in word_boost
        
        print(f"\n✅ Word boost generation successful")
        print(f"   Boost words: {word_boost}")
    
    def test_circuit_breaker(self, service):
        """Test that circuit breaker is initialized."""
        assert service.circuit_breaker is not None
        assert service.circuit_breaker.name == "assemblyai"
        print(f"\n✅ Circuit breaker initialized")


if __name__ == "__main__":
    """
    Run tests manually:
    
    python -m pytest src/backend/tests/test_assemblyai_live.py -v
    
    Or skip live tests:
    SKIP_LIVE_TESTS=true python -m pytest src/backend/tests/test_assemblyai_live.py -v
    """
    pytest.main([__file__, "-v"])





