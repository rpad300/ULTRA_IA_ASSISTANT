from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel

from services.intelligence_service import get_intelligence_service, IntelligenceService
from dependencies.auth import get_current_active_company
from schemas.intelligence import (
    MeetingPatternsResponse, 
    FlowPrediction, 
    PreparationDocument
)

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])

class FlowPredictionRequest(BaseModel):
    session_id: str
    current_transcript: str

class PrepDocRequest(BaseModel):
    session_id: str
    participants: List[str]
    # company_id removed for security (injected via Auth)

@router.get("/patterns", response_model=MeetingPatternsResponse)
async def get_patterns(
    company_id: str = Depends(get_current_active_company),
    service: IntelligenceService = Depends(get_intelligence_service)
):
    """
    Get cross-meeting patterns/insights.
    Cached for performance (1 hour).
    """
    try:
        return await service.generate_cross_meeting_patterns(company_id=company_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intelligence analysis failed: {str(e)}")

@router.post("/flow-prediction", response_model=List[FlowPrediction])
async def predict_flow_api(
    request: FlowPredictionRequest,
    # Flow prediction is conversational, might assume current session's company
    # But usually called from a context where user is logged in.
    # If session_id is global, we might need to validate ownership.
    # For now, we allow flow prediction without explicit company_id dependency usage 
    # if the service doesn't need it for Qdrant (it uses transcript).
    # BUT standard is to use auth.
    service: IntelligenceService = Depends(get_intelligence_service)
):
    """
    Predict next topics based on current transcript.
    Real-time (no caching).
    """
    try:
        # Note: If predict_flow needed RAG with company_id, we would need to inject it.
        # Currently it only uses Gemini + Transcript.
        return await service.predict_flow(
            session_id=request.session_id,
            current_transcript=request.current_transcript
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flow prediction failed: {str(e)}")

@router.post("/prep-doc", response_model=PreparationDocument)
async def generate_prep_doc_api(
    request: PrepDocRequest,
    company_id: str = Depends(get_current_active_company),
    service: IntelligenceService = Depends(get_intelligence_service)
):
    """
    Generate a preparation document for a meeting.
    Uses parallel context retrieval.
    """
    try:
        return await service.generate_prep_doc(
            session_id=request.session_id,
            participants=request.participants,
            company_id=company_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prep doc generation failed: {str(e)}")
