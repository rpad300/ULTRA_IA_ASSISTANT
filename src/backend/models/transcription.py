from pydantic import BaseModel, Field, ConfigDict, TypeAdapter, field_validator, model_validator, computed_field
from pydantic.alias_generators import to_pascal
from typing import Optional, List, Union, Annotated, Literal, Any
from enum import Enum
from datetime import datetime, timezone
import uuid
import base64

# --- ENUMS ---
class MessageType(str, Enum):
    AUDIO = "audio"
    CONFIG = "config"
    TRANSCRIPT = "transcript"
    VOICE_ID = "voice_identification"
    STATUS = "status"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"
    SESSION_UPDATE = "session_update"
    BEGIN = "Begin"
    TURN = "Turn"

# --- SUB-MODELS ---
class WordLevelDetail(BaseModel):
    """Detalhes por palavra para UI avançada (ex: realçar texto enquanto fala)"""
    word: str
    start: float = 0.0
    end: float = 0.0
    confidence: float = Field(default=1.0, ge=0, le=1)
    speaker: Optional[str] = None
    stability: float = Field(default=1.0, ge=0, le=1, description="Probabilidade da palavra ser final (0.0-1.0)")

    model_config = ConfigDict(alias_generator=to_pascal, populate_by_name=True)

# --- BASE ---
class BaseMessage(BaseModel):
    # SOTA: Alias Generator para interoperabilidade PascalCase (C#) <-> snake_case (Python)
    model_config = ConfigDict(
        alias_generator=to_pascal, 
        populate_by_name=True,
        extra='ignore' # Resiliente a novos campos enviados pelo C#
    )
    
    # We leave 'type' abstract here, concrete classes define the Literal
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

# --- IMPLEMENTATIONS ---

class AudioMessage(BaseMessage):
    type: Literal[MessageType.AUDIO] = MessageType.AUDIO
    
    # SOTA Constraints: Hardware Standard
    sample_rate: Literal[8000, 16000, 32000, 44100, 48000] = 48000
    channels: Literal[1, 2] = 2
    format: str = "float32"
    
    # Data is Optional for JSON/Base64 scenarios. 
    data: Optional[str] = None 

    @field_validator('format')
    @classmethod
    def normalize_format(cls, v: str) -> str:
        v = v.lower()
        mapping = {
            "pcm": "int16",
            "s16le": "int16",
            "f32le": "float32",
            "float": "float32"
        }
        return mapping.get(v, v)

    @model_validator(mode='after')
    def check_payload_integrity(self) -> 'AudioMessage':
        if self.data:
            # Basic base64 len check or similar could go here
            # Calculating exact durations from base64 len is reliable only if we know it's raw PCM
            pass
        return self

    @computed_field
    def duration_ms(self) -> float:
        """Calculates audio duration based on data length if available"""
        if not self.data:
            return 0.0
        try:
            # Heuristic: Base64 string length -> bytes length
            # len(b64) * 0.75 ~= bytes. 
            # bytes / (channels * bytes_per_sample * sample_rate) = seconds
            # Assuming float32 (4 bytes) or int16 (2 bytes) based on format
            bytes_len = len(self.data) * 0.75 
            bytes_per_sample = 4 if self.format == 'float32' else 2
            
            seconds = bytes_len / (self.channels * bytes_per_sample * self.sample_rate)
            return round(seconds * 1000, 2)
        except Exception:
            return 0.0

class ConfigMessage(BaseMessage):
    type: Literal[MessageType.CONFIG] = MessageType.CONFIG
    session_id: str
    company_id: str = "default"
    language: str = "pt-PT"
    service_preference: str = "whisper"
    vad_threshold: float = 0.5

