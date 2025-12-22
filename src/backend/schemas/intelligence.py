from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class IntelligenceInsight(BaseModel):
    """Generic insight structure for patterns and signals."""
    id: str
    type: str = Field(..., description="Type of insight (e.g., 'blocker', 'recurring_topic')")
    description: str
    confidence: float = Field(..., ge=0, le=100)
    related_meetings: List[str] = Field(default_factory=list, description="IDs or titles of related meetings")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MeetingPatternsResponse(BaseModel):
    """Response model for cross-meeting analytics."""
    company_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    patterns: List[IntelligenceInsight]
    total_analyzed: int = 0

class FlowPrediction(BaseModel):
    id: str
    predicted_topic: str
    reason: str
    confidence: int = Field(..., ge=0, le=100)
    estimated_duration_seconds: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ParticipantInsight(BaseModel):
    name: str
    key_opinions: List[str] = []
    likely_questions: List[str] = []
    communication_style: Optional[str] = None

class PreparationDocument(BaseModel):
    """AI-generated meeting briefing."""
    session_id: str
    context_summary: str
    likely_topics: List[str]
    suggested_questions: List[str]
    risks: List[str]
    participant_insights: List[ParticipantInsight]
    generated_at: datetime = Field(default_factory=datetime.utcnow)
