from pydantic import BaseModel, Field
from enum import Enum
from typing import List, Optional

class IntentType(str, Enum):
    FACT_ASSERTION = "FACT_ASSERTION"
    DOUBT_QUESTION = "DOUBT_QUESTION"
    ACTION_ITEM = "ACTION_ITEM"
    OTHER = "OTHER"

class IntentClassification(BaseModel):
    intent: IntentType
    confidence: float
    reasoning: str

class FactCheckResult(BaseModel):
    is_conflicting: bool
    confidence: float
    original_fact: Optional[str] = None
    new_fact: Optional[str] = None
    source_id: Optional[str] = None
    source_content: Optional[str] = None

class SolutionResult(BaseModel):
    answer: str
    confidence: float
    sources: List[str]
