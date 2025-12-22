import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Dict, Any, List
from services.audio_service_client import AudioServiceClient
from schemas.audio import StartStreamingRequest, StartTestRequest, GainRequest, AudioServiceStatus, AudioDevice, SimpleResponse
from config import AUDIO_SERVICE_URL, ASSEMBLYAI_API_KEY

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audio-service", tags=["audio-service-control"])

# Injeção de Dependência para o Cliente
# Em produção, o client seria inicializado no main.py (lifespan)
async def get_audio_client(request: Request) -> AudioServiceClient:
    # Retrieve initialized client from app state
    if not hasattr(request.app.state, "audio_client"):
         raise HTTPException(status_code=503, detail="Audio System not initialized. Please checking server logs.")
    return request.app.state.audio_client

@router.get("/status", response_model=AudioServiceStatus)
async def get_service_status(request: Request, client: AudioServiceClient = Depends(get_audio_client)):
    # Correlation ID is auto-extracted by client from Context
    try:
        return await client.get_status()
    except Exception as e:
        _map_service_exceptions(e)

@router.get("/devices", response_model=List[AudioDevice])
async def get_devices(request: Request, client: AudioServiceClient = Depends(get_audio_client)):
    try:
        logger.info("Fetching devices from Audio Service...")
        return await client.get_devices()
    except Exception as e:
        _map_service_exceptions(e)

@router.post("/start", response_model=SimpleResponse)
async def start_streaming(
    request: StartStreamingRequest,
    http_request: Request,
    client: AudioServiceClient = Depends(get_audio_client)
):
    # SAFETY: Ensure Test Mode is disabled when starting a Real Session
    if hasattr(http_request.app.state, "is_audio_test_active"):
        http_request.app.state.is_audio_test_active = False
    # SOTA: Keyterm resolution managed by "Smart Client"
    try:
        return await client.start_streaming_smart(request, api_key=ASSEMBLYAI_API_KEY)
    except Exception as e:
        _map_service_exceptions(e)

@router.post("/stop", response_model=SimpleResponse)
async def stop_streaming_api(
    client: AudioServiceClient = Depends(get_audio_client)
):
    try:
        return await client.stop_streaming()
    except Exception as e:
        _map_service_exceptions(e)

@router.post("/test/start", response_model=SimpleResponse)
async def start_test_recording(
    request: StartTestRequest, 
    http_request: Request,
    client: AudioServiceClient = Depends(get_audio_client)
):
    """Start test with auto-recovery logic (Managed by Client)."""
    try:
        # Flag as Test Mode for Native Transcription Router
        http_request.app.state.is_audio_test_active = True
        
        # Pass the full model dump with forced Session ID
        payload = request.model_dump(by_alias=True)
        payload["sessionId"] = "TEST_SESSION"
        return await client.start_test_with_recovery(payload)
    except Exception as e:
        _map_service_exceptions(e)

@router.post("/gain", response_model=SimpleResponse)
async def set_gain(
    request: GainRequest,
    client: AudioServiceClient = Depends(get_audio_client)
):
    """Set digital gain for audio service."""
    try:
        return await client.set_gain(request.gain)
    except Exception as e:
        _map_service_exceptions(e)

@router.post("/test/stop", response_model=dict)
async def stop_test_recording(
    http_request: Request,
    client: AudioServiceClient = Depends(get_audio_client)
):
    # Reset Test Mode Flag
    if hasattr(http_request.app.state, "is_audio_test_active"):
        http_request.app.state.is_audio_test_active = False

    await client.force_reset()
    return {"status": "ok"}

# --- EXCEPTION MAPPING ---
def _map_service_exceptions(e: Exception):
    """
    Translates internal Client/Service exceptions to HTTP Status Codes.
    """
    from services.audio_service_client import DeviceBusyException, ServiceOfflineException
    
    if isinstance(e, DeviceBusyException):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Audio device is busy. Please close other applications using the mic."
        )
    if isinstance(e, ServiceOfflineException):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Audio Service is offline. Please restart the backend."
        )
    
    # Re-raise already mapped HTTP exceptions
    if isinstance(e, HTTPException):
        raise e
        
    # Generic Fallback
    logger.error(f"Unhandled Audio Error: {e}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Internal Audio Error"
    )