class TranscriptMessage(BaseMessage):
    type: Literal[MessageType.TRANSCRIPT] = MessageType.TRANSCRIPT
    text: str = Field(..., min_length=1)
    is_final: bool
    speaker: str = "Speaker A"
    contact_id: Optional[str] = None
    trace_id: Optional[str] = None # None allowed if not identified yet, but UUID check encouraged if present
    confidence: float = Field(default=1.0, ge=0, le=1)
    words: List[WordLevelDetail] = Field(default_factory=list)

    @field_validator('trace_id')
    @classmethod
    def validate_trace_uuid(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                uuid.UUID(v)
            except ValueError:
                # Log or ignore? For strictness we could fail, but let's allow non-standard IDs for now 
                # if existing data requires it, otherwise strict:
                pass
        return v
        
    @model_validator(mode='after')
    def aggregate_confidence(self) -> 'TranscriptMessage':
        if self.words and self.confidence == 1.0:
            # If global confidence is default but we have word details, calculate average
            avg = sum(w.confidence for w in self.words) / len(self.words)
            self.confidence = round(avg, 4)
        return self

class VoiceIdMessage(BaseMessage):
    type: Literal[MessageType.VOICE_ID] = MessageType.VOICE_ID
    contact_id: Optional[str] = None
    contact_name: str
    is_auto_created: bool = False
    trace_id: str
    score: float = Field(ge=0, le=1)
    is_overlap: bool = False

class StatusMessage(BaseMessage):
    type: Literal[MessageType.STATUS] = MessageType.STATUS
    status: str
    message: str

class ErrorMessage(BaseMessage):
    type: Literal[MessageType.ERROR] = MessageType.ERROR
    code: str
    detail: str
    fatal: bool = False

class PingMessage(BaseMessage):
    type: Literal[MessageType.PING] = MessageType.PING

class PongMessage(BaseMessage):
    type: Literal[MessageType.PONG] = MessageType.PONG

class SessionUpdateMessage(BaseMessage):
    type: Literal["session_update"] = "session_update"
    status: Optional[str] = None
    session_id: str
    
class SpeakerAssignmentMessage(BaseMessage):
    """SOTA: Phase 4 Payload for Assignment"""
    type: Literal["speaker_assignment"] = "speaker_assignment"
    guest_id: str
    contact_id: str
    contact_name: str
    session_id: str

class SessionBeginsMessage(BaseMessage):
    type: Literal["Begin"] = "Begin"
    id: str
    expires_at: Optional[Any] = None # Normalized by validator
    model: Optional[str] = None

    @field_validator('expires_at')
    @classmethod
    def normalize_expires(cls, v: Any) -> Optional[datetime]:
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, (int, float)):
            try:
                # Assume standard unix timestamp (seconds). If too large, maybe millis?
                # C# usually sends seconds since epoch or ticks.
                # Heuristic: > 30000000000 implies millis? 
                # For now assume seconds as standard JWT/Unix.
                return datetime.fromtimestamp(v, tz=timezone.utc)
            except Exception:
                return None
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v)
            except:
                pass
        return None

class SessionTurnMessage(BaseMessage):
    type: Literal["Turn"] = "Turn"
    turn_order: Optional[int] = None
    turn_id: Optional[str] = None
    transcript: str
    confidence: float = 1.0
    speaker: Optional[str] = None
    language: Optional[str] = None
    trace_id: Optional[str] = None  # SOTA Fix: Required for Frontend UX (Clickable Speaker)
    # SOTA Fix: Capture AssemblyAI's end_of_turn logic
    end_of_turn: bool = Field(default=False, alias="end_of_turn")
    # SOTA Fix: Default to False to prevent stuttering on partials, and accept camelCase from C#
    is_final: bool = Field(default=False, alias="isFinal")

class UnknownMessage(BaseMessage):
    """Fallback for messages with unknown 'type'"""
    type: str # Catches any type string
    payload: Optional[Any] = None # Capture raw dict if possible? 
    # Actually BaseMessage handles extra fields, so they will live in __dict__ or extra if configured.
    # But for a specific model, we need to match it.
    
    # NOTE: Since this `type` is open (str), it must be placed LAST in the Union.
    # Pydantic will try Literals first.

# --- DISCRIMINATOR Union ---

class InsightMessage(BaseMessage):
    """
    SOTA: Agent 4 Intervention Payload (HUD Update).
    """
    type: Literal["insight"] = "insight"
    insight_type: Literal["conflict", "solution", "action"] 
    sequenceId: Optional[int] = None # SOTA: For Delta Sync / Ordering
    text: str
    confidence: float
    trace_id: Optional[str] = None
    source_link: Optional[str] = None
    related_fact: Optional[str] = None # For conflict comparison

class TelemetryMessage(BaseMessage):
    """
    SOTA: Real-time Audio Metrics for HUD Visualization.
    """
    type: Literal["telemetry"] = "telemetry"
    rms: float = 0.0 # Volume Level (0.0 - 1.0)
    db: float = -60.0 # Decibels
    is_clipping: bool = False
    snr: float = 0.0 # Signal-to-Noise Ratio (est)
    vad_prob: float = 0.0 # Probability of speech

# --- DISCRIMINATOR Union ---
NativeMessage = Union[
    AudioMessage, 
    ConfigMessage, 
    TranscriptMessage, 
    VoiceIdMessage, 
    StatusMessage, 
    ErrorMessage,
    PingMessage,
    PongMessage,
    SessionUpdateMessage,
    SessionBeginsMessage,
    SessionTurnMessage,
    SpeakerAssignmentMessage,
    InsightMessage,
    TelemetryMessage,
    UnknownMessage # Fallback
]

# Pre-instantiate adapter for performance (SOTA practice)
NativeMessageAdapter = TypeAdapter(NativeMessage)

