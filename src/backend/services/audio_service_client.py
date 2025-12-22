import httpx
import logging
import asyncio
from typing import Any, Dict, Optional, List, Type, TypeVar, Union
from datetime import datetime, timedelta
from fastapi import HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager

from schemas.audio import AudioServiceStatus, AudioDevice, SimpleResponse

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# --- CUSTOM EXCEPTIONS ---
class AudioServiceException(Exception):
    """Base exception for Audio Service errors."""
    def __init__(self, message: str, code: str = "AUDIO_SERVICE_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)

class ServiceOfflineException(AudioServiceException):
    def __init__(self):
        super().__init__("Audio Service is unreachable.", "SERVICE_OFFLINE")

class DeviceBusyException(AudioServiceException):
    def __init__(self):
        super().__init__("Audio device is already capturing.", "DEVICE_BUSY")

# --- CIRCUIT BREAKER ---
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout: int = 10):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.state = "CLOSED" # CLOSED, OPEN, HALF-OPEN
        self.last_failure_time: Optional[datetime] = None

    def record_failure(self):
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.state = "OPEN"
            self.last_failure_time = datetime.utcnow()
            logger.warning(f"Circuit Breaker OPENED after {self.failures} failures.")

    def record_success(self):
        if self.state != "CLOSED":
            logger.info("Circuit Breaker CLOSED (Recovered).")
        self.failures = 0
        self.state = "CLOSED"

    def is_open(self) -> bool:
        if self.state == "CLOSED":
            return False
        
        if self.state == "OPEN":
            if datetime.utcnow() - self.last_failure_time > timedelta(seconds=self.recovery_timeout):
                self.state = "HALF-OPEN"
                logger.info("Circuit Breaker HALF-OPEN (Testing connection).")
                return False # Allow one request through
            return True
        
        return False # HALF-OPEN allows requests attempt

