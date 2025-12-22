"""
Audio Stream Router - Receives audio from dedicated streaming service
Forwards audio to transcription endpoint for processing.
"""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from managers.streaming_manager import StreamingManager
from schemas.stream import StreamStatusMessage, ErrorMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["audio-stream"])

@router.websocket("/audio-stream")
async def audio_stream_websocket(
    websocket: WebSocket,
    language: Optional[str] = Query(None, description="Language code (pt, en, etc.). Auto-detect if not provided."),
    company_name: Optional[str] = Query(None, description="Company name for word boost"),
    project_name: Optional[str] = Query(None, description="Project name for word boost"),
    session_id: Optional[str] = Query(None, description="Supabase Session ID"),
    keyterms_prompt: Optional[str] = Query(None, description="Comma-separated keyterms") 
    # Note: Simplification for query param handling if needed, or rely on request body elsewhere.
    # The original router determined keyterms dynamically via AssemblyAIService. 
    # We should preserve that logic if it was dynamic, OR let the client pass it.
    # Original logic: 
    # if company_name or project_name: 
    #      keyterms = AssemblyAIService.get_smart_word_boost(...)
    
):
    """
    WebSocket endpoint for dedicated audio streaming service.
    Receives audio data (PCM16, 16kHz, mono) and forwards to AssemblyAI for transcription.
    """
    try:
        await websocket.accept()
        logger.info(f"Audio stream accepted from {websocket.client}")
    except Exception as e:
        logger.error(f"Failed to accept WebSocket: {e}")
        return

    # SOTA: Initialize Manager
    manager = StreamingManager(websocket, session_id=session_id)
    
    try:
        # 1. Resolve Keyterms (Business Logic remains in Router or delegation helper?) 
        # Better: Manager.initialize_resources() handles it? 
        # Refactoring to keep Router THIN -> Manager handles orchestration. 
        # But resolving keyterms is "Preparation". 
        
        # Let's resolve here to pass clean config to Manager? 
        # Or let manager do it. Manager doing it keeps Router cleaner.
        # But Manager needs dependnecies. 
        
        # Let's do it in Manager.initialize_resources as planned.
        # We need to pass the raw inputs.
        
        # NOTE: Pass keyterms_prompt list if we resolve it.
        # Re-using original logic:
        resolved_keyterms = []
        if company_name or project_name:
             try:
                 from services.assemblyai_service import get_assemblyai_service
                 svc = get_assemblyai_service()
                 resolved_keyterms = svc.get_smart_word_boost(company_name, project_name)
             except Exception as e:
                 logger.warning(f"Keyterm resolution failed: {e}")

        # 2. Initialize Pipeline
        await manager.initialize_resources(
            language=language, 
            company_name=company_name, 
            project_name=project_name, 
            keyterms_prompt=resolved_keyterms
        )

        # 3. Send Ready Status
        await websocket.send_json(
            StreamStatusMessage(
                status="connected",
                connection_id=manager.connection_id,
                model="universal-streaming-multi" if language else "universal-streaming-english"
            ).dict()
        )

        # 4. Run Pipeline
        await manager.run()

    except Exception as e:
        logger.error(f"Router Error: {e}", exc_info=True)
        try:
             await websocket.send_json(ErrorMessage(error=str(e)).dict())
             await websocket.close()
        except: pass
