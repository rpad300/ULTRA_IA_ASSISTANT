"""
AssemblyAI Service - State of the Art Implementation
Supports Realtime Transcription with speaker separation and Async Transcription with full Audio Intelligence.
"""

import assemblyai as aai
from typing import Optional, Dict, List, Callable, Any
from config import ASSEMBLYAI_API_KEY
from utils.circuit_breaker import get_circuit_breaker
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class AssemblyAIService:
    """
    Resilient AssemblyAI service with circuit breaker, smart configuration,
    and support for both realtime and async transcription with full Audio Intelligence.
    """
    
    def __init__(self):
        if not ASSEMBLYAI_API_KEY:
            raise ValueError("ASSEMBLYAI_API_KEY not set")
        aai.settings.api_key = ASSEMBLYAI_API_KEY
        
        # Create a client configured for Universal Streaming
        # Universal Streaming is the new default model (replaces deprecated model)
        # Note: The SDK should automatically use Universal Streaming, but we create a client
        # to ensure proper configuration
        try:
            # Use default client (Universal Streaming is now the default)
            self.client = aai.Client.get_default()
            logger.info("AssemblyAI Client initialized with Universal Streaming support")
        except Exception as e:
            logger.warning(f"Could not create custom client, using default: {e}")
            self.client = None
        
        # Circuit breaker for API calls
        self.circuit_breaker = get_circuit_breaker(
            "assemblyai",
            failure_threshold=5,
            success_timeout=60,
            time_window=60
        )
        
        # Connection pool tracking (for WebSocket connections)
        self.active_connections: Dict[str, aai.RealtimeTranscriber] = {}
        
        logger.info("AssemblyAIService initialized with circuit breaker")

    def get_realtime_transcriber(
        self,
        on_data: Callable,
        on_error: Callable,
        on_open: Callable,
        on_close: Callable,
        language: Optional[str] = None,
        word_boost: Optional[List[str]] = None,
        encoding: str = "pcm_s16le",
        sample_rate: int = 16000,
        end_utterance_silence_threshold: int = 500
    ) -> aai.RealtimeTranscriber:
        """
        Returns a RealtimeTranscriber instance with smart configuration.
        
        Args:
            on_data: Callback for transcript data
            on_error: Callback for errors
            on_open: Callback when session opens
            on_close: Callback when session closes
            language: Language code (e.g., 'pt', 'en'). Auto-detect if None.
            word_boost: List of words/phrases to boost (company names, jargon, etc.)
            encoding: Audio encoding (pcm_s16le, opus, etc.)
            sample_rate: Audio sample rate (default 16000)
            end_utterance_silence_threshold: Milliseconds of silence to end utterance
        
        Returns:
            Configured RealtimeTranscriber instance
        """
        # Build parameters for RealtimeTranscriber
        # The API accepts parameters directly in the constructor (no Config object)
        # NOTE: Universal Streaming is the new default model, but the SDK 0.48.1 may still
        # use the deprecated model by default. The Universal Streaming model should be
        # automatically used, but if you get "Model deprecated" errors, you may need to
        # wait for a newer SDK version or use the WebSocket API directly.
        transcriber_params = {
            "on_data": on_data,
            "on_error": on_error,
            "on_open": on_open,
            "on_close": on_close,
            "sample_rate": sample_rate,
        }
        
        # Use custom client if available (configured for Universal Streaming)
        if hasattr(self, 'client') and self.client:
            transcriber_params["client"] = self.client
        
        # Optional parameters
        if encoding:
            # Convert string encoding to AudioEncoding enum
            try:
                if hasattr(aai, 'AudioEncoding'):
                    # Map common encoding strings to enum values
                    encoding_map = {
                        "pcm_s16le": aai.AudioEncoding.pcm_s16le,
                        "pcm_mulaw": aai.AudioEncoding.pcm_mulaw,
                    }
                    if encoding in encoding_map:
                        transcriber_params["encoding"] = encoding_map[encoding]
                    else:
                        # Try to get enum value directly by attribute name
                        try:
                            encoding_enum = getattr(aai.AudioEncoding, encoding)
                            transcriber_params["encoding"] = encoding_enum
                        except AttributeError:
                            logger.warning(f"Unknown encoding '{encoding}', using default")
                else:
                    logger.warning("AudioEncoding enum not available, skipping encoding parameter")
            except Exception as e:
                logger.warning(f"Error setting encoding: {e}, using default")
        
        if end_utterance_silence_threshold:
            transcriber_params["end_utterance_silence_threshold"] = end_utterance_silence_threshold
        
        # Word boost for better recognition of domain-specific terms
        if word_boost:
            transcriber_params["word_boost"] = word_boost
        
        # Note: Language parameter is not directly supported in RealtimeTranscriber constructor
        # The service will auto-detect the language. For explicit language control,
        # you may need to use a different approach or check if it's supported via token/API.
        
        # IMPORTANT: Universal Streaming Model
        # According to AssemblyAI docs (https://www.assemblyai.com/docs/universal-streaming),
        # Universal Streaming is the new default model. However, SDK 0.48.1 may still use
        # the deprecated model by default.
        #
        # The SDK doesn't expose speech_model parameter directly, so we need to work around this.
        # Options:
        # 1. Wait for a newer SDK version that fully supports Universal Streaming
        # 2. Use the WebSocket API directly with speech_model parameter
        # 3. Create a temporary token (though this may not help if SDK doesn't support it)
        #
        # For now, we'll try creating a temporary token which might help the SDK
        # use Universal Streaming. If errors persist, we'll need to use WebSocket API directly.
        try:
            # Try to create a temporary token - this might help with Universal Streaming
            # The token is valid for 1 hour (3600 seconds)
            temp_token = aai.RealtimeTranscriber.create_temporary_token(expires_in=3600)
            transcriber_params["token"] = temp_token
            logger.info("Created temporary token for Universal Streaming")
        except Exception as e:
            logger.warning(f"Could not create temporary token: {e}. Using API key directly.")
            # Continue without token - SDK should use API key from settings
        
        # Create transcriber with parameters
        transcriber = aai.RealtimeTranscriber(**transcriber_params)
        
        return transcriber

    def register_connection(self, connection_id: str, transcriber: aai.RealtimeTranscriber):
        """Register an active WebSocket connection."""
        self.active_connections[connection_id] = transcriber
        logger.info(f"Registered AssemblyAI connection: {connection_id}")

    def unregister_connection(self, connection_id: str):
        """Unregister a WebSocket connection."""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"Unregistered AssemblyAI connection: {connection_id}")

    async def transcribe_file(
        self,
        file_path: str,
        speaker_labels: bool = True,
        language_detection: bool = True,
        sentiment_analysis: bool = True,
        entity_detection: bool = True,
        iab_categories: bool = True,
        word_boost: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Transcribes an audio file with full Audio Intelligence features.
        
        Args:
            file_path: Path to audio file (local or URL)
            speaker_labels: Enable speaker diarization (who said what)
            language_detection: Auto-detect language
            sentiment_analysis: Analyze sentiment per utterance
            entity_detection: Extract entities (people, places, etc.)
            iab_categories: Topic detection (IAB categories)
            word_boost: List of words/phrases to boost recognition
        
        Returns:
            Dictionary with transcript and intelligence data:
            {
                "text": str,
                "speakers": List[Dict],  # Speaker segments
                "sentiment": List[Dict],  # Sentiment per utterance
                "entities": List[Dict],   # Detected entities
                "topics": List[Dict],     # IAB categories
                "language_code": str,
                "confidence": float
            }
        """
        def _transcribe():
            """Inner function for circuit breaker protection."""
            config = aai.TranscriptionConfig(
                speaker_labels=speaker_labels,
                language_detection=language_detection,
                sentiment_analysis=sentiment_analysis,
                entity_detection=entity_detection,
                iab_categories=iab_categories,
            )
            
            if word_boost:
                config.word_boost = word_boost
            
            transcriber = aai.Transcriber(config=config)
            transcript = transcriber.transcribe(file_path)
            
            if transcript.error:
                raise Exception(f"AssemblyAI transcription error: {transcript.error}")
            
            # Build comprehensive result
            result = {
                "text": transcript.text or "",
                "language_code": transcript.language_code,
                "confidence": getattr(transcript, "confidence", 0.0),
                "speakers": [],
                "sentiment": [],
                "entities": [],
                "topics": []
            }
            
            # Extract speaker segments
            if speaker_labels and hasattr(transcript, "utterances"):
                for utterance in transcript.utterances:
                    result["speakers"].append({
                        "speaker": utterance.speaker,
                        "text": utterance.text,
                        "start": utterance.start,
                        "end": utterance.end,
                        "confidence": getattr(utterance, "confidence", 0.0)
                    })
            
            # Extract sentiment
            if sentiment_analysis and hasattr(transcript, "sentiment_analysis_results"):
                for sentiment in transcript.sentiment_analysis_results:
                    result["sentiment"].append({
                        "text": sentiment.text,
                        "sentiment": sentiment.sentiment,  # POSITIVE, NEGATIVE, NEUTRAL
                        "start": sentiment.start,
                        "end": sentiment.end,
                        "confidence": getattr(sentiment, "confidence", 0.0)
                    })
            
            # Extract entities
            if entity_detection and hasattr(transcript, "entities"):
                for entity in transcript.entities:
                    result["entities"].append({
                        "entity_type": entity.entity_type,
                        "text": entity.text,
                        "start": entity.start,
                        "end": entity.end
                    })
            
            # Extract topics (IAB categories)
            if iab_categories and hasattr(transcript, "iab_categories_result"):
                if hasattr(transcript.iab_categories_result, "summary"):
                    for topic in transcript.iab_categories_result.summary:
                        result["topics"].append({
                            "category": topic,
                            "relevance": getattr(topic, "relevance", 0.0)
                        })
            
            return result
        
        # Execute with circuit breaker protection
        try:
            result = self.circuit_breaker.call(_transcribe)
            logger.info(f"Successfully transcribed file: {file_path}")
            return result
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    def format_transcript_with_speakers(self, transcript_data: Dict[str, Any]) -> str:
        """
        Formats transcript data into readable text with speaker labels.
        
        Example output:
        [Speaker A]: Hello, how are you?
        [Speaker B]: I'm doing well, thanks!
        
        Args:
            transcript_data: Result from transcribe_file()
        
        Returns:
            Formatted transcript string
        """
        if transcript_data.get("speakers"):
            # Use speaker segments
            lines = []
            for segment in transcript_data["speakers"]:
                speaker_label = segment.get("speaker", "Unknown")
                text = segment.get("text", "")
                lines.append(f"[{speaker_label}]: {text}")
            return "\n".join(lines)
        else:
            # Fallback to plain text
            return transcript_data.get("text", "")

    def get_smart_word_boost(
        self,
        company_name: Optional[str] = None,
        project_name: Optional[str] = None,
        contact_names: Optional[List[str]] = None
    ) -> List[str]:
        """
        Builds a word boost list from context (company, project, contacts).
        This helps AssemblyAI recognize domain-specific jargon and names.
        
        Args:
            company_name: Company name
            project_name: Project name
            contact_names: List of contact/participant names
        
        Returns:
            List of words/phrases to boost
        """
        word_boost = []
        
        if company_name:
            word_boost.append(company_name)
            # Also add common variations
            if " " in company_name:
                word_boost.extend(company_name.split())
        
        if project_name:
            word_boost.append(project_name)
            if " " in project_name:
                word_boost.extend(project_name.split())
        
        if contact_names:
            word_boost.extend(contact_names)
            # Add first names separately
            for name in contact_names:
                if " " in name:
                    word_boost.append(name.split()[0])
        
        # Add common technical terms
        word_boost.extend(["Supabase", "Qdrant", "PostgreSQL", "FastAPI", "React"])
        
        return word_boost if word_boost else None


# Singleton
_assemblyai_service = None

def get_assemblyai_service():
    global _assemblyai_service
    if _assemblyai_service is None:
        _assemblyai_service = AssemblyAIService()
    return _assemblyai_service