# --- CLIENT ---
class AudioServiceClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client: Optional[httpx.AsyncClient] = None
        self.circuit_breaker = CircuitBreaker()
        self._health_check_task: Optional[asyncio.Task] = None
        self.last_known_status: str = "unknown"

    async def start(self):
        """Initialize resources and background monitoring."""
        logger.info(f"Initializing Audio Service Client (SOTA) at {self.base_url}")
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=10.0)
        self._health_check_task = asyncio.create_task(self._health_monitor_loop())

    async def stop(self):
        """Cleanup resources."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        
        if self.client:
            await self.client.aclose()
        logger.info("Audio Service Client Shutdown.")

    # --- HEALTH MONITOR ---
    async def _health_monitor_loop(self):
        """Active Health Check (Background Task)."""
        logger.info("Starting Audio Service Health Monitor...")
        while True:
            try:
                await asyncio.sleep(15) # Check every 15s
                if self.client and not self.circuit_breaker.is_open():
                    try:
                        resp = await self.client.get("/status", timeout=2.0)
                        if resp.status_code == 200:
                            self.circuit_breaker.record_success()
                            self.last_known_status = "online"
                        else:
                            self.last_known_status = "error"
                    except Exception:
                        self.last_known_status = "offline"
                        # Don't trip circuit breaker on background ping to avoid locking user actions excessively?
                        # Or DO trip it? better to trip it.
                        self.circuit_breaker.record_failure()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Health check error: {e}")

    # --- CORE REQUESTER ---
    async def _request(
        self, 
        method: str, 
        path: str, 
        data: Any = None, 
        response_model: Optional[Type[T]] = None,
        correlation_id: Optional[str] = None,
        timeout: float = 10.0
    ) -> Union[T, Dict[str, Any]]:
        
        if self.circuit_breaker.is_open():
            logger.warning("Request rejected by Circuit Breaker.")
            raise ServiceOfflineException()

        if not self.client:
            raise HTTPException(status_code=503, detail="Audio Client not initialized")

        headers = {}
        
        # SOTA: Auto-detect Request ID/Correlation ID if not explicitly passed
        # This ensures tracing even if the developer forgets to pass it.
        from middleware.logging_context import get_request_id
        final_correlation_id = correlation_id or get_request_id()
        if final_correlation_id:
            headers["X-Correlation-ID"] = final_correlation_id

        try:
            # SOTA: Reduce noise for high-frequency status checks
            is_start_status = path in ["/status", "/health"]
            if not is_start_status:
                logger.debug(f"Starting Audio Service Request: {method} {path}")
            
            response = await self.client.request(
                method, 
                path, 
                json=data, 
                headers=headers, 
                timeout=timeout
            )
            
            if not is_start_status:
                logger.debug(f"Audio Service Request: {method} {path} | Payload: {data}")
            
            # Map HTTP Errors to Business Exceptions
            if response.status_code == 409: # Conflict / Busy
                raise DeviceBusyException()
            
            response.raise_for_status()
            
            self.circuit_breaker.record_success()
            self.last_known_status = "online"

            json_data = response.json()
            
            if response_model:
                return response_model.model_validate(json_data)
            return json_data

        except (httpx.ConnectError, httpx.TimeoutException):
            self.circuit_breaker.record_failure()
            self.last_known_status = "offline"
            raise ServiceOfflineException()
            
        except httpx.HTTPStatusError as e:
            # Pass through generic HTTP errors if not handled above
            detail = e.response.text
            try:
                detail = e.response.json().get("error", detail)
            except: pass
            
            logger.error(f"Upstream Error ({e.response.status_code}): {detail}")
            raise HTTPException(status_code=e.response.status_code, detail=detail)

        except AudioServiceException as e:
            # Re-raise known business exceptions for the router to handle mapping
            raise e

    # --- PUBLIC API (ORCHESTRATION) ---

    async def get_status(self, correlation_id: str = None) -> AudioServiceStatus:
        try:
            return await self._request(
                "GET", 
                "/status", 
                response_model=AudioServiceStatus, 
                correlation_id=correlation_id,
                timeout=2.0
            )
        except HTTPException:
            # Fallback for status check
            return AudioServiceStatus(
                status="offline", 
                isCapturing=False, 
                detail="Service unreachable"
            )

    async def start_streaming_smart(self, request_data: Any, api_key: str) -> SimpleResponse:
        """
        SOTA Orchestrator:
        1. Resolves keyterms asynchronously (Non-blocking).
        2. Starts streaming.
        """
        # 1. Resolve Keyterms (CPU/DB bound protection)
        keyterms = []
        if request_data.company_name or request_data.project_name:
             # Run heavy logic in executor to protect event loop
             import asyncio
             from services.assemblyai_service import get_assemblyai_service
             
             def _resolve():
                 try:
                     svc = get_assemblyai_service()
                     return svc.get_smart_word_boost(
                        company_name=request_data.company_name,
                        project_name=request_data.project_name
                     )
                 except Exception as e:
                     logger.warning(f"Smart Keyterm resolution failed: {e}")
                     return []
            
             keyterms = await asyncio.to_thread(_resolve)
             
        # Merge manual + smart keyterms
        final_keyterms = (request_data.keyterms or []) + keyterms
        
        payload = {
            "apiKey": api_key,
            "sessionId": request_data.session_id,
            "language": request_data.language,
            "keyterms": final_keyterms,
            "microphoneDeviceId": request_data.microphone_device_id,
            "systemDeviceId": request_data.system_device_id,
            "useAssemblyAI": request_data.use_assemblyai
        }
        
        return await self._request(
            "POST", 
            "/start", 
            data=payload, 
            response_model=SimpleResponse
        )

    async def stop_streaming(self) -> SimpleResponse:
        """Call C# service to stop streaming."""
        return await self._request(
            "POST", 
            "/stop", 
            response_model=SimpleResponse
        )

    async def set_gain(self, gain: float) -> SimpleResponse:
        """Set digital gain."""
        return await self._request(
            "POST", 
            "/gain", 
            data={"gain": gain},
            response_model=SimpleResponse
        )

    async def start_test_with_recovery(self, payload: dict) -> SimpleResponse:
        """
        Starts test recording with SOTA Self-Healing (Auto-Reset on Busy).
        """
        try:
            return await self._request(
                "POST", 
                "/test/start", 
                data=payload, 
                response_model=SimpleResponse
            )
        except DeviceBusyException:
            logger.warning("Audio Device BUSY. Initiating Self-Healing (Force Reset)...")
            await self.force_reset()
            # Brief cool-down for hardware release
            await asyncio.sleep(0.5)
            # Retry Once
            return await self._request(
                "POST", 
                "/test/start", 
                data=payload, 
                response_model=SimpleResponse
            )

    async def force_reset(self, correlation_id: str = None):
        """Tenta parar qualquer gravação pendente."""
        try:
            await self._request("POST", "/test/stop", correlation_id=correlation_id, timeout=2.0)
        except: 
            pass

    async def get_devices(self, correlation_id: str = None) -> List[AudioDevice]:
        """Fetch and abstract available audio devices."""
        # Use automated correlation ID if None
        raw_devices = await self._request("GET", "/devices", correlation_id=correlation_id)
        
        # Abstraction Layer: Clean C# hardware details
        cleaned_devices = []
        
        # Helper to process a single logical device item
        def process_item(d: Any, is_mic: bool):
            if isinstance(d, str):
                cleaned_devices.append(AudioDevice(
                    id=d,
                    name=d,
                    is_default=False,
                    is_microphone=is_mic
                ))
            elif isinstance(d, dict):
                cleaned_devices.append(AudioDevice(
                    id=d.get("id"),
                    name=d.get("name", "Unknown Device"),
                    is_default=d.get("isDefault", False),
                    is_microphone=is_mic
                ))

        # Handle List (Legacy or Simple String List)
        if isinstance(raw_devices, list):
            for d in raw_devices:
                process_item(d, is_mic=True) # Default to mic if list?
                
        # Handle Dictionary (Structured Response)
        elif isinstance(raw_devices, dict):
            # Check for wrapped "devices" key
            target_dict = raw_devices.get("devices", raw_devices)
            
            # Extract Microphones
            mics = target_dict.get("microphones", [])
            for d in mics:
                process_item(d, is_mic=True)
                
            # Extract Speakers
            speakers = target_dict.get("speakers", [])
            for d in speakers:
                process_item(d, is_mic=False)
            
        return cleaned_devices
