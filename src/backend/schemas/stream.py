from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class BaseStreamMessage(BaseModel):
    type: str

class StreamStatusMessage(BaseStreamMessage):
    type: Literal["status"] = "status"
    status: str
    connection_id: Optional[str] = None
    model: Optional[str] = None
    session_id: Optional[str] = None
    expires_at: Optional[str] = None
    health_metrics: Optional[dict] = None # For SOTA Diagnostic

class VoiceIdentificationMessage(BaseStreamMessage):
    type: Literal["voice_identification"] = "voice_identification"
    contact_id: str
    score: float
    is_auto_created: bool = False
    contact_name: Optional[str] = None

class TranscriptWord(BaseModel):
    start: int
    end: int
    text: str
    confidence: float
    speaker: Optional[str] = None

class TranscriptMessage(BaseStreamMessage):
    type: Literal["transcript"] = "transcript"
    transcript: str
    confidence: float
    is_final: bool
    is_formatted: bool = False
    words: List[TranscriptWord] = []

class ErrorMessage(BaseStreamMessage):
    type: Literal["error"] = "error"
    error: str

class SessionUpdateMessage(BaseStreamMessage):
    type: Literal["session_update"] = "session_update"
    status: str
    session_id: str

class SessionBeginsMessage(BaseStreamMessage):
    type: Literal["Begin"] = "Begin"
    id: str # Session ID
    expires_at: Optional[str] = None
    model: Optional[str] = None

class SessionTurnMessage(BaseStreamMessage):
    type: Literal["Turn"] = "Turn"
    turn_order: int
    turn_id: str
    transcript: str
    confidence: float
    speaker: Optional[str] = None
    language: Optional[str] = None
    is_final: bool = True
